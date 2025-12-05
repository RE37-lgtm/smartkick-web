import Link from "next/link";

export const dynamic = "force-dynamic";

function toMs(dateStr?: string | null) {
  if (!dateStr) return null;
  const ms = Date.parse(dateStr + "T00:00:00");
  return Number.isFinite(ms) ? ms : null;
}

function inNextHours(dateStr?: string | null, hours = 48) {
  const ms = toMs(dateStr);
  if (ms === null) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = startOfToday + hours * 60 * 60 * 1000;

  return ms >= startOfToday && ms <= end;
}

async function getNextFromTopLeagues() {
  const key = process.env.THESPORTSDB_API_KEY;
  if (!key) return { error: "Missing THESPORTSDB_API_KEY", events: [] as any[] };

  const topLeagueIds = [
    "4328", // Premier League
    "4335", // LaLiga
    "4332", // Serie A
    "4331", // Bundesliga
    "4334", // Ligue 1
  ];

  const results = await Promise.all(
    topLeagueIds.map(async (leagueId) => {
      const url = `https://www.thesportsdb.com/api/v1/json/${key}/eventsnextleague.php?id=${leagueId}`;
      try {
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        return (j?.events ?? []) as any[];
      } catch {
        return [] as any[];
      }
    })
  );

  const all = results.flat();

  // ✅ show next 48h (today + tomorrow)
  const upcoming = all.filter((e) => inNextHours(e.dateEvent, 48));

  // Sort by date then time
  upcoming.sort((a, b) => {
    const am = toMs(a.dateEvent) ?? 0;
    const bm = toMs(b.dateEvent) ?? 0;
    if (am !== bm) return am - bm;
    return String(a.strTime || "").localeCompare(String(b.strTime || ""));
  });

  return { error: null as string | null, events: upcoming };
}

export default async function TodayPicksPage() {
  const { error, events } = await getNextFromTopLeagues();

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-12">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Today Picks</h1>
            <p className="mt-2 text-neutral-300">
              Next matches in the top leagues (next 48 hours).
            </p>
          </div>
          <Link href="/" className="text-sm text-neutral-300 hover:text-white">
            Back →
          </Link>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-neutral-300">
            No matches found in the next 48 hours for the top leagues.
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {events.slice(0, 10).map((e: any) => (
              <li
                key={e.idEvent}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/event/${e.idEvent}`} className="font-semibold hover:underline">
                    {e.strEvent || `${e.strHomeTeam} vs ${e.strAwayTeam}`}
                  </Link>
                  <div className="text-sm text-neutral-300">
                    {e.dateEvent ?? ""} {e.strTime ? `• ${e.strTime}` : ""}{" "}
                    {e.strLeague ? `• ${e.strLeague}` : ""}
                  </div>
                </div>

                {(e.strVenue || e.strCity) && (
                  <div className="mt-1 text-sm text-neutral-400">
                    {e.strVenue ? e.strVenue : ""}
                    {e.strCity ? ` • ${e.strCity}` : ""}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-xs text-neutral-500">
          Tap a match to see picks + H2H + stats.
        </p>
      </div>
    </main>
  );
}
