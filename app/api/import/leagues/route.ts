import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// POST /api/import/leagues
// Body opcional: { sport?: "Soccer" | "Basketball" | "American Football", setActive?: boolean }
export async function POST(req: Request) {
  try {
    const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const SPORTS_KEY = requireEnv("THESPORTSDB_API_KEY");

    const body = await req.json().catch(() => ({}));
    const sport = body?.sport ?? "Soccer"; // default soccer
    const setActive = body?.setActive ?? false; // default false

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // 1) Traer ligas desde TheSportsDB
    const url = `https://www.thesportsdb.com/api/v1/json/${SPORTS_KEY}/all_leagues.php`;
    const r = await fetch(url, { cache: "no-store" });

    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `TheSportsDB request failed: ${r.status}` },
        { status: 500 }
      );
    }

    const json = await r.json();
    const leagues: any[] = json?.leagues ?? [];

    // 2) Filtrar por deporte y datos válidos
    const filtered = leagues.filter(
      (l) => l?.idLeague && l?.strLeague && l?.strSport === sport
    );

    // 3) Mapear a tu tabla
    const rows = filtered.map((l) => ({
      name: String(l.strLeague),
      country: l.strCountry ? String(l.strCountry) : "N/A",
      sport: String(l.strSport).toLowerCase(), // "soccer"
      active: Boolean(setActive),
      thesportsdb_league_id: String(l.idLeague),
    }));

    // 4) Upsert para evitar duplicados (gracias al UNIQUE index)
    const { error } = await sb
      .from("leagues")
      .upsert(rows, { onConflict: "thesportsdb_league_id" });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      imported: rows.length,
      sport,
      setActive,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
