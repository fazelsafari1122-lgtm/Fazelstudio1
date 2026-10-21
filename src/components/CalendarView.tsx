import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, ChevronRight, ChevronLeft, Plus,
  MapPin, Clock, Users, Camera, Sparkles, X, Trash2, Filter
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { CalendarEvent, Customer, Project } from '../types.ts';
import {
  JALALI_MONTH_NAMES, JALALI_WEEK_DAYS, toPersianDigits,
  getTodayJalali, getJalaliDateParts, getMonthDaysCount, formatJalaliHuman
} from '../utils/jalali.ts';
import * as jalaali from 'jalaali-js';

const EVENT_TYPES = [
  { id: 'all', label: 'همه رویدادها' },
  { id: 'wedding', label: 'جشن عروسی' },
  { id: 'formality', label: 'فرمالیته' },
  { id: 'project', label: 'پروژه تصویربرداری' },
  { id: 'equipment_reservation', label: 'رزرو تجهیزات' },
  { id: 'meeting', label: 'جلسه هماهنگی' },
  { id: 'studio_event', label: 'رویداد استودیو' }
];

export const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  const todayJalaliStr = getTodayJalali();
  const todayParts = getJalaliDateParts(todayJalaliStr) || { jy: 1405, jm: 6, jd: 30 };

  const [currentYear, setCurrentYear] = useState(todayParts.jy);
  const [currentMonth, setCurrentMonth] = useState(todayParts.jm);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayJalaliStr);

  // Add Event Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    event_type: 'wedding' as const,
    start_date: todayJalaliStr,
    end_date: todayJalaliStr,
    start_time: '14:00',
    end_time: '23:00',
    location: '',
    customer_id: '',
    project_id: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const [list, custList, prjList] = await Promise.all([
        api.getCalendarEvents(),
        api.getCustomers(),
        api.getProjects()
      ]);
      setEvents(list);
      setCustomers(custList);
      setProjects(prjList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  // Calculate starting weekday for Jalali month
  const gFirstDay = jalaali.toGregorian(currentYear, currentMonth, 1);
  const firstDate = new Date(gFirstDay.gy, gFirstDay.gm - 1, gFirstDay.gd);
  const jsDay = firstDate.getDay();
  const jalaliStartDayIndex = (jsDay + 1) % 7; // Saturday = 0
  const daysInMonth = getMonthDaysCount(currentYear, currentMonth);

  const filteredEvents = events.filter(e => {
    if (selectedTypeFilter !== 'all' && e.event_type !== selectedTypeFilter) return false;
    return true;
  });

  const selectedDayEvents = filteredEvents.filter(e => e.start_date === selectedDateStr);

  const handleDayClick = (day: number) => {
    const mm = String(currentMonth).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${currentYear}/${mm}/${dd}`;
    setSelectedDateStr(dateStr);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.createCalendarEvent({
        ...formData,
        customer_id: formData.customer_id ? Number(formData.customer_id) : null,
        project_id: formData.project_id ? Number(formData.project_id) : null
      });
      setShowAddModal(false);
      setFormData({
        title: '',
        event_type: 'wedding',
        start_date: selectedDateStr,
        end_date: selectedDateStr,
        start_time: '14:00',
        end_time: '23:00',
        location: '',
        customer_id: '',
        project_id: '',
        description: ''
      });
      loadEvents();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت رویداد');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (id: number, title: string) => {
    if (!window.confirm(`آیا از حذف رویداد «${title}» از تقویم اطمینان دارید؟`)) {
      return;
    }
    try {
      await api.deleteCalendarEvent(id);
      loadEvents();
    } catch (err: any) {
      alert(err.message || 'خطا در حذف رویداد');
    }
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'wedding': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'formality': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'project': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'equipment_reservation': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'meeting': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getEventTypeName = (type: string) => {
    const item = EVENT_TYPES.find(t => t.id === type);
    return item ? item.label : type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-amber-400" />
              تقویم هماهنگی رویدادها، مراسمات و رزروهای استودیو
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              امروز: {formatJalaliHuman(todayJalaliStr)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            تقویم کامل خورشیدی (جلالی) با تقویم روزانه، هفتگی، ماهانه و ثبت هوشمند در دیتابیس
          </p>
        </div>
        <button
          onClick={() => {
            setFormData(prev => ({ ...prev, start_date: selectedDateStr, end_date: selectedDateStr }));
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت رویداد جدید</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="flex items-center gap-1 text-slate-400 text-xs ml-2">
          <Filter className="w-3.5 h-3.5 text-amber-400" />
          <span>فیلتر:</span>
        </span>
        {EVENT_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedTypeFilter(t.id)}
            className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors border ${
              selectedTypeFilter === t.id
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Grid (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          {/* Navigation Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-white">
                {JALALI_MONTH_NAMES[currentMonth - 1]} {toPersianDigits(currentYear)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="ماه قبل"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setCurrentYear(todayParts.jy);
                  setCurrentMonth(todayParts.jm);
                  setSelectedDateStr(todayJalaliStr);
                }}
                className="px-3.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors font-bold border border-slate-700"
              >
                برو به امروز
              </button>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="ماه بعد"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 pb-2 border-b border-slate-800/80">
            {JALALI_WEEK_DAYS.map((w, idx) => (
              <div key={w} className={`py-1 ${idx === 6 ? 'text-rose-400 font-bold' : ''}`}>
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty boxes for days before month start */}
            {Array.from({ length: jalaliStartDayIndex }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-20 sm:h-24 p-1 rounded-xl bg-slate-950/20 border border-transparent opacity-30" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const mm = String(currentMonth).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const dateStr = `${currentYear}/${mm}/${dd}`;
              const dayEvents = filteredEvents.filter(e => e.start_date === dateStr);
              const isToday = currentYear === todayParts.jy && currentMonth === todayParts.jm && day === todayParts.jd;
              const isSelected = selectedDateStr === dateStr;

              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`h-20 sm:h-24 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                      : isToday
                      ? 'bg-slate-800/90 border-amber-500/60'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isToday ? 'text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded-full' : 'text-slate-200'}`}>
                      {toPersianDigits(day)}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 shadow-xs shadow-amber-400/50 animate-pulse"></span>
                    )}
                  </div>

                  {/* Tiny Event badges */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[9px] truncate px-1 py-0.5 rounded border ${getEventBadgeColor(ev.event_type)}`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[8px] text-amber-400/90 text-center font-bold">
                        +{toPersianDigits(dayEvents.length - 2)} رویداد
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Side Panel (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">برنامه و رویدادهای روز</h3>
                <span className="text-xs text-amber-400 font-medium">{formatJalaliHuman(selectedDateStr)}</span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                {toPersianDigits(selectedDayEvents.length)} رویداد
              </span>
            </div>

            <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto">
              {selectedDayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-white font-bold">{ev.title}</strong>
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${getEventBadgeColor(ev.event_type)}`}>
                        {getEventTypeName(ev.event_type)}
                      </span>
                      <button
                        onClick={() => handleDeleteEvent(ev.id, ev.title)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        title="حذف رویداد"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {ev.start_time && (
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{toPersianDigits(ev.start_time)} {ev.end_time ? `تا ${toPersianDigits(ev.end_time)}` : ''}</span>
                    </div>
                  )}

                  {ev.location && (
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      <span>{ev.location}</span>
                    </div>
                  )}

                  {(ev.first_name || ev.last_name) && (
                    <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>مشتری: {ev.first_name} {ev.last_name}</span>
                    </div>
                  )}

                  {ev.description && (
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      {ev.description}
                    </p>
                  )}
                </div>
              ))}

              {selectedDayEvents.length === 0 && (
                <div className="text-center py-16 text-slate-500 text-xs">
                  در این تاریخ هیچ برنامه یا مراسمی ثبت نشده است.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setFormData(prev => ({
                ...prev,
                start_date: selectedDateStr,
                end_date: selectedDateStr
              }));
              setShowAddModal(true);
            }}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-bold rounded-xl text-xs transition-colors border border-slate-700 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت رویداد برای این روز ({selectedDateStr})</span>
          </button>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                ثبت رویداد جدید در تقویم استودیو
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">عنوان رویداد *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500"
                  placeholder="مثال: پوشش عکاسی عروسی، جلسه مشاوره، رزرو دوربین و تجهیزات..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">نوع رویداد</label>
                  <select
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:border-amber-500"
                  >
                    <option value="wedding">جشن عروسی</option>
                    <option value="formality">فرمالیته</option>
                    <option value="project">پروژه تصویربرداری</option>
                    <option value="equipment_reservation">رزرو تجهیزات</option>
                    <option value="meeting">جلسه هماهنگی</option>
                    <option value="studio_event">رویداد استودیو</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">تاریخ شروع (شمسی) *</label>
                  <input
                    type="text"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="1405/06/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">ساعت شروع</label>
                  <input
                    type="text"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="14:00"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">ساعت پایان</label>
                  <input
                    type="text"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="23:00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">انتساب به مشتری (اختیاری)</label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="">بدون انتساب به مشتری</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">انتساب به پروژه (اختیاری)</label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="">بدون انتساب به پروژه</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">محل برگزاری یا لوکیشن</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  placeholder="دفتر استودیو، باغ تالار، لوکیشن فرمالیته..."
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">توضیحات و یادداشت</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  placeholder="نکات هماهنگی، کادر اعزامی یا لوازم مورد نیاز..."
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  {saving ? 'در حال ثبت...' : 'ثبت رویداد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
