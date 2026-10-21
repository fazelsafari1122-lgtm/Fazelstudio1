import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal.tsx';
import { Btn, Field, inputCls, TagChip } from './Common.tsx';
import { PersianDatePicker } from './PersianDatePicker.tsx';
import { studio } from '../../services/studioApi.ts';
import { useUi } from './UiProvider.tsx';
import { errMsg } from '../../hooks.ts';

const emptyPerson = () => ({ first_name: '', last_name: '', phone: '', birth_date: '', job: '', notes: '' });
const emptyChild = () => ({ first_name: '', last_name: '', gender: '', birth_date: '', notes: '' });

interface Props {
  open: boolean;
  familyId?: number | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}

export const FamilyFormModal: React.FC<Props> = ({ open, familyId, onClose, onSaved }) => {
  const ui = useUi();
  const [form, setForm] = useState<any>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    studio.tags().then(setTags).catch(() => setTags([]));
    studio.meta().then((m) => setSources(m.lookups?.source || [])).catch(() => undefined);
    if (!familyId) {
      setForm({ family_name: '', source: 'Instagram', notes: '', father: emptyPerson(), mother: emptyPerson(), children: [], tag_ids: [] });
      return;
    }
    setForm(null);
    studio.family(familyId).then((d) => {
      const get = (role: string) => d.members.find((m: any) => m.role === role) || emptyPerson();
      setForm({
        family_name: d.family.family_name, source: d.family.source || '', notes: d.family.notes || '',
        father: { ...emptyPerson(), ...get('father') }, mother: { ...emptyPerson(), ...get('mother') },
        children: d.members.filter((m: any) => m.role === 'child').map((c: any) => ({ ...emptyChild(), ...c })),
        tag_ids: d.tags.map((t: any) => t.id),
      });
    }).catch((e) => { ui.error(e); onClose(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familyId]);

  const setPerson = (who: 'father' | 'mother', k: string, v: string) => setForm((f: any) => ({ ...f, [who]: { ...f[who], [k]: v } }));
  const setChild = (i: number, k: string, v: string) => setForm((f: any) => ({ ...f, children: f.children.map((c: any, j: number) => (j === i ? { ...c, [k]: v } : c)) }));
  const toggleTag = (id: number) => setForm((f: any) => ({ ...f, tag_ids: f.tag_ids.includes(id) ? f.tag_ids.filter((x: number) => x !== id) : [...f.tag_ids, id] }));

  const save = async (force = false) => {
    setError('');
    setSaving(true);
    try {
      const payload = { ...form, force };
      const r = familyId ? await studio.updateFamily(familyId, payload) : await studio.createFamily(payload);
      ui.success();
      onSaved(r.id);
    } catch (e: any) {
      if (e?.data?.duplicate && await ui.confirm(`${e.message} آیا مایل به ثبت با همین شماره هستید؟`, { danger: false, confirmLabel: 'بله، ثبت شود' })) {
        setSaving(false);
        return save(true);
      }
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const person = (who: 'father' | 'mother', title: string) => (
    <fieldset className="border border-slate-800 rounded-2xl p-3">
      <legend className="px-2 text-xs font-semibold text-amber-300">{title}</legend>
      <div className="grid grid-cols-2 gap-3">
        <Field label="نام"><input className={inputCls} value={form[who].first_name} onChange={(e) => setPerson(who, 'first_name', e.target.value)} /></Field>
        <Field label="نام خانوادگی"><input className={inputCls} value={form[who].last_name} placeholder={form.family_name} onChange={(e) => setPerson(who, 'last_name', e.target.value)} /></Field>
        <Field label="موبایل"><input className={inputCls} dir="ltr" inputMode="tel" placeholder="09121234567" value={form[who].phone || ''} onChange={(e) => setPerson(who, 'phone', e.target.value)} /></Field>
        <Field label="تاریخ تولد"><PersianDatePicker allowClear value={form[who].birth_date || ''} onChange={(v) => setPerson(who, 'birth_date', v)} /></Field>
        <Field label="شغل"><input className={inputCls} value={form[who].job || ''} onChange={(e) => setPerson(who, 'job', e.target.value)} /></Field>
        <Field label="توضیحات"><input className={inputCls} value={form[who].notes || ''} onChange={(e) => setPerson(who, 'notes', e.target.value)} /></Field>
      </div>
    </fieldset>
  );

  return (
    <Modal open={open} onClose={onClose} size="lg" title={familyId ? 'ویرایش خانواده' : 'ثبت خانواده جدید'}
      footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} disabled={!form} onClick={() => save(false)}>ذخیره</Btn></>}>
      {!form ? <div className="py-10 text-center text-slate-400 text-sm">در حال بارگذاری...</div> : (
        <div className="space-y-4">
          {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="نام خانوادگی (نام خانواده)" required><input className={inputCls} value={form.family_name} onChange={(e) => setForm({ ...form, family_name: e.target.value })} autoFocus /></Field>
            <Field label="منبع آشنایی">
              <input list="family-sources" className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
              <datalist id="family-sources">{['Instagram', 'معرفی دوستان', 'تلگرام', 'گوگل', 'مراجعه حضوری', ...sources].map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="توضیحات"><input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          {person('father', 'پدر / آقا')}
          {person('mother', 'مادر / خانم')}
          <fieldset className="border border-slate-800 rounded-2xl p-3">
            <legend className="px-2 text-xs font-semibold text-amber-300">فرزندان</legend>
            <div className="space-y-3">
              {form.children.map((c: any, i: number) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end bg-slate-950/50 rounded-xl p-2">
                  <Field label="نام"><input className={inputCls} value={c.first_name} onChange={(e) => setChild(i, 'first_name', e.target.value)} /></Field>
                  <Field label="نام خانوادگی"><input className={inputCls} value={c.last_name || ''} placeholder={form.family_name} onChange={(e) => setChild(i, 'last_name', e.target.value)} /></Field>
                  <Field label="جنسیت">
                    <select className={inputCls} value={c.gender || ''} onChange={(e) => setChild(i, 'gender', e.target.value)}>
                      <option value="">—</option><option value="پسر">پسر</option><option value="دختر">دختر</option>
                    </select>
                  </Field>
                  <Field label="تاریخ تولد"><PersianDatePicker allowClear value={c.birth_date || ''} onChange={(v) => setChild(i, 'birth_date', v)} /></Field>
                  <div className="flex items-end gap-2">
                    <Field label="توضیحات" className="flex-1"><input className={inputCls} value={c.notes || ''} onChange={(e) => setChild(i, 'notes', e.target.value)} /></Field>
                    <Btn variant="ghost" size="sm" aria-label="حذف فرزند" onClick={() => setForm({ ...form, children: form.children.filter((_: any, j: number) => j !== i) })}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>
                  </div>
                </div>
              ))}
              <Btn size="sm" onClick={() => setForm({ ...form, children: [...form.children, emptyChild()] })}><Plus className="w-4 h-4" />افزودن فرزند</Btn>
            </div>
          </fieldset>
          <div>
            <div className="text-xs text-slate-400 mb-2">تگ‌ها</div>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button key={t.id} type="button" onClick={() => toggleTag(t.id)} className={`transition-opacity ${form.tag_ids.includes(t.id) ? '' : 'opacity-40 hover:opacity-80'}`}>
                  <TagChip name={t.name} color={t.color} />
                </button>
              ))}
              {tags.length === 0 && <span className="text-xs text-slate-500">تگی تعریف نشده است.</span>}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
