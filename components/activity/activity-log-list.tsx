"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div>
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{actorLabel(actor)}</span>{" "}
                    {entry.summary.replace(/^Ha /, "ha ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                  </p>
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
    </div>
  );
}
