import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function slugifyCountry(input: string) {
  const s = (input || "").trim().toLowerCase();
  if (!s) return null;

  const map: Record<string, string> = {
    "united states": "usa",
    "u.s.a.": "usa",
    usa: "usa",
    england: "england",
    spain: "spain",
    mexico: "mexico",
    "méxico": "mexico",
    france: "france",
    germany: "germany",
    italy: "italy",
  };

  if (map[s]) return map[s];

  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function guessCategory(name: string) {
  const n = (name || "").toLowerCase();

  const internationalHints = [
    "uefa",
    "champions league",
    "europa league",
    "conference league",
    "nations league",
    "world cup",
    "copa america",
    "africa cup",
    "asian cup",
    "concacaf",
    "afc",
    "caf",
    "fifa",
    "club world cup",
    "qualification",
    "qualif",
    "friendly",
    "friendlies",
    "olympic",
  ];

  const cupHints = [
    " cup",
    "copa",
    "coppa",
    "pokal",
    "taça",
    "coupe",
    "trophy",
    "league cup",
    "king's cup",
    "fa cup",
  ];

  if (internationalHints.some((k) => n.includes(k))) return "international";
  if (cupHints.some((k) => n.includes(k))) return "domestic_cup";
  return "domestic_league";
}

async function fetchJsonWithTimeout(url: string, ms = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { cache: "no-store", signal: controller.signal });
    const ct = r.headers.get("content-type") || "";

    if (!r.ok) {
      const preview = await r.text().catch(() => "");
      return { ok: false as const, status: r.status, ct, preview: preview.slice(0, 200) };
    }
    if (!ct.includes("application/json")) {
      const preview = await r.text().catch(() => "");
      return { ok: false as const, status: r.status, ct, preview: preview.slice(0, 200) };
    }

    const data = await r.json();
    return { ok: true as const, data };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? `timeout after ${ms}ms` : e?.message || "fetch failed";
    return { ok: false as const, status: 0, ct: "", preview: msg };
  } finally {
    clearTimeout(t);
  }
}

// Ejecutar desde navegador:
// /api/import/enrich-meta?limit=200&onlySoccer=1
export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const limit = Math.max(1, Math.min(Number(urlObj.searchParams.get("limit") ?? "200"), 200));
  const onlySoccer = (urlObj.searchParams.get("onlySoccer") ?? "1") !== "0";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sportsKey = process.env.THESPORTSDB_API_KEY;

  if (!supabaseUrl) return json({ ok: false, message: "Missing NEXT_PUBLIC_SUPABASE_URL" }, 500);
  if (!serviceKey) return json({ ok: false, message: "Missing SUPABASE_SERVICE_ROLE_KEY (restart dev server)" }, 500);
  if (!sportsKey) return json({ ok: false, message: "Missing THESPORTSDB_API_KEY" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ✅ PENDIENTES: solo filas incompletas
  // country_slug is null OR category is null OR country is null OR country='N/A'
  let q = admin
    .from("leagues")
    .select("id,name,country,sport,active,thesportsdb_league_id,category,country_slug")
    .not("thesportsdb_league_id", "is", null)
    .or("country_slug.is.null,category.is.null,country.is.null,country.eq.N/A")
    .limit(limit);

  if (onlySoccer) q = q.eq("sport", "soccer");

  const { data: rows, error } = await q;
  if (error) return json({ ok: false, message: "Supabase select failed", error: error.message }, 500);

  let scanned = rows?.length ?? 0;
  let updated = 0;
  let skipped = 0;
  let tsdbFailures = 0;

  const sample: any[] = [];

  for (const r of rows ?? []) {
    const leagueId = String(r.thesportsdb_league_id ?? "").trim();
    if (!leagueId) {
      skipped++;
      continue;
    }

    const apiUrl = `https://www.thesportsdb.com/api/v1/json/${sportsKey}/lookupleague.php?id=${leagueId}`;
    const resp = await fetchJsonWithTimeout(apiUrl, 8000);

    if (!resp.ok) {
      tsdbFailures++;
      if (sample.length < 20) sample.push({ id: r.id, name: r.name, status: "tsdb_failed", ...resp });
      continue;
    }

    const apiLeague = resp.data?.leagues?.[0];
    const apiCountry = apiLeague?.strCountry ? String(apiLeague.strCountry).trim() : "";

    const newCountry =
      apiCountry && apiCountry.toLowerCase() !== "n/a"
        ? apiCountry
        : (r.country && r.country !== "N/A" ? r.country : null);

    const newCategory = guessCategory(String(r.name ?? ""));
    const newCountrySlug =
      newCategory === "international" ? "international" : (newCountry ? slugifyCountry(newCountry) : null);

    const patch: any = {};
    if (newCountry && newCountry !== r.country) patch.country = newCountry;
    if (newCategory && newCategory !== r.category) patch.category = newCategory;
    if (newCountrySlug && newCountrySlug !== r.country_slug) patch.country_slug = newCountrySlug;

    if (Object.keys(patch).length === 0) {
      skipped++;
      continue;
    }

    const up = await admin.from("leagues").update(patch).eq("id", r.id);
    if (up.error) {
      if (sample.length < 20) sample.push({ id: r.id, name: r.name, status: "update_failed", error: up.error.message });
      continue;
    }

    updated++;
    if (sample.length < 20) sample.push({ id: r.id, name: r.name, status: "updated", patch });
  }

  return json({
    ok: true,
    scanned,
    updated,
    skipped,
    tsdbFailures,
    tip: "Keep refreshing until updated becomes 0, then verify with SQL missing counts.",
    sample,
  });
}

