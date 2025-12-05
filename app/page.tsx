import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

const TOP_LEAGUE_IDS = ["4328", "4335", "4332", "4331", "4334"];

const CAT_LABEL: Record<string, string> = {
  domestic_league: "League",
  domestic_cup: "Cup",
  international: "International",
};

export default async function HomePage(props: {
  searchParams?:
    | { q?: string; country?: string; cat?: string }
    | Promise<{ q?: string; country?: string; cat?: string }>;
}) {
  const sp = await Promise.resolve(props.searchParams);
  const q = typeof sp?.q === "string" ? sp.q.trim() : "";
  const country = typeof sp?.country === "string" ? sp.country.trim() : "";
  const cat = typeof sp?.cat === "string" ? sp.cat.trim() : "";

  // Top 5
  const { data: topLeagues, error: topErr } = await supabase
    .from("leagues")
    .select("id,name,country,sport,active,thesportsdb_league_id")
    .eq("sport", "soccer")
    .eq("active", true)
    .in("thesportsdb_league_id", TOP_LEAGUE_IDS as any)
    .order("name", { ascending: true });

  // Country dropdown options
  const { data: countriesRaw, error: countriesErr } = await supabase
    .from("leagues")
    .select("country_slug,country")
    .eq("sport", "soccer")
    .not("country_slug", "is", null)
    .order("country", { ascending: true })
    .limit(3000);

  const map = new Map<string, string>();
  for (const r of countriesRaw ?? []) {
    const slug = String((r as any).country_slug ?? "").trim();
    const label = String((r as any).country ?? "").trim();
    // evita meter "international" como país
    if (slug && label && slug !== "international" && !map.has(slug)) map.set(slug, label);
  }

  const countryOptions = Array.from(map.entries())
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Browse results
  let browseQ = supabase
    .from("leagues")
    .select("id,name,country,active,category,country_slug,thesportsdb_league_id")
    .eq("sport", "soccer");

  if (q) browseQ = browseQ.ilike("name", `%${q}%`);
  if (country) browseQ = browseQ.eq("country_slug", country);
  if (cat) browseQ = browseQ.eq("category", cat);

  const noFilters = !q && !country && !cat;
  if (noFilters) browseQ = browseQ.eq("active", true);

  const { data: browseLeagues, error: browseErr } = await browseQ
    .order("name", { ascending: true })
    .limit(noFilters ? 25 : 80);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="px-6 pt-10 pb-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold tracking-tight">SmartKick</h1>
          <p className="mt-2 text-neutral-300">Picks + stats, simple and fast.</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/live"
              className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Today Picks →
            </Link>

            <a
              href="#browse"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-200 hover:bg-white/10"
            >
              Browse ↓
            </a>
          </div>
        </div>
      </header>

      {/* TOP LEAGUES */}
      <section className="px-6 pb-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-lg font-semibold">Top leagues</h2>

          {topErr ? (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              Error loading top leagues: {topErr.message}
            </div>
          ) : !topLeagues || topLeagues.length === 0 ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-neutral-300">
              No top leagues found.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {topLeagues.map((l: any) => (
                <Link
                  key={l.id}
                  href={`/league/${l.id}`}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold">{l.name}</div>
                      <div className="mt-1 text-sm text-neutral-300">{l.country} • soccer</div>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                      ACTIVE
                    </span>
                  </div>
                  <div className="mt-4 text-sm text-neutral-300">Open league →</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* BROWSE */}
      <section id="browse" className="px-6 pb-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-lg font-semibold">Browse</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Search by name or filter by country and category.
          </p>

          <form action="/" className="mt-4 flex flex-wrap gap-3">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search leagues… (MLS, Liga MX, UEFA)"
              className="w-72 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-neutral-400 outline-none focus:border-white/20"
            />

            {/* IMPORTANT: no text-white here, so dropdown items are visible */}
            <select
              name="country"
              defaultValue={country}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-100 outline-none focus:border-white/20"
            >
              <option value="" className="text-black">
                All countries
              </option>
              {countriesErr ? (
                <option value="" className="text-black">
                  (Failed to load countries)
                </option>
              ) : (
                countryOptions.map((c) => (
                  <option key={c.slug} value={c.slug} className="text-black">
                    {c.label}
                  </option>
                ))
              )}
            </select>

            <select
              name="cat"
              defaultValue={cat}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-100 outline-none focus:border-white/20"
            >
              <option value="" className="text-black">
                All categories
              </option>
              <option value="domestic_league" className="text-black">
                Leagues
              </option>
              <option value="domestic_cup" className="text-black">
                Cups
              </option>
              <option value="international" className="text-black">
                International
              </option>
            </select>

            <button className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15">
              Apply
            </button>

            {(q || country || cat) && (
              <Link
                href="/"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Clear
              </Link>
            )}
          </form>

          {browseErr ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              Error loading leagues: {browseErr.message}
            </div>
          ) : !browseLeagues || browseLeagues.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-neutral-300">
              No leagues found.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {browseLeagues.map((l: any) => (
                <Link
                  key={l.id}
                  href={`/league/${l.id}`}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold">{l.name}</div>
                      <div className="mt-1 text-sm text-neutral-300">
                        {l.country} • {CAT_LABEL[l.category] ?? l.category ?? "—"}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        ID: {l.thesportsdb_league_id ?? "—"}
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        l.active
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-neutral-500/15 text-neutral-200"
                      }`}
                    >
                      {l.active ? "ACTIVE" : "OFF"}
                    </span>
                  </div>

                  <div className="mt-4 text-sm text-neutral-300">Open league →</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
