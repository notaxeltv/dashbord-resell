"use client";

import { useMemo, useState } from "react";

import { RegistroDeleteDialog } from "@/components/activity/registro-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/dates";
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_ENTITY_LABELS,
  actorLabel,
} from "@/lib/activity";
import type { ActivityLog, Profile } from "@/lib/types";

const FILTERS = [
  { value: "all", label: "Tutti" },
  { value: "card", label: "Carte" },
  { value: "purchase", label: "Lotti" },
  { value: "sale", label: "Vendite" },
  { value: "transaction", label: "Extra" },
  { value: "session", label: "Accessi" },
] as const;

function actionVariant(
  action: string,
): "default" | "secondary" | "success" | "warning" | "destructive" {
  if (action === "insert" || action === "login") return "success";
  if (action === "update") return "warning";
  if (action === "delete") return "destructive";
  return "secondary";
}

export function ActivityLogList({
  entries,
  profiles,
}: {
  entries: ActivityLog[];
  profiles: Profile[];
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string[] | null | undefined>(
    undefined,
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const visible = useMemo(
    () =>
      filter === "all"
        ? entries
        : entries.filter((entry) => entry.entity_type === filter),
    [entries, filter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "default" : "outline"}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selected.length === 0}
            onClick={() => setDeleteTarget(selected)}
          >
            Elimina selezionate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={entries.length === 0}
            onClick={() => setDeleteTarget(null)}
          >
            Svuota registro
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nessuna azione in questo filtro.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {visible.map((entry) => {
            const actor = entry.actor_id
              ? profileMap.get(entry.actor_id)
              : undefined;
            return (
              <li
                key={entry.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.includes(entry.id)}
                    onCheckedChange={(value) => {
                      setSelected((current) =>
                        value === true
                          ? [...current, entry.id]
                          : current.filter((id) => id !== entry.id),
                      );
                    }}
                    aria-label="Seleziona voce"
                    className="mt-1"
                  />
                  <div>
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{actorLabel(actor)}</span>{" "}
                    {entry.summary.replace(/^Ha /, "ha ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                  </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {ACTIVITY_ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
                  </Badge>
                  <Badge variant={actionVariant(entry.action)}>
                    {ACTIVITY_ACTION_LABELS[entry.action] ?? entry.action}
                  </Badge>
                </div>
              </li>
            );
          })}
          </ul>
        )}

      <RegistroDeleteDialog
        open={deleteTarget !== undefined}
        targetIds={deleteTarget ?? null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
        }}
      />
    </div>
  );
}
