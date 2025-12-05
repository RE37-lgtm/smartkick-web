import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// GET /api/import/leagues-soccer
export async function GET() {
  try {
    const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const SPORTS_KEY = requireEnv("THESPORTSDB_API_KEY");

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const url = `https://www.thesportsdb.com/api/v1/json/${SPORTS_KEY}/all_leagues.php`;
    const r = await fetch(url, { cache: "no-store" });
    const json = await r.json();

    const leagues: any[] = json?.leagues ?? [];
    const filtered = leagues.filter(
      (l) => l?.idLeague && l?.strLeague && l?.strSport === "Soccer"
    );

    const rows = filtered.map((l) => ({
      name: String(l.strLeague),
      country: l.strCountry ? String(l.strCountry) : "N/A",
      sport: "soccer",
      active: false,
      thesportsdb_league_id: String(l.idLeague),
    }));

    const { error } = await sb
      .from("leagues")
      .upsert(rows, { onConflict: "thesportsdb_league_id" });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, imported: rows.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
