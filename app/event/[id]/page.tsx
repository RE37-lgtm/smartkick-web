import Link from "next/link";

type AnyRow = any;

const toNum = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

function toDateMs(dateStr?: string | null) {
  if (!dateStr) return null;
  const ms = Date.parse(dateStr);
  return Number.isFinite(ms) ? ms : null;
}

function lastFinished(events: AnyRow[], limit = 5) {
  const fin = (events ?? []).filter(
    (e) => toNum(e.intHomeScore) !== null && toNum(e.intAwayScore) !== null
  );
  return fin.slice(0, limit);
}

function pctOver25(events: AnyRow[]) {
  if (!events?.length) return null;
  const over = events.filter(
    (e) => (toNum(e.intHomeScore)! + toNum(e.intAwayScore)!) >= 3
  ).length;
  return Math.round((over / events.length) * 100);
}

function pctBTTS(events: AnyRow[]) {
  if (!events?.length) return null;
  const btts = events.filter(
    (e) => toNum(e.intHomeScore)! >= 1 && toNum(e.intAwayScore)! >= 1
  ).length;
  return Math.round((btts / events.length) * 100);
}

function combine(a: number | null, b: number | null) {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return Math.round((a + b) / 2);
}

function combineFloat(a: number | null, b: number | null) {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return Math.round(((a + b) / 2) * 10) / 10;
}

function yesNo(yes: number | null) {
  if (yes === null)
    return { yes: null as number | null, no: null as number | null };
  return { yes, no: 100 - yes };
}

function avgGFGA(events: AnyRow[], teamId: string) {
  if (!events?.length || !teamId) {
    return { gf: null as number | null, ga: null as number | null, n: 0 };
  }

  let gf = 0;
  let ga = 0;

  for (const e of events) {
    const hs = toNum(e.intHomeScore);
    const as = toNum(e.intAwayScore);
    if (hs === null || as === null) continue;

    if (String(e.idHomeTeam) === String(teamId)) {
      gf += hs;
      ga += as;
    } else {
      gf += as;
      ga += hs;
    }
  }

  const n = events.length;
  return {
    gf: Math.round((gf / n) * 10) / 10,
    ga: Math.round((ga / n) * 10) / 10,
    n,
  };
}

function avgTotalGoals(events: AnyRow[]) {
  if (!events?.length) return null;
  let sum = 0;
  for (const e of events) {
    const hs = toNum(e.intHomeScore);
    const as = toNum(e.intAwayScore);
    if (hs === null || as === null) continue;
    sum += hs + as;
  }
  return Math.round((sum / events.length) * 10) / 10;
}

function cleanSheetPct(events: AnyRow[], teamId: string) {
  if (!events?.length || !teamId) return null;
  let cs = 0;
  for (const e of events) {
    const hs = toNum(e.intHomeScore);
    const as = toNum(e.intAwayScore);
    if (hs === null || as === null) continue;

    const isHome = String(e.idHomeTeam) === String(teamId);
    const conceded = isHome ? as : hs;
    if (conceded === 0) cs += 1;
  }
  return Math.round((cs / events.length) * 100);
}

function formWDL(last5Finished: AnyRow[], teamId: string) {
  const out: ("W" | "D" | "L")[] = [];

  for (const e of last5Finished) {
    const hs = toNum(e.intHomeScore);
    const as = toNum(e.intAwayScore);
    if (hs === null || as === null) continue;

    const isHome = String(e.idHomeTeam) === String(teamId);
    const my = isHome ? hs : as;
    const opp = isHome ? as : hs;

    if (my > opp) out.push("W");
    else if (my < opp) out.push("L");
    else out.push("D");
  }

  return out;
}

