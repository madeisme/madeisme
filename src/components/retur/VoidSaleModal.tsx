import React, { useState } from 'react';
import { Sale, SaleLine } from '../../types/erp';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import {
  AlertTriangle,
  RotateCcw,
  Layers,
  BookOpen,
  X,
  ShieldAlert,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface VoidSaleModalProps {
  isOpen: boolean;
  sale: Sale;
  saleLines: SaleLine[];
  onClose: () => void;
  onSuccess?: () => void;
  onOpenInspector?: () => void;
}

export const VoidSaleModal: React.FC<VoidSaleModalProps> = ({
  isOpen,
  sale,
  saleLines,
  onClose,
  onSuccess,
  onOpenInspector
}) => {
  const { currentUser, products, customers, db } = useAppDatabase();
  const [reason, setReason] = useState('Pembatalan transaksi oleh kasir / pelanggan');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    journalId?: string;
  } | null>(null);

  if (!isOpen) return null;

  const isCredit = sale.paymentMethod === 'CREDIT';
  const customer = sale.customerId ? customers.find(c => c.id === sale.customerId) : undefined;
  const lines = saleLines.filter(l => l.saleId === sale.id);
  const totalHpp = lines.reduce((sum, l) => sum + l.hppLine, 0);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleExecuteVoid = () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = db.voidSale({
        saleId: sale.id,
        userRole: currentUser.role,
        businessDate: todayStr,
        reason: reason.trim() || undefined
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Gagal membatalkan transaksi.');
        setIsProcessing(false);
        return;
      }

      setSuccessResult({
        journalId: res.journal?.id
      });
      setIsProcessing(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memproses void.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-red-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-500/40 flex items-center justify-center border border-red-300/40">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Void Transaksi Penjualan</h3>
              <p className="text-[11px] text-red-100/90 font-mono">ID: {sale.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-red-200 hover:text-white hover:bg-red-600 transition"
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
              <h4 className="font-bold text-sm text-slate-800">Void Transaksi Berhasil!</h4>
              <p className="text-slate-600 text-xs max-w-sm mx-auto">
                Status transaksi telah diubah menjadi <span className="font-bold text-red-700">REVERSED</span>.
                Stok barang telah dipulihkan ke FIFO layer dengan tanggal perolehan asli, dan Jurnal Pembalik otomatis telah dibukukan.
              </p>
              {successResult.journalId && (
                <div className="inline-block font-mono bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px]">
                  Ref Jurnal: <span className="font-bold">{successResult.journalId}</span>
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
              {/* Warning Alert */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Peringatan Audit & Integritas Data:</span>
                  <p className="text-[11px] text-red-800 leading-relaxed">
                    Void membatalkan penjualan secara <strong>penuh</strong>. Data asli tidak akan dihapus. Sistem akan membukukan <strong>Jurnal Pembalik (Reversing Entry)</strong> dan memulihkan lapisan stok FIFO persis pada tanggal aslinya.
                  </p>
                </div>
              </div>

              {/* Error Message if any */}
              {errorMsg && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-900 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Void Ditolak:</span>
                    <span>{errorMsg}</span>
                  </div>
                </div>
              )}

              {/* Transaction Metadata Card */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Tanggal Transaksi:</span>
                  <span className="font-semibold text-slate-800">{formatDateTimeIndo(sale.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Kasir:</span>
                  <span className="font-semibold text-slate-800">{sale.cashierName}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Metode Pembayaran:</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    isCredit ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                    {isCredit ? `TEMPO (KREDIT) - ${customer?.name || 'Pelanggan'}` : 'TUNAI (CASH)'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">Total Nilai Penjualan:</span>
                  <span className="font-bold text-sm text-slate-900">{formatRupiah(sale.grandTotal)}</span>
                </div>
              </div>

              {/* Restored Stock Layers Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Stok Yang Akan Dipulihkan ke FIFO:</span>
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {lines.map((l) => {
                    const prod = products.find(p => p.id === l.productId);
                    const unitHpp = l.qty > 0 ? Math.round(l.hppLine / l.qty) : 0;
                    return (
                      <div key={l.id} className="p-2.5 bg-white flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-semibold text-slate-800 block">{prod?.name || l.productId}</span>
                          <span className="text-[10px] text-slate-400">
                            Unit Cost HPP Asli: {formatRupiah(unitHpp)} / {prod?.unit || 'unit'}
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-emerald-700">+{l.qty} {prod?.unit || 'unit'}</span>
                          <span className="text-[10px] text-slate-500 block">Total HPP: {formatRupiah(l.hppLine)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Double-Entry Journal Preview (§3) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Jurnal Pembalik Otomatis (Reversing Entry):</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Debit = Kredit ({formatRupiah(sale.grandTotal + totalHpp)})
                  </span>
                </div>
                <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] space-y-1">
                  <div className="flex justify-between text-emerald-300">
                    <span>Dr 4110 PENJUALAN</span>
                    <span>{formatRupiah(sale.subtotal)}</span>
                  </div>
                  {sale.ppnAmount > 0 && (
                    <div className="flex justify-between text-emerald-300">
                      <span>Dr 2210 PPN_KELUARAN</span>
                      <span>{formatRupiah(sale.ppnAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-300">
                    <span>Dr 1310 PERSEDIAAN</span>
                    <span>{formatRupiah(totalHpp)}</span>
                  </div>
                  <div className="flex justify-between text-amber-300 pl-4">
                    <span>Cr {isCredit ? '1210 PIUTANG_USAHA' : '1110 KAS'}</span>
                    <span>{formatRupiah(sale.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-amber-300 pl-4">
                    <span>Cr 5110 HPP</span>
                    <span>{formatRupiah(totalHpp)}</span>
                  </div>
                </div>
              </div>

              {/* Void Reason Input */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Alasan Pembatalan (Wajib diisi):
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Kasir salah input produk, pelanggan batal beli..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-xs"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-100 transition"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  disabled={isProcessing || !reason.trim()}
                  onClick={handleExecuteVoid}
                  className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold transition shadow-xs flex items-center justify-center gap-1.5 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isProcessing ? 'Memproses Void...' : 'Konfirmasi Void'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
