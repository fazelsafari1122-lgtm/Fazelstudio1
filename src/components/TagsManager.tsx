import React, { useState } from 'react';
import { Trash2, Edit3, Check, X, Plus } from 'lucide-react';
import { studio } from '../services/studioApi.ts';
import { useAsync, notifyMetaChanged } from '../hooks.ts';
import { Btn, inputCls, LoadingState, ErrorState, TagChip, EmptyState } from './ui/Common.tsx';
import { useUi } from './ui/UiProvider.tsx';

const COLORS = ['#f59e0b', '#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#f87171', '#facc15'];

export const TagsManager: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const ui = useUi();
  const { data, loading, error, reload } = useAsync(() => studio.tags(), []);
  const [editing, setEditing] = useState<any>(null);

  const save = async (t: any) => {
    try {
      await studio.saveTag(t);
      ui.success();
      setEditing(null);
      notifyMetaChanged();
      await reload();
      onChanged?.();
    } catch (e) { ui.error(e); }
  };
  const remove = async (t: any) => {
    if (!(await ui.confirm(`آیا از حذف تگ «${t.name}» مطمئن هستید؟`))) return;
    try { await studio.deleteTag(t.id); ui.success('با موفقیت حذف شد'); notifyMetaChanged(); await reload(); onChanged?.(); } catch (e) { ui.error(e); }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const tags = data || [];

  return (
    <div className="space-y-3">
      <Btn size="sm" variant="primary" onClick={() => setEditing({ name: '', color: COLORS[tags.length % COLORS.length] })}><Plus className="w-4 h-4" />تگ جدید</Btn>
      {editing && !editing.id && (
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-xl p-2">
          <input className={`${inputCls} flex-1 min-w-[140px]`} placeholder="نام تگ" value={editing.name} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <div className="flex gap-1">{COLORS.map((c) => <button key={c} type="button" onClick={() => setEditing({ ...editing, color: c })} className={`w-6 h-6 rounded-full border-2 ${editing.color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} aria-label={c} />)}</div>
          <Btn size="sm" variant="primary" onClick={() => save(editing)}><Check className="w-4 h-4" /></Btn>
          <Btn size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Btn>
        </div>
      )}
      {tags.length === 0 && !editing && <EmptyState text="هنوز تگی تعریف نشده است" />}
      <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
        {tags.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            {editing?.id === t.id ? (
              <>
                <input className={`${inputCls} flex-1 min-w-[140px]`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <div className="flex gap-1">{COLORS.map((c) => <button key={c} type="button" onClick={() => setEditing({ ...editing, color: c })} className={`w-6 h-6 rounded-full border-2 ${editing.color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} aria-label={c} />)}</div>
                <Btn size="sm" variant="primary" onClick={() => save(editing)}><Check className="w-4 h-4" /></Btn>
                <Btn size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Btn>
              </>
            ) : (
              <>
                <TagChip name={t.name} color={t.color} />
                <span className="text-[11px] text-slate-500 flex-1">{t.usage_count} خانواده</span>
                <Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => setEditing({ ...t })}><Edit3 className="w-4 h-4" /></Btn>
                <Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => remove(t)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
