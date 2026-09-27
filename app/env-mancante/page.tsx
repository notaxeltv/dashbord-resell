export default function MissingEnvPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100815] px-4 py-12 text-white">
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-white/10 bg-white/5 p-6 shadow-2xl">
        <p className="text-sm font-medium text-amber-300">Configurazione locale</p>
        <h1 className="text-2xl font-bold">Mancano le chiavi Supabase</h1>
        <p className="text-sm text-white/75">
          In <code className="rounded bg-black/40 px-1.5 py-0.5">.env.local</code>{" "}
          c’è solo il token CardTrader. Per avviare la dashboard in locale servono
          anche URL e anon key, le stesse già messe su Vercel.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-white/80">
          <li>
            Apri il progetto su Vercel → Settings → Environment Variables, oppure
            Supabase → Project Settings → API.
          </li>
          <li>
            Copia <code className="rounded bg-black/40 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            in <code className="rounded bg-black/40 px-1.5 py-0.5">.env.local</code>{" "}
            (non cancellare <code className="rounded bg-black/40 px-1.5 py-0.5">CARDTRADER_API_TOKEN</code>).
          </li>
          <li>Riavvia <code className="rounded bg-black/40 px-1.5 py-0.5">npm run dev</code>.</li>
        </ol>
        <p className="text-xs text-white/50">
          Quelle variabili sono pubbliche di design (anon key): non vanno committate,
          ma servono sul tuo PC. Il file .env.local è già in .gitignore.
        </p>
      </div>
    </main>
  );
}
