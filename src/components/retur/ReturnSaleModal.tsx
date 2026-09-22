import React, { useState, useMemo } from 'react';
import { Sale, SaleLine } from '../../types/erp';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import {
  RotateCcw,
  Layers,
  BookOpen,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
  Coins
} from 'lucide-react';

interface ReturnSaleModalProps {
  isOpen: boolean;
  sale: Sale;
  saleLines: SaleLine[];
  onClose: () => void;
  onSuccess?: () => void;
  onOpenInspector?: () => void;
}

export const ReturnSaleModal: React.FC<ReturnSaleModalProps> = ({
  isOpen,
  sale,
  saleLines,
  onClose,
  onSuccess,
  onOpenInspector
}) => {
  const { currentUser, products, customers, db } = useAppDatabase();
  const lines = useMemo(() => saleLines.filter(l => l.saleId === sale.id), [saleLines, sale.id]);

  // State map: lineId -> returnQty
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    lines.forEach(l => {
      initial[l.id] = 0;
    });
    return initial;
  });

  const [reason, setReason] = useState('Barang cacat / dikembalikan pelanggan');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    journalId?: string;
    newStatus?: string;
    totalRefund?: number;
  } | null>(null);

  if (!isOpen) return null;

  const isCredit = sale.paymentMethod === 'CREDIT';
  const customer = sale.customerId ? customers.find(c => c.id === sale.customerId) : undefined;
  const todayStr = new Date().toISOString().split('T')[0];

  // Hitung kalkulasi proporsional per line sesuai Aturan Prompt 5 (§4 & §6)
  const lineCalculations = useMemo(() => {
    return lines.map(line => {
      const q = returnQtys[line.id] || 0;
      const Q = line.qty;
      const alreadyReturned = line.returnedQty || 0;
      const maxReturnable = Q - alreadyReturned;

      const lineSubtotal = line.unitPrice * line.qty;
      const linePpn = line.ppnLine || 0;
      const lineHpp = line.hppLine;

      let returnSubtotal = 0;
      let returnPpn = 0;
      let returnHpp = 0;
      let unitCost = 0;

      if (q > 0) {
        if (q === Q && alreadyReturned === 0) {
          returnSubtotal = lineSubtotal;
          returnPpn = linePpn;
          returnHpp = lineHpp;
        } else {
          returnSubtotal = Math.round((lineSubtotal * q) / Q);
          returnPpn = linePpn > 0 ? Math.round((linePpn * q) / Q) : 0;
          returnHpp = Math.round((lineHpp * q) / Q);
        }
        unitCost = Math.round(returnHpp / q);
      }

      return {
        line,
        q,
        maxReturnable,
        returnSubtotal,
        returnPpn,
        returnHpp,
        unitCost
      };
    });
  }, [lines, returnQtys]);

  const totalReturnQty = lineCalculations.reduce((s, c) => s + c.q, 0);
  const totalReturnSubtotal = lineCalculations.reduce((s, c) => s + c.returnSubtotal, 0);
  const totalReturnPpn = lineCalculations.reduce((s, c) => s + c.returnPpn, 0);
  const totalReturnHpp = lineCalculations.reduce((s, c) => s + c.returnHpp, 0);
  const totalRefund = totalReturnSubtotal + totalReturnPpn;

  // Cek apakah seluruh barang akan berstatus full RETURNED
  const willBeFullReturned = useMemo(() => {
    return lineCalculations.every(c => {
      const currentAlready = c.line.returnedQty || 0;
      return (currentAlready + c.q) >= c.line.qty;
    });
  }, [lineCalculations]);

  const handleQtyChange = (lineId: string, newQty: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, Math.floor(newQty || 0)));
    setReturnQtys(prev => ({
      ...prev,
      [lineId]: clamped
    }));
  };

  const handleReturnAll = () => {
    const all: Record<string, number> = {};
    lines.forEach(l => {
      const already = l.returnedQty || 0;
      all[l.id] = Math.max(0, l.qty - already);
    });
    setReturnQtys(all);
  };

  const handleResetAll = () => {
    const zero: Record<string, number> = {};
    lines.forEach(l => {
      zero[l.id] = 0;
    });
    setReturnQtys(zero);
  };

  const handleExecuteReturn = () => {
    if (totalReturnQty <= 0) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const itemsToReturn: { lineId: string; qty: number }[] = Object.entries(returnQtys)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([lineId, qty]) => ({ lineId, qty: Number(qty) }));

      const res = db.returnSale({
        saleId: sale.id,
        userRole: currentUser.role,
        businessDate: todayStr,
        reason: reason.trim() || undefined,
        items: itemsToReturn
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Gagal memproses retur.');
        setIsProcessing(false);
        return;
      }

      setSuccessResult({
        journalId: res.journal?.id,
        newStatus: res.sale?.status,
        totalRefund
      });
      setIsProcessing(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memproses retur.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/40 flex items-center justify-center border border-amber-300/40">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Retur Penjualan (Sebagian / Penuh)</h3>
              <p className="text-[11px] text-amber-100 font-mono">No. Nota: {sale.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-amber-200 hover:text-white hover:bg-amber-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {successResult ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-slate-800">Retur Penjualan Berhasil!</h4>
              <p className="text-slate-600 text-xs max-w-sm mx-auto">
                Status transaksi sekarang menjadi{' '}
                <span className="font-bold text-amber-700">{successResult.newStatus}</span>.
                Dana yang dikembalikan / dipotong dari piutang sebesar{' '}
                <span className="font-bold text-slate-900">{formatRupiah(successResult.totalRefund || 0)}</span>.
              </p>
              {successResult.journalId && (
                <div className="inline-block font-mono bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px]">
                  Ref Jurnal Retur: <span className="font-bold">{successResult.journalId}</span>
                </div>
              )}
              <div className="pt-3 flex gap-2">
                {onOpenInspector && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenInspector();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition"
                  >
                    Buka Database Inspector
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Info Banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Prinsip Proporsional & Pemulihan FIFO:</span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Nilai subtotal, PPN, dan HPP dihitung proporsional terhadap kuantitas yang diretur. Lapisan stok FIFO akan dipulihkan dengan tanggal perolehan asli.
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-900 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Retur Ditolak:</span>
                    <span>{errorMsg}</span>
                  </div>
                </div>
              )}

              {/* Quick Preset Buttons */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Daftar Barang Penjualan:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleReturnAll}
                    className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold border border-amber-300 transition"
                  >
                    Retur Semua Sisa
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold border border-slate-300 transition"
                  >
                    Reset 0
                  </button>
                </div>
              </div>

              {/* Items Table / Cards */}
              <div className="space-y-2">
                {lineCalculations.map(({ line, q, maxReturnable, returnSubtotal, returnPpn, returnHpp, unitCost }) => {
                  const prod = products.find(p => p.id === line.productId);
                  const alreadyReturned = line.returnedQty || 0;
                  const isFullyReturnedAlready = maxReturnable <= 0;

                  return (
                    <div
                      key={line.id}
                      className={`p-3 rounded-xl border transition ${
                        q > 0 
                          ? 'bg-amber-50/50 border-amber-300 shadow-2xs' 
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-800 block text-xs">
                            {prod?.name || line.productId}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Harga Jual: {formatRupiah(line.unitPrice)} • Total Terjual: {line.qty} {prod?.unit || 'unit'}
                          </span>
                          {alreadyReturned > 0 && (
                            <span className="block text-[10px] font-semibold text-amber-700 mt-0.5">
                              (Pernah diretur sebelumnya: {alreadyReturned} {prod?.unit || 'unit'})
                            </span>
                          )}
                        </div>

                        {/* Stepper control */}
                        {isFullyReturnedAlready ? (
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200">
                            Sudah Diretur Penuh
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(line.id, q - 1, maxReturnable)}
                              disabled={q <= 0}
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={maxReturnable}
                              value={q}
                              onChange={(e) => handleQtyChange(line.id, Number(e.target.value), maxReturnable)}
                              className="w-10 text-center font-bold text-xs text-slate-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleQtyChange(line.id, q + 1, maxReturnable)}
                              disabled={q >= maxReturnable}
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Proportional summary if q > 0 */}
                      {q > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-dashed border-amber-200 grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-slate-500 block">Pengembalian Nilai Jual:</span>
                            <span className="font-bold text-slate-900">
                              {formatRupiah(returnSubtotal + returnPpn)}
                              {returnPpn > 0 && <span className="text-slate-400 font-normal"> (Inc. PPN)</span>}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Pemulihan HPP Stok:</span>
                            <span className="font-bold text-emerald-800">
                              {formatRupiah(returnHpp)} <span className="text-slate-400 font-normal">(@ {formatRupiah(unitCost)})</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total Calculation & Status Transition Preview */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total Kuantitas Diretur:</span>
                  <span className="font-bold text-slate-900">{totalReturnQty} item</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total Dana Dikembalikan (Refund):</span>
                  <span className="font-bold text-sm text-emerald-700">{formatRupiah(totalRefund)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Status Akhir Penjualan:</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    willBeFullReturned
                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    {willBeFullReturned ? 'RETURNED (Diretur Seluruhnya)' : 'PARTIALLY_RETURNED (Diretur Sebagian)'}
                  </span>
                </div>
                {isCredit && (
                  <div className="text-[10px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    Penjualan ini adalah tempo (kredit). Nominal <strong>{formatRupiah(totalRefund)}</strong> akan otomatis mengurangi saldo piutang pelanggan <strong>{customer?.name}</strong>.
                  </div>
                )}
              </div>

              {/* Real-time Double-Entry Journal Preview */}
              {totalReturnQty > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Jurnal Retur Otomatis (§4):</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Debit = Kredit ({formatRupiah(totalRefund + totalReturnHpp)})
                    </span>
                  </div>
                  <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] space-y-1">
                    <div className="flex justify-between text-emerald-300">
                      <span>Dr 4110 PENJUALAN</span>
                      <span>{formatRupiah(totalReturnSubtotal)}</span>
                    </div>
                    {totalReturnPpn > 0 && (
                      <div className="flex justify-between text-emerald-300">
                        <span>Dr 2210 PPN_KELUARAN</span>
                        <span>{formatRupiah(totalReturnPpn)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-300">
                      <span>Dr 1310 PERSEDIAAN</span>
                      <span>{formatRupiah(totalReturnHpp)}</span>
                    </div>
                    <div className="flex justify-between text-amber-300 pl-4">
                      <span>Cr {isCredit ? '1210 PIUTANG_USAHA' : '1110 KAS'}</span>
                      <span>{formatRupiah(totalRefund)}</span>
                    </div>
                    <div className="flex justify-between text-amber-300 pl-4">
                      <span>Cr 5110 HPP</span>
                      <span>{formatRupiah(totalReturnHpp)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Return Reason Input */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Alasan Retur (Wajib diisi):
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Barang cacat, bocor, salah kemasan..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isProcessing || totalReturnQty <= 0 || !reason.trim()}
                  onClick={handleExecuteReturn}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-xs flex items-center justify-center gap-1.5 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isProcessing ? 'Memproses Retur...' : `Konfirmasi Retur (${totalReturnQty})`}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
