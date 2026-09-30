/** Utility per esportare tabelle in CSV lato client (nessuna chiamata server). */

function escapeCsvValue(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvValue).join(";")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(";"));
  }
  // BOM per far riconoscere l'UTF-8 a Excel.
  return `\uFEFF${lines.join("\n")}`;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
