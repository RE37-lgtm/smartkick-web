import Link from "next/link";

type AnyRow = any;

const toNum = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

function onlyFinished(list: AnyRow[]) {
  return (list ?? []).filter(
    (e) => toNum(e.intHomeScore) !== null && toNum(e.intAwayScore) !== null
  );
}

function onlyUpcoming(list: AnyRow[]) {
  return (list ?? []).filter(
    (e) => toNum(e.intHomeScore) === null && toNum(e.intAwayScore) === null
  );
}

async function safeJson(url: string) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return await r.json();
  } catch {
    return null;
  }
}

export default async function TeamPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  const key = process.env.THESPORTSDB_API_KEY;

  if (!key) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white">
        <div className="mx-auto max-w-5xl px-6 pt-10 pb-12">
          <Link href="/" className="text-sm text-neutral-300 hover:text-white">
            ← Back
          </Link>
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Missing THESPORTSDB_API_KEY in .env.local
          </div>
        </div>
      </main>
    );
  }

  // Team details
  const teamJson = await safeJson(
    `https://www.thesportsdb.com/api/v1/json/${key}/lookupteam.php?id=${encodeURIComponent(id)}`
  );
  const team = teamJson?.teams?.[0] ?? null;

  // Last / Next events for team
  const [lastJson, nextJson] = await Promise.all([
    safeJson(
      `https://www.thesportsdb.com/api/v1/json/${key}/eventslast.php?id=${encodeURIComponent(id)}`
    ),
    safeJson(
      `https://www.thesportsdb.com/api/v1/json/${key}/eventsnext.php?id=${encodeURIComponent(id)}`
    ),
  ]);

  const lastFinished = onlyFinished(lastJson?.results ?? []).slice(0, 20);
  const nextUpcoming = onlyUpcoming(nextJson?.events ?? []).slice(0, 10);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-12">
        <Link href="/" className="text-sm text-neutral-300 hover:text-white">
          ← Back
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          {team?.strTeam ?? "Team"}
        </h1>
        <p className="mt-2 text-neutral-300">
          {team?.strCountry ? `${team.strCountry} • ` : ""}
          {team?.strSport ?? "Soccer"}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Upcoming</h2>
            {nextUpcoming.length === 0 ? (
              <p className="mt-2 text-neutral-300">No upcoming matches found.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-neutral-300">
                {nextUpcoming.map((e: AnyRow) => (
                  <li
                    key={e.idEvent}
                    className="flex items-center justify-between gap-4"
                  >
                    <Link
                      href={`/event/${e.idEvent}`}
                      className="truncate hover:underline"
                    >
                      {e.strEvent}
                    </Link>
                    <span className="text-sm text-neutral-400">
                      {e.dateEvent} {e.strTime ? `• ${e.strTime}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Last results</h2>
            {lastFinished.length === 0 ? (
              <p className="mt-2 text-neutral-300">No finished matches found.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-neutral-300">
                {lastFinished.map((e: AnyRow) => (
                  <li
                    key={e.idEvent}
                    className="flex items-center justify-between gap-4"
                  >
                    <Link
                      href={`/event/${e.idEvent}`}
                      className="truncate hover:underline"
                    >
                      {e.strEvent}
                    </Link>
                    <span className="text-sm text-neutral-400">
                      {e.intHomeScore ?? "-"}-{e.intAwayScore ?? "-"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
