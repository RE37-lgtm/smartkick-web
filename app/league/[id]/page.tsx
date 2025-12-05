import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type AnyRow = any;

async function safeJson(url: string) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return await r.json();
  } catch {
    return null;
  }
}

export default async function LeaguePage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);

  // 1) Liga desde Supabase (incluye thesportsdb_league_id)
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id,name,country,sport,active,thesportsdb_league_id")
    .eq("id", id)
    .single();

  // 2) Próximos partidos desde TheSportsDB (si la liga tiene id)
  const key = process.env.THESPORTSDB_API_KEY;

  let nextEvents: AnyRow[] = [];
  let nextMsg: string | null = null;

  const leagueId = league?.thesportsdb_league_id
    ? String(league.thesportsdb_league_id)
    : "";

  if (leagueId) {
    if (!key) {
      nextMsg = "Missing THESPORTSDB_API_KEY in .env.local";
    } else {
      const url = `https://www.thesportsdb.com/api/v1/json/${key}/eventsnextleague.php?id=${encodeURIComponent(
        leagueId
      )}`;
      const json = await safeJson(url);

      nextEvents = json?.events ?? [];
      if (!json) nextMsg = "Could not load upcoming matches.";
      if (json && nextEvents.length === 0) nextMsg = "No upcoming matches found.";
    }
  } else {
    nextMsg = "This league doesn’t have a TheSportsDB id yet.";
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-12">
        <Link href="/" className="text-sm text-neutral-300 hover:text-white">
          ← Back
        </Link>

        {/* Error cargando liga */}
        {error ? (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Error loading league: {error.message}
          </div>
        ) : !league ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            League not found.
          </div>
        ) : (
          <>
            {/* Header liga */}
            <h1 className="mt-6 text-3xl font-bold tracking-tight">
              {league.name}
            </h1>
            <p className="mt-2 text-neutral-300">
              {league.country} • {league.sport}
            </p>

            {/* Next matches */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">Upcoming matches</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Click a match to see picks (BTTS / Over 2.5 / last 5).
              </p>

              {nextMsg ? (
                <p className="mt-4 text-neutral-300">{nextMsg}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {nextEvents.slice(0, 15).map((e: AnyRow) => (
                    <li
                      key={e.idEvent}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <Link
                          href={`/event/${e.idEvent}`}
                          className="font-semibold hover:underline"
                        >
                          {e.strEvent || `${e.strHomeTeam} vs ${e.strAwayTeam}`}
                        </Link>

                        <div className="text-sm text-neutral-300">
                          {e.dateEvent} {e.strTime ? `• ${e.strTime}` : ""}
                        </div>
                      </div>

                      {(e.strVenue || e.strCity) && (
                        <div className="mt-1 text-sm text-neutral-300">
                          {e.strVenue ? e.strVenue : ""}
                          {e.strCity ? ` • ${e.strCity}` : ""}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