function FormPills({ form }: { form: ("W" | "D" | "L")[] }) {
  const show = form.length ? form : ["D", "D", "D", "D", "D"];
  return (
    <div className="flex items-center gap-2">
      {show.map((x, i) => (
        <span
          key={`${x}-${i}`}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            x === "W"
              ? "bg-emerald-500/15 text-emerald-200"
              : x === "L"
              ? "bg-red-500/15 text-red-200"
              : "bg-white/10 text-neutral-200"
          }`}
        >
          {x}
        </span>
      ))}
    </div>
  );
}

function dataQualityLabel(homeN: number, awayN: number) {
  const minN = Math.min(homeN, awayN);
  if (minN >= 5)
    return { label: "HIGH" as const, cls: "bg-emerald-500/15 text-emerald-200" };
  if (minN >= 3)
    return { label: "MEDIUM" as const, cls: "bg-amber-500/15 text-amber-200" };
  return { label: "LOW" as const, cls: "bg-red-500/15 text-red-200" };
}

function homeAwaySplit(last5: AnyRow[], teamId: string) {
  let homeGF = 0,
    homeGA = 0,
    homeN = 0;
  let awayGF = 0,
    awayGA = 0,
    awayN = 0;

  for (const e of last5 ?? []) {
    const hs = toNum(e.intHomeScore);
    const as = toNum(e.intAwayScore);
    if (hs === null || as === null) continue;

    const isHome = String(e.idHomeTeam) === String(teamId);

    if (isHome) {
      homeN += 1;
      homeGF += hs;
      homeGA += as;
    } else {
      awayN += 1;
      awayGF += as;
      awayGA += hs;
    }
  }

  const round1 = (x: number) => Math.round(x * 10) / 10;

  return {
    homeN,
    awayN,
    homeGF: homeN ? round1(homeGF / homeN) : null,
    homeGA: homeN ? round1(homeGA / homeN) : null,
    awayGF: awayN ? round1(awayGF / awayN) : null,
    awayGA: awayN ? round1(awayGA / awayN) : null,
  };
}

function confidenceLabel(yesPct: number | null, dq: "HIGH" | "MEDIUM" | "LOW") {
  if (yesPct === null) return { label: "—", cls: "bg-white/10 text-neutral-200" };
  const dist = Math.abs(yesPct - 50);

  let score = 0;
  if (dist >= 20) score += 2;
  else if (dist >= 10) score += 1;

  if (dq === "HIGH") score += 2;
  else if (dq === "MEDIUM") score += 1;

  if (score >= 3) return { label: "HIGH", cls: "bg-emerald-500/15 text-emerald-200" };
  if (score >= 2) return { label: "MEDIUM", cls: "bg-amber-500/15 text-amber-200" };
  return { label: "LOW", cls: "bg-red-500/15 text-red-200" };
}

function YesNoBox({
  title,
  yesPct,
  homeN,
  awayN,
  dqLabel,
}: {
  title: string;
  yesPct: number | null;
  homeN: number;
  awayN: number;
  dqLabel: "HIGH" | "MEDIUM" | "LOW";
}) {
  const yn = yesNo(yesPct);
  const pick =
    yn.yes === null
      ? "—"
      : yn.yes === yn.no
      ? "TOSS-UP"
      : yn.yes > yn.no
      ? "YES"
      : "NO";

  const totalN = homeN + awayN;
  const conf = confidenceLabel(yesPct, dqLabel);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${conf.cls}`}>
          CONF: {conf.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-neutral-400">YES</div>
          <div className="mt-1 text-lg font-semibold">{yn.yes === null ? "—" : `${yn.yes}%`}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-neutral-400">NO</div>
          <div className="mt-1 text-lg font-semibold">{yn.no === null ? "—" : `${yn.no}%`}</div>
        </div>
      </div>

      <div className="mt-3 text-sm text-neutral-300">
        Best pick: <span className="font-semibold text-white">{pick}</span>
      </div>

      <div className="mt-1 text-xs text-neutral-500">
        Based on last {totalN} finished matches{" "}
        <span className="text-neutral-600">(5 per team)</span>
      </div>
    </div>
  );
}

function MatchList({
  title,
  events,
  emptyText,
}: {
  title: string;
  events: AnyRow[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>

      {!events?.length ? (
        <p className="mt-2 text-neutral-300">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-neutral-300">
          {events.slice(0, 10).map((e) => (
            <li
              key={e.idEvent ?? `${e.strEvent}-${e.dateEvent}`}
              className="flex items-center justify-between gap-4"
            >
              <span className="truncate">
                {e.strEvent}{" "}
                {e.dateEvent ? (
                  <span className="text-xs text-neutral-500">({e.dateEvent})</span>
                ) : null}
              </span>
              <span className="text-sm text-neutral-400">
                {e.intHomeScore ?? "-"}-{e.intAwayScore ?? "-"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function safeJson(url: string) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchLeagueSeasonEvents(key: string, leagueId: string, season: string) {
  const candidates = [
    `https://www.thesportsdb.com/api/v1/json/${key}/eventsseason.php?id=${encodeURIComponent(
      leagueId
    )}&s=${encodeURIComponent(season)}`,
    `https://www.thesportsdb.com/api/v1/json/${key}/eventsseason.php?id=${encodeURIComponent(
      leagueId
    )}&season=${encodeURIComponent(season)}`,
  ];

  for (const url of candidates) {
    const j = await safeJson(url);
    const arr = j?.events ?? j?.results ?? null;
    if (Array.isArray(arr)) return arr as AnyRow[];
  }
  return [] as AnyRow[];
}

function seasonMinusOne(season: string) {
  const m = /^(\d{4})-(\d{4})$/.exec(season);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return `${a - 1}-${b - 1}`;
}

function buildSeasonList(currentSeason: string, yearsBack = 2) {
  const out: string[] = [currentSeason];
  let cur = currentSeason;
  for (let i = 0; i < yearsBack; i++) {
    const prev = seasonMinusOne(cur);
    if (!prev) break;
    out.push(prev);
    cur = prev;
  }
  return out;
}

function h2hFromLeagueEvents(opts: {
  leagueEvents: AnyRow[];
  homeTeamId: string;
  awayTeamId: string;
  withinYears: number;
}) {
  const { leagueEvents, homeTeamId, awayTeamId, withinYears } = opts;
  const cutoff = Date.now() - withinYears * 365 * 24 * 60 * 60 * 1000;

  const matches = (leagueEvents ?? []).filter((e) => {
    const h = String(e.idHomeTeam ?? "");
    const a = String(e.idAwayTeam ?? "");
    const ms = toDateMs(e.dateEvent) ?? 0;
    if (ms && ms < cutoff) return false;

    return (h === homeTeamId && a === awayTeamId) || (h === awayTeamId && a === homeTeamId);
  });

  matches.sort((x, y) => {
    const xm = toDateMs(x.dateEvent) ?? 0;
    const ym = toDateMs(y.dateEvent) ?? 0;
    return ym - xm;
  });

  return matches;
}

// ✅ NEW: recent finished matches from the league, last N days
function filterLastNDaysFinished(events: AnyRow[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const out = (events ?? []).filter((e) => {
    const hs = toNum(e.intHomeScore);
    const as = toNum(e.intAwayScore);
    if (hs === null || as === null) return false;
    const ms = toDateMs(e.dateEvent);
    if (ms === null) return false;
    return ms >= cutoff;
  });

  out.sort((a, b) => (toDateMs(b.dateEvent) ?? 0) - (toDateMs(a.dateEvent) ?? 0));
  return out;
}

export default async function EventPage({
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

  const eventJson = await safeJson(
    `https://www.thesportsdb.com/api/v1/json/${key}/lookupevent.php?id=${encodeURIComponent(id)}`
  );
  const event: AnyRow | null = eventJson?.events?.[0] ?? null;

  if (!event) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white">
        <div className="mx-auto max-w-5xl px-6 pt-10 pb-12">
          <Link href="/" className="text-sm text-neutral-300 hover:text-white">
            ← Back
          </Link>
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            Event not found.
          </div>
        </div>
      </main>
    );
  }

  const homeTeamId = String(event.idHomeTeam || "");
  const awayTeamId = String(event.idAwayTeam || "");
  const leagueId = event.idLeague ? String(event.idLeague) : "";
  const season = event.strSeason ? String(event.strSeason) : "";

  // Team last matches (for stats/picks)
  const [homeJson, awayJson] = await Promise.all([
    homeTeamId
      ? safeJson(
          `https://www.thesportsdb.com/api/v1/json/${key}/eventslast.php?id=${encodeURIComponent(homeTeamId)}`
        )
      : null,
    awayTeamId
      ? safeJson(
          `https://www.thesportsdb.com/api/v1/json/${key}/eventslast.php?id=${encodeURIComponent(awayTeamId)}`
        )
      : null,
  ]);

  const homeLastAll: AnyRow[] = homeJson?.results ?? [];
  const awayLastAll: AnyRow[] = awayJson?.results ?? [];

  const homeLast = lastFinished(homeLastAll, 5);
  const awayLast = lastFinished(awayLastAll, 5);

  const dq = dataQualityLabel(homeLast.length, awayLast.length);

  const overYes = combine(pctOver25(homeLast), pctOver25(awayLast));
  const bttsYes = combine(pctBTTS(homeLast), pctBTTS(awayLast));

  const avgHome = avgGFGA(homeLast, homeTeamId);
  const avgAway = avgGFGA(awayLast, awayTeamId);

  const homeAvgTotal = avgTotalGoals(homeLast);
  const awayAvgTotal = avgTotalGoals(awayLast);
  const matchAvgTotal = combineFloat(homeAvgTotal, awayAvgTotal);

  const homeCS = cleanSheetPct(homeLast, homeTeamId);
  const awayCS = cleanSheetPct(awayLast, awayTeamId);

  const homeSplit = homeAwaySplit(homeLast, homeTeamId);
  const awaySplit = homeAwaySplit(awayLast, awayTeamId);

  const homeForm = formWDL(homeLast, homeTeamId);
  const awayForm = formWDL(awayLast, awayTeamId);

  // H2H league-only (last ~3 years)
  let h2hLeagueOnly: AnyRow[] = [];
  let leagueH2HErr: string | null = null;

  if (leagueId && season && homeTeamId && awayTeamId) {
    const seasonsToTry = buildSeasonList(season, 2);
    try {
      const allEvents: AnyRow[] = [];
      for (const s of seasonsToTry) {
        const evs = await fetchLeagueSeasonEvents(key, leagueId, s);
        allEvents.push(...evs);
      }
      h2hLeagueOnly = h2hFromLeagueEvents({
        leagueEvents: allEvents,
        homeTeamId,
        awayTeamId,
        withinYears: 3,
      }).filter((e) => toNum(e.intHomeScore) !== null && toNum(e.intAwayScore) !== null);
    } catch (e: any) {
      leagueH2HErr = e?.message ?? "Failed to load league events for H2H";
    }
  }

  // ✅ NEW: past matches in the league (last 5 days)
  let recentLeagueFinished: AnyRow[] = [];
  let recentErr: string | null = null;

  if (leagueId) {
    try {
      const pastJson = await safeJson(
        `https://www.thesportsdb.com/api/v1/json/${key}/eventspastleague.php?id=${encodeURIComponent(leagueId)}`
      );
      const past = (pastJson?.events ?? pastJson?.results ?? []) as AnyRow[];
      recentLeagueFinished = filterLastNDaysFinished(past, 5);
    } catch (e: any) {
      recentErr = e?.message ?? "Failed to load recent league results";
    }
  }

  const title = event.strEvent || `${event.strHomeTeam} vs ${event.strAwayTeam}`;

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-12">
        <Link href="/" className="text-sm text-neutral-300 hover:text-white">
          ← Back
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-neutral-300">
          <span>
            {event.dateEvent} {event.strTime ? `• ${event.strTime}` : ""}{" "}
            {event.strVenue ? `• ${event.strVenue}` : ""}{" "}
            {event.strLeague ? `• ${event.strLeague}` : ""}
          </span>

          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${dq.cls}`}
          >
            DATA: {dq.label}
          </span>

          <span className="text-xs text-neutral-500">
            Last finished matches: {homeLast.length}/5 + {awayLast.length}/5
          </span>
        </div>

        {/* ✅ NEW BLOCK: Recent finished matches in this league */}
        <div className="mt-4">
          {recentErr ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              Failed to load recent league results: {recentErr}
            </div>
          ) : (
            <MatchList
              title={`Recent finished matches in ${event.strLeague ?? "this league"} (last 5 days)`}
              events={recentLeagueFinished}
              emptyText="No finished matches found in the last 5 days."
            />
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Form (last 5)</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-neutral-300">{event.strHomeTeam}</div>
              <FormPills form={homeForm} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-neutral-300">{event.strAwayTeam}</div>
              <FormPills form={awayForm} />
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-500">W = win, D = draw, L = loss</p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Quick stats (last 5)</h2>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-neutral-400">Avg total goals</div>
              <div className="mt-1 text-lg font-semibold">{matchAvgTotal ?? "—"}</div>
              <div className="mt-1 text-xs text-neutral-500">Combined from both teams</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-neutral-400">{event.strHomeTeam} clean sheets</div>
              <div className="mt-1 text-lg font-semibold">
                {homeCS === null ? "—" : `${homeCS}%`}
              </div>
              <div className="mt-1 text-xs text-neutral-500">Based on last 5 finished</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-neutral-400">{event.strAwayTeam} clean sheets</div>
              <div className="mt-1 text-lg font-semibold">
                {awayCS === null ? "—" : `${awayCS}%`}
              </div>
              <div className="mt-1 text-xs text-neutral-500">Based on last 5 finished</div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Home / Away split (last 5)</h2>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">{event.strHomeTeam}</div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-neutral-400">Home matches</div>
                  <div className="mt-1 text-sm text-neutral-300">
                    Avg GF:{" "}
                    <span className="text-white font-semibold">{homeSplit.homeGF ?? "—"}</span>
                  </div>
                  <div className="text-sm text-neutral-300">
                    Avg GA:{" "}
                    <span className="text-white font-semibold">{homeSplit.homeGA ?? "—"}</span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">Games: {homeSplit.homeN}</div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-neutral-400">Away matches</div>
                  <div className="mt-1 text-sm text-neutral-300">
                    Avg GF:{" "}
                    <span className="text-white font-semibold">{homeSplit.awayGF ?? "—"}</span>
                  </div>
                  <div className="text-sm text-neutral-300">
                    Avg GA:{" "}
                    <span className="text-white font-semibold">{homeSplit.awayGA ?? "—"}</span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">Games: {homeSplit.awayN}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">{event.strAwayTeam}</div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-neutral-400">Home matches</div>
                  <div className="mt-1 text-sm text-neutral-300">
                    Avg GF:{" "}
                    <span className="text-white font-semibold">{awaySplit.homeGF ?? "—"}</span>
                  </div>
                  <div className="text-sm text-neutral-300">
                    Avg GA:{" "}
                    <span className="text-white font-semibold">{awaySplit.homeGA ?? "—"}</span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">Games: {awaySplit.homeN}</div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-neutral-400">Away matches</div>
                  <div className="mt-1 text-sm text-neutral-300">
                    Avg GF:{" "}
                    <span className="text-white font-semibold">{awaySplit.awayGF ?? "—"}</span>
                  </div>
                  <div className="text-sm text-neutral-300">
                    Avg GA:{" "}
                    <span className="text-white font-semibold">{awaySplit.awayGA ?? "—"}</span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">Games: {awaySplit.awayN}</div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            Note: split is calculated only from the last 5 finished matches available.
          </p>
        </div>

        <div className="mt-4">
          {leagueH2HErr ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              Failed to load league-only H2H: {leagueH2HErr}
            </div>
          ) : (
            <MatchList
              title={`H2H in ${event.strLeague ?? "this league"} (last ~3 years)`}
              events={h2hLeagueOnly}
              emptyText="No league-only H2H found in last ~3 years (or TheSportsDB league-season endpoint is not available on your plan)."
            />
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <YesNoBox
            title="Over 2.5 (match)"
            yesPct={overYes}
            homeN={homeLast.length}
            awayN={awayLast.length}
            dqLabel={dq.label}
          />
          <YesNoBox
            title="BTTS (match)"
            yesPct={bttsYes}
            homeN={homeLast.length}
            awayN={awayLast.length}
            dqLabel={dq.label}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Goals (last 5 finished)</h2>
          <p className="mt-2 text-neutral-300">
            {event.strHomeTeam}: Avg GF {avgHome.gf ?? "—"} / Avg GA {avgHome.ga ?? "—"}{" "}
            <span className="text-neutral-500">(based on last 5)</span>
          </p>
          <p className="mt-1 text-neutral-300">
            {event.strAwayTeam}: Avg GF {avgAway.gf ?? "—"} / Avg GA {avgAway.ga ?? "—"}{" "}
            <span className="text-neutral-500">(based on last 5)</span>
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MatchList
            title={`${event.strHomeTeam} - Last 5`}
            events={homeLast}
            emptyText="No finished matches found."
          />
          <MatchList
            title={`${event.strAwayTeam} - Last 5`}
            events={awayLast}
            emptyText="No finished matches found."
          />
        </div>
      </div>
    </main>
  );
}
