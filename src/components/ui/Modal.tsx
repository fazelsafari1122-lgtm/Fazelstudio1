import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** render as a side drawer instead of a centred dialog */
  drawer?: boolean;
}

const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, size = 'md', drawer }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={`fixed inset-0 z-[90] bg-black/70 backdrop-blur-xs flex ${drawer ? 'justify-start' : 'items-end sm:items-center justify-center sm:p-4'}`} dir="rtl" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={`bg-slate-900 border-slate-700 shadow-2xl flex flex-col w-full ${
          drawer ? 'h-full sm:max-w-md border-r' : `max-h-full sm:max-h-[92vh] h-full sm:h-auto rounded-none sm:rounded-2xl border ${SIZES[size]}`
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h2 className="font-semibold text-slate-100 text-base">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="بستن"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-800 flex flex-wrap gap-2 justify-end shrink-0 bg-slate-900/80">{footer}</div>}
      </div>
    </div>
  );
};
