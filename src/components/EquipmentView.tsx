import React, { useState, useEffect } from 'react';
import {
  Camera, Plus, Search, Filter, Wrench, CheckCircle,
  AlertTriangle, DollarSign, History, Edit3, X, Image as ImageIcon
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { Equipment } from '../types.ts';
import { formatCurrency, toPersianDigits } from '../utils/jalali.ts';

interface EquipmentViewProps {
  initialCategory?: string;
}

export const EquipmentView: React.FC<EquipmentViewProps> = ({ initialCategory }) => {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [search, setSearch] = useState('');

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category_id: 1,
    brand: '',
    model: '',
    quantity: 1,
    purchase_price: 0,
    daily_rental_price: 0,
    serial_number: '',
    photo: '',
    description: '',
    status: 'available' as 'available' | 'rented' | 'maintenance' | 'retired'
  });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getEquipment();
      setEquipmentList(data.equipment);
      setCategories(data.categories);
      if (data.categories.length > 0 && !formData.category_id) {
        setFormData(prev => ({ ...prev, category_id: data.categories[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = (item?: Equipment) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        code: item.code || '',
        name: item.name || '',
        category_id: categories.find(c => c.name === item.category_name)?.id || 1,
        brand: item.brand || '',
        model: item.model || '',
        quantity: item.quantity || 1,
        purchase_price: item.purchase_price || 0,
        daily_rental_price: item.daily_rental_price || 0,
        serial_number: item.serial_number || '',
        photo: item.photo || '',
        description: item.description || '',
        status: item.status || 'available'
      });
    } else {
      setEditingItem(null);
      setFormData({
        code: `EQ-${Date.now().toString().slice(-4)}`,
        name: '',
        category_id: categories[0]?.id || 1,
        brand: '',
        model: '',
        quantity: 1,
        purchase_price: 0,
        daily_rental_price: 0,
        serial_number: '',
        photo: '',
        description: '',
        status: 'available'
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingItem) {
        await api.updateEquipment(editingItem.id, formData);
      } else {
        await api.createEquipment(formData);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت تجهیز');
    } finally {
      setSaving(false);
    }
  };

  const filtered = equipmentList.filter(eq => {
    const matchesCat = selectedCategory === 'all' || eq.category_name === selectedCategory;
    const matchesSearch = !search ||
      eq.name.toLowerCase().includes(search.toLowerCase()) ||
      eq.code.toLowerCase().includes(search.toLowerCase()) ||
      eq.brand?.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            انبار تجهیزات سینمایی و عکاسی استودیو
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت دوربین‌های سونی، لنزهای جی‌مستر، گیمبال، نورپردازی نانلایت و تجهیزات هوایی
          </p>
        </div>
        <button
          onClick={() => handleOpenAdd()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن تجهیز جدید به انبار</span>
        </button>
      </div>

      {/* Categories & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs w-full md:w-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
              selectedCategory === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            همه تجهیزات ({toPersianDigits(equipmentList.length)})
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.name)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                selectedCategory === c.name ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی مدل، برند، کد..."
            className="w-full bg-slate-900 text-xs text-slate-100 placeholder:text-slate-500 border border-slate-700/80 rounded-lg pr-8 pl-3 py-2 focus:outline-none focus:border-amber-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
        </div>
      </div>

      {/* Equipment Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
                <span className="text-[11px] font-mono text-amber-400 font-bold">{item.code}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  item.status === 'available'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : item.status === 'rented'
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-rose-500/15 text-rose-400'
                }`}>
                  {item.status === 'available' ? 'آماده به‌کار' : item.status === 'rented' ? 'در حال استفاده' : 'سرویس / تعمیر'}
                </span>
              </div>

              <h3 className="font-bold text-sm text-white mt-2 mb-1">{item.name}</h3>
              <p className="text-xs text-slate-400">{item.brand} {item.model ? `• ${item.model}` : ''}</p>

              <div className="space-y-1.5 text-xs text-slate-300 mt-3 pt-2 border-t border-slate-800/80">
                <div className="flex justify-between">
                  <span className="text-slate-400">موجودی انبار:</span>
                  <span className="font-bold text-white">{toPersianDigits(item.quantity)} عدد</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">اجاره روزانه:</span>
                  <span className="font-bold text-amber-400">{formatCurrency(item.daily_rental_price)}</span>
                </div>
                {item.serial_number && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">شماره سریال:</span>
                    <span className="font-mono text-slate-400">{item.serial_number}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => handleOpenAdd(item)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>ویرایش</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                {editingItem ? 'ویرایش مشخصات تجهیز' : 'افزودن تجهیز جدید'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">کد انبار *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">دسته‌بندی *</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">نام کامل تجهیز *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  placeholder="Sony FX3 Cinema Camera"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">برند سازنده</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                    placeholder="Sony, DJI, Aputure..."
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">مدل</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">تعداد موجود در انبار *</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">تعرفه اجاره روزانه (تومان) *</label>
                  <input
                    type="number"
                    value={formData.daily_rental_price}
                    onChange={(e) => setFormData({ ...formData, daily_rental_price: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-amber-400 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">شماره سریال دستگاه</label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">وضعیت دستگاه</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="available">آماده به‌کار در انبار</option>
                    <option value="rented">در حال استفاده در پروژه</option>
                    <option value="maintenance">تحت سرویس و تعمیر</option>
                    <option value="retired">از رده خارج شده</option>
                  </select>
                </div>
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
                  {saving ? 'در حال ثبت...' : (editingItem ? 'ذخیره تغییرات' : 'ثبت تجهیز')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
