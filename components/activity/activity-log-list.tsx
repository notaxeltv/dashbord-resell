"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { RegistroDeleteDialog } from "@/components/activity/registro-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/dates";
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_ENTITY_LABELS,
  actorLabel,
} from "@/lib/activity";
import { SELECT_NONE } from "@/lib/constants";
import type { ActivityLog, Profile } from "@/lib/types";

const FILTERS = [
  { value: "all", label: "Tutti" },
  { value: "card", label: "Carte" },
  { value: "purchase", label: "Lotti" },
  { value: "sale", label: "Vendite" },
  { value: "transaction", label: "Extra" },
  { value: "session", label: "Accessi" },
] as const;

const ACTION_FILTERS = [
  { value: SELECT_NONE, label: "Tutte le azioni" },
  { value: "insert", label: "Creato" },
  { value: "update", label: "Modificato" },
  { value: "delete", label: "Eliminato" },
  { value: "login", label: "Accesso" },
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
  const [actionFilter, setActionFilter] = useState<string>(SELECT_NONE);
  const [authorFilter, setAuthorFilter] = useState<string>(SELECT_NONE);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string[] | null | undefined>(
    undefined,
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const authors = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; label: string }[] = [];
    for (const entry of entries) {
      if (!entry.actor_id || seen.has(entry.actor_id)) continue;
      seen.add(entry.actor_id);
      list.push({ id: entry.actor_id, label: actorLabel(profileMap.get(entry.actor_id)) });
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [entries, profileMap]);

  const visible = useMemo(
    () =>
      entries.filter((entry) => {
        if (filter !== "all" && entry.entity_type !== filter) return false;
        if (actionFilter !== SELECT_NONE && entry.action !== actionFilter) return false;
        if (authorFilter !== SELECT_NONE && entry.actor_id !== authorFilter) return false;
        return true;
      }),
    [entries, filter, actionFilter, authorFilter],
  );

  function exportCsv() {
    downloadCsv(
      `registro-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Data e ora", "Autore", "Categoria", "Azione", "Descrizione"],
      visible.map((entry) => [
        formatDateTime(entry.created_at),
        actorLabel(entry.actor_id ? profileMap.get(entry.actor_id) : undefined),
        ACTIVITY_ENTITY_LABELS[entry.entity_type] ?? entry.entity_type,
        ACTIVITY_ACTION_LABELS[entry.action] ?? entry.action,
        entry.summary,
      ]),
    );
  }

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={authorFilter} onValueChange={setAuthorFilter}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Tutti gli autori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_NONE}>Tutti gli autori</SelectItem>
            {authors.map((author) => (
              <SelectItem key={author.id} value={author.id}>
                {author.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="sm:ml-auto"
          disabled={visible.length === 0}
          onClick={exportCsv}
        >
          <Download className="mr-2 h-4 w-4" />
          Esporta CSV
        </Button>
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
