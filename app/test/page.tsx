import { supabase } from "../../lib/supabaseClient";


export default async function TestPage() {
  const { data, error } = await supabase.from("leagues").select("*").limit(5);

  return (
    <main className="p-6 font-sans">
      <h1 className="text-2xl font-bold">Supabase Connection Test</h1>

      {error && (
        <pre className="mt-4 rounded bg-red-50 p-4 text-red-700">
          {JSON.stringify(error, null, 2)}
        </pre>
      )}

      <pre className="mt-4 rounded bg-slate-50 p-4">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}
