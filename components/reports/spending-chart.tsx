type ChartPoint = {
  label: string;
  purchases: number;
  sales: number;
};

export function SpendingChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.purchases, d.sales]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Acquisti
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Vendite
        </span>
      </div>

      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nessun dato nel periodo selezionato.
        </p>
      ) : (
        <div className="flex items-end gap-3 overflow-x-auto pb-2">
          {data.map((point) => (
            <div
              key={point.label}
              className="flex min-w-[40px] flex-1 flex-col items-center gap-2"
            >
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <div
                  className="w-3 rounded-t bg-amber-500/80"
                  style={{
                    height: `${Math.max(2, (point.purchases / max) * 100)}%`,
                  }}
                  title={`Acquisti: €${point.purchases.toFixed(2)}`}
                />
                <div
                  className="w-3 rounded-t bg-emerald-500/80"
                  style={{
                    height: `${Math.max(2, (point.sales / max) * 100)}%`,
                  }}
                  title={`Vendite: €${point.sales.toFixed(2)}`}
                />
              </div>
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                {point.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
