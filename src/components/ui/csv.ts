export interface CsvColumn<T = any> { header: string; value: (row: T) => string | number | null | undefined }

/** Excel-friendly CSV (UTF-8 BOM so Persian text opens correctly). */
export function exportCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.header)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => esc(c.value(r))).join(','));
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/** Pure helper (kept separate for tests). */
export function buildCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => esc(c.header)).join(','), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(','))].join('\r\n');
}
