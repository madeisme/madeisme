import React, { useState, useMemo } from 'react';
import { CashSession, User, Journal } from '../../types/erp';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { db } from '../../database/appDatabase';
import { 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Calculator, 
  FileText, 
  Banknote, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RotateCcw 
} from 'lucide-react';

interface CloseCashSessionModalProps {
  isOpen: boolean;
  session: CashSession;
  currentUser: User;
  onClose: () => void;
  onSuccess: (closedSession: CashSession, journal?: Journal) => void;
}

export const CloseCashSessionModal: React.FC<CloseCashSessionModalProps> = ({
  isOpen,
  session,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Perhitungan ekspektasi kas dari sistem
  const calc = useMemo(() => {
    try {
      return db.calculateCashSessionExpected(session.id);
    } catch (err) {
      console.error(err);
      return {
        openingFloat: session.openingFloat || 0,
        cashSalesTotal: 0,
        cashSalesCount: 0,
        voidSalesTotal: 0,
        voidSalesCount: 0,
        cashReturnsTotal: 0,
        cashReturnsCount: 0,
        totalDeductions: 0,
        arSettleTotal: 0,
        arSettleCount: 0,
        systemExpectedCash: session.openingFloat || 0
      };
    }
  }, [session.id, session.openingFloat]);

  if (!isOpen) return null;

  const actualCash = actualCashInput ? parseInt(actualCashInput.replace(/\D/g, '') || '0', 10) : 0;
  const hasEnteredActual = actualCashInput.trim().length > 0;
  const variance = hasEnteredActual ? actualCash - calc.systemExpectedCash : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasEnteredActual) {
      setError('Silakan masukkan hasil hitung fisik uang di laci kasir.');
      return;
    }

    if (isNaN(actualCash) || actualCash < 0) {
      setError('Nominal hitung fisik uang tidak valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = db.closeCashSession({
        sessionId: session.id,
        actualCash,
        closedByUserId: currentUser.id,
        notes: notes.trim() || undefined
      });

      if (!res.success || !res.session) {
        setError(res.error || 'Gagal menutup sesi kasir.');
        setIsSubmitting(false);
        return;
      }

      onSuccess(res.session, res.journal);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat penutupan sesi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Tutup Sesi & Rekonsiliasi Kas</h2>
              <p className="text-xs text-slate-300">Shift #{session.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Shift */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block">Waktu Buka Sesi:</span>
              <span className="font-semibold text-slate-800">{formatDateTimeIndo(session.openedAt)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Ditutup Oleh:</span>
              <span className="font-semibold text-slate-800">{currentUser.name} ({currentUser.role})</span>
            </div>
          </div>

          {/* Rincian Kas dari Sistem */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200">
              <Calculator className="w-3.5 h-3.5 text-slate-500" />
              <span>Perhitungan Kas Sistem (Prompt 8 §4)</span>
            </div>
            <div className="p-3 space-y-2 bg-white">
              {/* Modal Awal */}
              <div className="flex justify-between items-center text-slate-700">
                <span className="flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                  Modal Awal di Laci (Opening Float)
                </span>
                <span className="font-semibold">{formatRupiah(calc.openingFloat)}</span>
              </div>

              {/* Penjualan Tunai */}
              <div className="flex justify-between items-center text-emerald-700">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Total Penjualan Tunai ({calc.cashSalesCount} transaksi)
                </span>
                <span className="font-semibold">+{formatRupiah(calc.cashSalesTotal)}</span>
              </div>

              {/* Void / Retur Tunai (Pengurangan) */}
              {calc.totalDeductions > 0 && (
                <div className="flex justify-between items-center text-rose-600">
                  <span className="flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Void & Retur Tunai ({calc.voidSalesCount + calc.cashReturnsCount} transaksi)
                  </span>
                  <span className="font-semibold">-{formatRupiah(calc.totalDeductions)}</span>
                </div>
              )}

              {/* Pelunasan Piutang */}
              {calc.arSettleTotal > 0 && (
                <div className="flex justify-between items-center text-indigo-700">
                  <span className="flex items-center gap-1">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Pelunasan Piutang Tunai ({calc.arSettleCount} transaksi)
                  </span>
                  <span className="font-semibold">+{formatRupiah(calc.arSettleTotal)}</span>
                </div>
              )}

              {/* Garis batas */}
              <div className="border-t border-slate-200 pt-2 mt-1 flex justify-between items-center">
                <span className="font-bold text-slate-900 text-sm">
                  Kas Seharusnya di Laci (Sistem)
                </span>
                <span className="font-black text-slate-900 text-base">
                  {formatRupiah(calc.systemExpectedCash)}
                </span>
              </div>
            </div>
          </div>

          {/* Input Hitung Fisik Uang */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Hitung Fisik Uang di Laci (Actual Cash) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                Rp
              </span>
              <input
                type="text"
                value={actualCashInput ? Number(actualCashInput.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setActualCashInput(raw);
                }}
                className="w-full pl-11 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold text-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                placeholder="0"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Hitung lembaran & koin fisik yang ada di dalam laci kasir secara teliti.
            </p>
          </div>

          {/* Banner Variance / Selisih Realtime */}
          {hasEnteredActual && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
              variance === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : variance < 0
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-center gap-2">
                {variance === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                )}
                <div>
                  <div className="font-bold">
                    {variance === 0
                      ? 'Kas Sempurna (Pas / Cocok)'
                      : variance < 0
                      ? 'Kas Fisik KURANG (Defisit)'
                      : 'Kas Fisik LEBIH (Surplus)'}
                  </div>
                  <div className="text-[11px] opacity-85">
                    {variance === 0
                      ? 'Tidak ada selisih, tidak perlu jurnal penyesuaian.'
                      : variance < 0
                      ? `Uang fisik di laci kurang Rp ${Math.abs(variance).toLocaleString('id-ID')} dari catatan sistem.`
                      : `Uang fisik di laci berlebih Rp ${variance.toLocaleString('id-ID')} dari catatan sistem.`}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 font-black text-base">
                {variance === 0 ? 'Rp 0' : `${variance > 0 ? '+' : ''}${formatRupiah(variance)}`}
              </div>
            </div>
          )}

          {/* Jurnal Info (Prompt 8 §5) */}
          {hasEnteredActual && variance !== 0 && (
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-[11px] text-slate-600 space-y-1">
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Jurnal Penyesuaian Otomatis (Double-Entry Seimbang):
              </span>
              {variance < 0 ? (
                <div className="pl-4 font-mono text-[10px] space-y-0.5">
                  <div>Dr 5910 SELISIH_KAS = {formatRupiah(Math.abs(variance))}</div>
                  <div className="pl-3">Cr 1110 KAS = {formatRupiah(Math.abs(variance))}</div>
                </div>
              ) : (
                <div className="pl-4 font-mono text-[10px] space-y-0.5">
                  <div>Dr 1110 KAS = {formatRupiah(variance)}</div>
                  <div className="pl-3">Cr 5910 SELISIH_KAS = {formatRupiah(variance)}</div>
                </div>
              )}
            </div>
          )}

          {/* Catatan Penutupan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Penutupan Shift (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Selisih uang receh pecahan 500 hilang, serah terima ke kasir shift 2"
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Footer Buttons */}
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
              disabled={isSubmitting || !hasEnteredActual}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 active:bg-black rounded-xl shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>{isSubmitting ? 'Memproses...' : 'Tutup Sesi Kasir'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
