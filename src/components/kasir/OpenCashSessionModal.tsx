import React, { useState } from 'react';
import { CashSession, User } from '../../types/erp';
import { formatRupiah } from '../../utils/formatters';
import { db } from '../../database/appDatabase';
import { Banknote, AlertCircle, X, Check, Lock } from 'lucide-react';

interface OpenCashSessionModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onSuccess: (session: CashSession) => void;
}

export const OpenCashSessionModal: React.FC<OpenCashSessionModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [openingFloat, setOpeningFloat] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const quickFloatOptions = [0, 50000, 100000, 200000, 500000];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedFloat = parseInt(openingFloat.replace(/\D/g, '') || '0', 10);

    if (isNaN(parsedFloat) || parsedFloat < 0) {
      setError('Nominal modal awal harus angka valid (minimal Rp 0).');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = db.openCashSession({
        userId: currentUser.id,
        openingFloat: parsedFloat,
        notes: notes.trim() || undefined
      });

      if (!result.success || !result.session) {
        setError(result.error || 'Gagal membuka sesi kasir.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(result.session);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Buka Sesi Kasir (Shift)</h2>
              <p className="text-xs text-emerald-100">Setoran uang modal awal di laci kasir</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Kasir */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block">Kasir Bertugas:</span>
              <span className="font-semibold text-slate-800">{currentUser.name}</span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full uppercase tracking-wider">
              {currentUser.role}
            </span>
          </div>

          {/* Input Modal Awal (Opening Float) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Modal Awal di Laci Kasir (Rp) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                Rp
              </span>
              <input
                type="text"
                value={openingFloat ? Number(openingFloat.replace(/\D/g, '')).toLocaleString('id-ID') : '0'}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setOpeningFloat(raw || '0');
                }}
                className="w-full pl-11 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                placeholder="0"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Masukkan uang receh/modal kembalian di laci kasir saat mulai shift (boleh Rp 0).
            </p>

            {/* Quick Nominal Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickFloatOptions.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setOpeningFloat(String(opt))}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 text-slate-700 font-medium transition"
                >
                  {formatRupiah(opt)}
                </button>
              ))}
            </div>
          </div>

          {/* Catatan Shift */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Pembukaan Shift (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Shift pagi, modal receh pecahan Rp 2.000 & Rp 5.000"
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs flex items-center gap-1.5 transition disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Membuka...' : 'Mulai Sesi Kasir'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
