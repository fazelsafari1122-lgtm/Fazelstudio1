import React, { useState, useEffect } from 'react';
import {
  Sparkles, Plus, Search, Filter, Edit3, CheckCircle,
  X, DollarSign, Tag
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { Service } from '../types.ts';
import { formatCurrency, toPersianDigits } from '../utils/jalali.ts';

export const ServicesView: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'تصویربرداری',
    description: '',
    price: 0,
    unit: 'مراسم',
    is_active: 1
  });
  const [saving, setSaving] = useState(false);

  const loadServices = async () => {
    try {
      setLoading(true);
      const list = await api.getServices();
      setServices(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const categories = Array.from(new Set(services.map(s => s.category)));

  const handleOpenAdd = (s?: Service) => {
    if (s) {
      setEditingService(s);
      setFormData({
        code: s.code || '',
        name: s.name || '',
        category: s.category || 'تصویربرداری',
        description: s.description || '',
        price: s.price || 0,
        unit: s.unit || 'مراسم',
        is_active: s.is_active ?? 1
      });
    } else {
      setEditingService(null);
      setFormData({
        code: `SRV-${Date.now().toString().slice(-4)}`,
        name: '',
        category: 'تصویربرداری',
        description: '',
        price: 0,
        unit: 'مراسم',
        is_active: 1
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingService) {
        await api.updateService(editingService.id, formData);
      } else {
        await api.createService(formData);
      }
      setShowModal(false);
      loadServices();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت خدمت');
    } finally {
      setSaving(false);
    }
  };

  const filtered = services.filter(s => {
    const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            کاتالوگ خدمات و تعرفه‌های استودیو
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            لیست پکیج‌های فیلمبرداری سینمایی، عکاسی پرتره، هلی‌شات و تدوین کلیپ
          </p>
        </div>
        <button
          onClick={() => handleOpenAdd()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>تعریف خدمت جدید</span>
        </button>
      </div>

      {/* Category filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs w-full sm:w-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
              selectedCategory === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            همه خدمات ({toPersianDigits(services.length)})
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                selectedCategory === c ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام خدمت، کد..."
            className="w-full bg-slate-900 text-xs text-slate-100 placeholder:text-slate-500 border border-slate-700/80 rounded-lg pr-8 pl-3 py-2 focus:outline-none focus:border-amber-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">کد</th>
                <th className="p-3.5">عنوان خدمت</th>
                <th className="p-3.5">دسته‌بندی</th>
                <th className="p-3.5 text-center">واحد شمارش</th>
                <th className="p-3.5 text-left">تعرفه مصوب</th>
                <th className="p-3.5 text-center">وضعیت</th>
                <th className="p-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 font-mono text-amber-400">{s.code}</td>
                  <td className="p-3.5">
                    <strong className="text-white block">{s.name}</strong>
                    {s.description && <span className="text-slate-400 text-[11px]">{s.description}</span>}
                  </td>
                  <td className="p-3.5 text-slate-300">{s.category}</td>
                  <td className="p-3.5 text-center text-slate-400">{s.unit}</td>
                  <td className="p-3.5 text-left font-bold text-amber-400">{formatCurrency(s.price)}</td>
                  <td className="p-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {s.is_active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => handleOpenAdd(s)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                {editingService ? 'ویرایش خدمت' : 'تعریف خدمت جدید'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">کد خدمت *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">دسته‌بندی</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">عنوان خدمت *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  placeholder="مثال: تصویربرداری کرین با اپراتور تخصصی"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">تعرفه مصوب (تومان) *</label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">واحد شمارش</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                    placeholder="مراسم / ساعت / قطعه"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">توضیحات و مشخصات فنی</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {saving ? 'در حال ثبت...' : 'ذخیره خدمت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
