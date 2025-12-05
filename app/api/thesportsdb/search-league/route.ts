import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q"); // Premier League
  const c = searchParams.get("c") ?? "England";
  const s = searchParams.get("s") ?? "Soccer";

  if (!q) return NextResponse.json({ error: "Missing ?q=" }, { status: 400 });

  const key = process.env.THESPORTSDB_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing THESPORTSDB_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  // List leagues for a country & sport, then find the one that matches q
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/search_all_leagues.php?c=${encodeURIComponent(
    c
  )}&s=${encodeURIComponent(s)}`;

  const r = await fetch(url, { cache: "no-store" });
  const json = await r.json();

  const leagues = json?.countries ?? [];
  const match =
    leagues.find((l: any) => String(l.strLeague).toLowerCase() === q.toLowerCase()) ??
    leagues.find((l: any) => String(l.strLeague).toLowerCase().includes(q.toLowerCase()));

  return NextResponse.json({ match, total: leagues.length });
}
