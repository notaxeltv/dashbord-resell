"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegistroDeleteDialog({
  open,
  targetIds,
  onOpenChange,
}: {
  open: boolean;
  targetIds: string[] | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"ask" | "codes">("ask");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [emailA, setEmailA] = useState("");
  const [emailB, setEmailB] = useState("");
  const [codeA, setCodeA] = useState("");
  const [codeB, setCodeB] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep("ask");
    setChallengeId(null);
    setEmailA("");
    setEmailB("");
    setCodeA("");
    setCodeB("");
    setError(null);
    setLoading(false);
  }

  async function sendKeys() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/registro/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: targetIds }),
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      challengeId?: string;
      emailA?: string;
      emailB?: string;
    } | null;
    setLoading(false);
    if (!response.ok || !payload?.challengeId) {
      setError(payload?.error ?? "Invio non riuscito.");
      return;
    }
    setChallengeId(payload.challengeId);
    setEmailA(payload.emailA ?? "prima email");
    setEmailB(payload.emailB ?? "seconda email");
    setStep("codes");
  }

  async function confirm() {
    if (!challengeId) return;
    setLoading(true);
    setError(null);
    const response = await fetch("/api/registro/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, codeA, codeB }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);
    if (!response.ok) {
      setError(payload?.error ?? "Chiavi non accettate.");
      return;
    }
    onOpenChange(false);
    reset();
    router.refresh();
  }

  const scopeLabel =
    targetIds == null
      ? "tutto il registro visibile e precedente"
      : `${targetIds.length} voci selezionate`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Elimina dal registro</DialogTitle>
          <DialogDescription>
            Per cancellare {scopeLabel} servono due chiavi diverse, una per
            ciascuna email del team. Scadono dopo 10 minuti.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        {step === "codes" && (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="code-a">Chiave inviata a {emailA}</Label>
              <Input
                id="code-a"
                value={codeA}
                autoComplete="off"
                onChange={(event) => setCodeA(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code-b">Chiave inviata a {emailB}</Label>
              <Input
                id="code-b"
                value={codeB}
                autoComplete="off"
                onChange={(event) => setCodeB(event.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "ask" ? (
            <Button type="button" onClick={sendKeys} disabled={loading}>
              {loading ? "Invio..." : "Invia le due chiavi"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={confirm}
              disabled={loading || codeA.trim().length < 4 || codeB.trim().length < 4}
            >
              {loading ? "Verifica..." : "Elimina"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
