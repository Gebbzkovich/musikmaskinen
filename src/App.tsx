import { supabase } from './lib/supabase'

// Bootstrap placeholder. The real genre-map UI arrives in the Fas 0 build.
// `supabase` is imported here so the client wiring is exercised by the type
// checker and bundler from day one.
void supabase

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
        Musikmaskinen
      </h1>
      <p className="max-w-prose text-balance text-sm opacity-70 sm:text-base">
        En interaktiv karta över musikgenrer. Bootstrap klar — kartan byggs i
        Fas&nbsp;0.
      </p>
    </main>
  )
}

export default App
