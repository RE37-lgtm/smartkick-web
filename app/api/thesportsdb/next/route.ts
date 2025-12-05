import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId"); // e.g. 4328

  if (!leagueId) {
    return NextResponse.json(
      { error: "Missing ?leagueId=" },
      { status: 400 }
    );
  }

  const key = process.env.THESPORTSDB_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing THESPORTSDB_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  const url = `https://www.thesportsdb.com/api/v1/json/${key}/eventsnextleague.php?id=${encodeURIComponent(
    leagueId
  )}`;

  const r = await fetch(url, { cache: "no-store" });
  const json = await r.json();

  return NextResponse.json(json);
}
