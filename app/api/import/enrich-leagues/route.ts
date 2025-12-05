import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = {
  onlySoccer?: boolean;
  limit?: number; // cuántas filas procesar por corrida
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fetchJsonWithTimeout(url: string, ms = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  try {
    const r = await fetch(url, { cache: "no-store", signal: controller.signal });

    const contentType = r.headers.get("content-type") || "";
    if (!r.ok) {
      const preview = await r.text().catch(() => "");
      return { ok: false as const, status: r.status, contentType, preview: preview.slice(0, 200) };
    }

    if (!contentType.includes("application/json")) {
      const preview = await r.text().catch(() => "");
      return { ok: false as const, status: r.status, contentType, preview: preview.slice(0, 200) };
    }

    const data = await r.json();
    return { ok: true as const, data };
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? `timeout after ${ms}ms`
        : e?.message || "fetch failed";
    return { ok: false as const, status: 0, contentType: "", preview: msg };
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  return json({ ok: false, message: "Use POST for this endpoint." }, 405);
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const onlySoccer = body.onlySoccer ?? true;
    const limit = Math.max(1, Math.min(body.limit ?? 200, 2000));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sportsKey = process.env.THESPORTSDB_API_KEY;

    if (!supabaseUrl) return json({ ok: false, message: "Missing NEXT_PUBLIC_SUPABASE_URL" }, 500);
    if (!serviceKey) return json({ ok: false, message: "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local (restart dev server)" }, 500);
    if (!sportsKey) return json({ ok: false, message: "Missing THESPORTSDB_API_KEY" }, 500);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) traer ligas SIN thesportsdb_league_id
    let q = admin
      .from("leagues")
      .select("id,name,country,sport,thesportsdb_league_id")
      .is("thesportsdb_league_id", null)
      .limit(limit);

    if (onlySoccer) q = q.eq("sport", "soccer");

    const { data: leagues, error } = await q;
    if (error) return json({ ok: false, message: "Supabase select failed", error }, 500);

    const processed = leagues?.length ?? 0;
    if (!processed) {
      return json({
        ok: true,
        processed: 0,
        updated: 0,
        skipped: 0,
        notFound: 0,
        tsdbFailures: 0,
        tookMs: Date.now() - startedAt,
        message: "No leagues found with thesportsdb_league_id = null (nothing to enrich).",
      });
    }

    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    let tsdbFailures = 0;

    const sample: any[] = [];

    // 2) por cada liga: buscar id en TheSportsDB y guardar
    for (const l of leagues ?? []) {
      const name = String(l.name ?? "").trim();
      if (!name) {
        skipped++;
        if (sample.length < 25) sample.push({ leagueRowId: l.id, status: "skipped_empty_name" });
        continue;
      }

      const url = `https://www.thesportsdb.com/api/v1/json/${sportsKey}/search_all_leagues.php?l=${encodeURIComponent(name)}`;

      const resp = await fetchJsonWithTimeout(url, 8000);

      if (!resp.ok) {
        tsdbFailures++;
        if (sample.length < 25) {
          sample.push({
            leagueRowId: l.id,
            name,
            status: "tsdb_failed",
            tsdbStatus: resp.status,
            contentType: resp.contentType,
            preview: resp.preview,
          });
        }
        continue;
      }

      const jsonResp: any = resp.data;

      // TheSportsDB a veces devuelve la lista en "countries"
      const candidates: any[] = Array.isArray(jsonResp?.countries) ? jsonResp.countries : [];
      if (!candidates.length) {
        notFound++;
        if (sample.length < 25) sample.push({ leagueRowId: l.id, name, status: "not_found" });
        continue;
      }

      const country = String(l.country ?? "").trim().toLowerCase();
      const sport = String(l.sport ?? "").trim().toLowerCase();

      const best =
        candidates.find((c) => {
          const cSport = String(c?.strSport ?? "").toLowerCase();
          const cCountry = String(c?.strCountry ?? "").toLowerCase();
          if (sport && cSport && cSport !== sport) return false;
          if (country && cCountry && cCountry !== country) return false;
          return true;
        }) ?? candidates[0];

      const tsdbId = best?.idLeague ? String(best.idLeague) : "";
      if (!tsdbId) {
        notFound++;
        if (sample.length < 25) sample.push({ leagueRowId: l.id, name, status: "not_found_no_idLeague" });
        continue;
      }

      const up = await admin
        .from("leagues")
        .update({ thesportsdb_league_id: tsdbId })
        .eq("id", l.id);

      if (up.error) {
        if (sample.length < 25) sample.push({ leagueRowId: l.id, name, status: "update_failed", error: up.error });
        continue;
      }

      updated++;
      if (sample.length < 25) sample.push({ leagueRowId: l.id, name, status: "updated", thesportsdb_league_id: tsdbId });
    }

    return json({
      ok: true,
      processed,
      updated,
      skipped,
      notFound,
      tsdbFailures,
      tookMs: Date.now() - startedAt,
      sample,
    });
  } catch (e: any) {
    return json({ ok: false, message: e?.message ?? "Unknown error" }, 500);
  }
}

