"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function loginErrorMessage(message: string, code?: string) {
  const text = `${code ?? ""} ${message}`.toLowerCase();
  if (text.includes("email_not_confirmed") || text.includes("not confirmed")) {
    return "Email non confermata. In Supabase → Authentication → Users apri l’utente e conferma l’email (oppure ricrealo con “Auto Confirm User”).";
  }
  if (
    text.includes("invalid api key") ||
    text.includes("jwt") ||
    text.includes("malformed")
  ) {
    return "Chiave API non valida. In .env.local usa l’anon key o la publishable key completa (non un pezzo), poi riavvia npm run dev.";
  }
  if (text.includes("failed to fetch") || text.includes("network")) {
    return "Impossibile raggiungere Supabase. Controlla NEXT_PUBLIC_SUPABASE_URL (solo https://xxxx.supabase.co, senza /rest/v1).";
  }
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "Email o password non corretti.";
  }
  return message || "Accesso non riuscito.";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(loginErrorMessage(signInError.message, signInError.code));
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("activity_log").insert({
        actor_id: user.id,
        action: "login",
        entity_type: "session",
        summary: "Ha effettuato l'accesso",
      });
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#100815] px-4">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-fuchsia-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-700/20 blur-3xl" />

      <Card className="relative w-full max-w-sm overflow-hidden border-white/10 shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-fuchsia-500 via-amber-400 to-fuchsia-500" />
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 h-28 w-28 overflow-hidden rounded-xl bg-white shadow-[0_0_24px_rgba(168,85,247,0.35)]">
            <BrandLogo size={112} priority />
          </div>
          <CardTitle className="text-xl">Dark Ghost Cards</CardTitle>
          <CardDescription>
            Accedi con le credenziali fornite dal team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="tu@esempio.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Accesso in corso..." : "Accedi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
