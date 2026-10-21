import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Btn, EmptyState, ErrorState, LoadingState } from './Common.tsx';
import { exportCsv, CsvColumn } from './csv.ts';
import { toPersianDigits } from '../../utils/jalali.ts';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  /** plain value used for CSV export and sorting */
  value?: (row: T) => string | number | null | undefined;
  className?: string;
  sortable?: boolean;
  noExport?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  onAdd?: () => void;
  pageSize?: number;
  exportName?: string;
  emptyText?: string;
}

export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, onRowClick, onAdd, pageSize = 15, exportName, emptyText }: Props<T>) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.value) return rows;
    const get = col.value;
    return [...rows].sort((a, b) => {
      const x = get(a) ?? ''; const y = get(b) ?? '';
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
      return String(x).localeCompare(String(y), 'fa') * sort.dir;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = sorted.slice(cur * pageSize, cur * pageSize + pageSize);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const doExport = () => {
    const cols: CsvColumn<T>[] = columns.filter((c) => !c.noExport && c.value).map((c) => ({ header: c.header, value: c.value! }));
    exportCsv(exportName || 'export', cols, sorted);
  };

  return (
    <div>
      {exportName && rows.length > 0 && (
        <div className="flex justify-end mb-2">
          <Btn size="sm" onClick={doExport}><Download className="w-3.5 h-3.5" />خروجی اکسل</Btn>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState onAdd={onAdd} text={emptyText} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-900 text-slate-400 text-xs">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={`px-3 py-2.5 font-medium whitespace-nowrap ${c.className || ''} ${c.value && c.sortable !== false ? 'cursor-pointer select-none hover:text-slate-200' : ''}`}
                      onClick={() => c.value && c.sortable !== false && setSort(sort?.key === c.key ? { key: c.key, dir: (sort.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 })}>
                      {c.header}{sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {slice.map((r) => (
                  <tr key={rowKey(r)} onClick={() => onRowClick?.(r)} className={`hover:bg-slate-800/40 ${onRowClick ? 'cursor-pointer' : ''}`}>
                    {columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2.5 text-slate-200 ${c.className || ''}`}>
                        {c.render ? c.render(r) : (c.value ? String(c.value(r) ?? '') : '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
              <span>{toPersianDigits(sorted.length)} مورد</span>
              <div className="flex items-center gap-2">
                <Btn size="sm" variant="ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronRight className="w-4 h-4" />قبلی</Btn>
                <span>{toPersianDigits(cur + 1)} از {toPersianDigits(pages)}</span>
                <Btn size="sm" variant="ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>بعدی<ChevronLeft className="w-4 h-4" /></Btn>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
