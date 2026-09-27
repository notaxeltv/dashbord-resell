import { JapanImportEstimator } from "@/components/import/japan-import-estimator";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import Giappone</h1>
        <p className="text-sm text-muted-foreground">
          Stima spedizione, dazio e IVA per un acquisto dal Giappone verso
          l’Italia. Utile prima di chiudere un lotto su proxy, Yahoo o mercatini.
        </p>
      </div>
      <JapanImportEstimator />
    </div>
  );
}
