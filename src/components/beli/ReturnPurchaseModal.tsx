import React, { useState, useMemo } from 'react';
import { Purchase, PurchaseLine } from '../../types/erp';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah } from '../../utils/formatters';
import {
  RotateCcw,
  BookOpen,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
  Package,
  Truck
} from 'lucide-react';

interface ReturnPurchaseModalProps {
  isOpen: boolean;
  purchase: Purchase;
  lines: PurchaseLine[];
  onClose: () => void;
  onSuccess?: () => void;
  onOpenInspector?: () => void;
}

export const ReturnPurchaseModal: React.FC<ReturnPurchaseModalProps> = ({
  isOpen,
  purchase,
  lines,
  onClose,
  onSuccess,
  onOpenInspector
}) => {
  const { currentUser, products, suppliers, inventoryLayers, purchaseReceipts, db } = useAppDatabase();

  const [returnQtys, setReturnQtys] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    lines.forEach(l => {
      initial[l.id] = 0;
    });
    return initial;
  });

  const [reason, setReason] = useState('Barang cacat / expired / salah spesifikasi dari supplier');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    journalId?: string;
    totalAmount?: number;
    newStatus?: string;
  } | null>(null);

  if (!isOpen) return null;

  const isCredit = purchase.paymentMethod === 'CREDIT';
  const supplier = suppliers.find(s => s.id === purchase.supplierId);
  const receipts = purchaseReceipts.filter(r => r.purchaseId === purchase.id);
  const todayStr = new Date().toISOString().split('T')[0];

  // Hitung sisa stok fisik yang masih tersisa pada InventoryLayer spesifik PO ini (§5 item 1)
  const lineCalculations = useMemo(() => {
    return lines.map(line => {
      const q = returnQtys[line.id] || 0;
      const alreadyReturned = line.qtyReturned || 0;
      const maxReceiptReturnable = line.qtyReceivedCumulative - alreadyReturned;

      // Cari layer milik PO ini
      let candidateLayers = receipts.flatMap(rc => rc.itemsReceived || [])
        .filter(ir => ir.lineId === line.id || ir.productId === line.productId)
        .map(ir => inventoryLayers.find(l => l.id === ir.layerId))
        .filter(Boolean);

      if (candidateLayers.length === 0) {
        candidateLayers = inventoryLayers.filter(l =>
          l.productId === line.productId &&
          (l.sourcePurchaseId === purchase.id || l.unitCost === line.poPrice)
        );
      }

      const layerStockRemaining = candidateLayers.reduce((s, l) => s + (l?.quantityRemaining || 0), 0);
      const effectiveMax = Math.min(maxReceiptReturnable, layerStockRemaining);

      const returnAmount = q * line.poPrice;

      return {
        line,
        q,
        maxReceiptReturnable,
        layerStockRemaining,
        effectiveMax,
        returnAmount
      };
    });
  }, [lines, returnQtys, receipts, inventoryLayers, purchase.id]);

  const totalReturnQty = lineCalculations.reduce((s, c) => s + c.q, 0);
  const totalReturnAmount = lineCalculations.reduce((s, c) => s + c.returnAmount, 0);

  const willBeFullReturned = useMemo(() => {
    return lineCalculations.every(c => {
      const already = c.line.qtyReturned || 0;
      return (already + c.q) >= c.line.qtyReceivedCumulative;
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
    lineCalculations.forEach(c => {
      all[c.line.id] = c.effectiveMax;
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

    // Cek jika ada yang melebihi stok layer spesifik PO
    for (const c of lineCalculations) {
      if (c.q > c.layerStockRemaining) {
        setErrorMsg('Barang sudah terjual sebagian, tidak bisa retur qty ini');
        setIsProcessing(false);
        return;
      }
    }

    try {
      const itemsToReturn: { lineId: string; qty: number }[] = Object.entries(returnQtys)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([lineId, qty]) => ({ lineId, qty: Number(qty) }));

      const res = db.returnPurchase({
        purchaseId: purchase.id,
        userRole: currentUser.role,
        businessDate: todayStr,
        reason: reason.trim() || undefined,
        items: itemsToReturn
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Gagal memproses retur ke supplier.');
        setIsProcessing(false);
        return;
      }

      setSuccessResult({
        journalId: res.journal?.id,
        totalAmount: totalReturnAmount,
        newStatus: res.purchase?.status
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
        <div className="bg-blue-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-500/40 flex items-center justify-center border border-blue-300/40">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Retur Pembelian ke Supplier</h3>
              <p className="text-[11px] text-blue-100 font-mono">No. PO: {purchase.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800 transition"
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
              <h4 className="font-bold text-sm text-slate-800">Retur ke Supplier Berhasil!</h4>
              <p className="text-slate-600 text-xs max-w-sm mx-auto">
                Barang telah dikembalikan ke supplier <span className="font-bold text-slate-900">{supplier?.name}</span>.
                Stok pada layer PO bersangkutan telah dikurangi, dan {isCredit ? 'Hutang Usaha' : 'Kas'} telah disesuaikan sebesar{' '}
                <span className="font-bold text-slate-900">{formatRupiah(successResult.totalAmount || 0)}</span>.
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
              {/* Info banner */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Validasi Layer Spesifik PO:</span>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Stok harus dikurangi dari batch layer yang dibuat oleh PO ini. Jika barang telah terjual sebagian kepada pelanggan melalui FIFO, kuantitas retur tidak boleh melebihi sisa fisik di gudang.
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

              {/* Header Details */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier:</span>
                  <span className="font-bold text-slate-800">{supplier?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode Pembayaran PO:</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    isCredit ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                    {isCredit ? 'TEMPO (KREDIT - Hutang Usaha)' : 'TUNAI (CASH)'}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Barang Yang Diterima Dari PO:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleReturnAll}
                      className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 text-[10px] font-bold border border-blue-300 transition"
                    >
                      Pilih Maksimal Sisa
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

                <div className="space-y-2">
                  {lineCalculations.map(({ line, q, maxReceiptReturnable, layerStockRemaining, effectiveMax, returnAmount }) => {
                    const prod = products.find(p => p.id === line.productId);
                    const isSoldPartially = layerStockRemaining < maxReceiptReturnable;

                    return (
                      <div
                        key={line.id}
                        className={`p-3 rounded-xl border transition ${
                          q > 0
                            ? 'bg-blue-50/50 border-blue-300 shadow-2xs'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">
                              {prod?.name || line.productId}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Harga Beli (PO): {formatRupiah(line.poPrice)} • Diterima: {line.qtyReceivedCumulative} {prod?.unit || 'unit'}
                            </span>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Sisa Layer PO di Gudang:{' '}
                              <span className={`font-bold ${isSoldPartially ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {layerStockRemaining} {prod?.unit || 'unit'}
                              </span>
                              {isSoldPartially && (
                                <span className="text-amber-600 block text-[9px]">
                                  (Sebagian barang telah terjual ke pelanggan lewat kasir)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stepper control */}
                          {effectiveMax <= 0 ? (
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200 text-right">
                              {layerStockRemaining <= 0 ? 'Stok 0 (Habis Terjual)' : 'Sudah Diretur'}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleQtyChange(line.id, q - 1, effectiveMax)}
                                disabled={q <= 0}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={effectiveMax}
                                value={q}
                                onChange={(e) => handleQtyChange(line.id, Number(e.target.value), effectiveMax)}
                                className="w-10 text-center font-bold text-xs text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleQtyChange(line.id, q + 1, effectiveMax)}
                                disabled={q >= effectiveMax}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {q > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-dashed border-blue-200 flex justify-between text-[10px]">
                            <span className="text-slate-500">Nilai Retur Pembelian:</span>
                            <span className="font-bold text-blue-900">{formatRupiah(returnAmount)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total Kuantitas Dikembalikan:</span>
                  <span className="font-bold text-slate-900">{totalReturnQty} item</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total Nilai Tagihan Dikurangi / Pengembalian Kas:</span>
                  <span className="font-bold text-sm text-blue-800">{formatRupiah(totalReturnAmount)}</span>
                </div>
                {willBeFullReturned && (
                  <div className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                    Status PO akan berubah menjadi <strong>RETURNED</strong> (Seluruh barang telah dikembalikan).
                  </div>
                )}
              </div>

              {/* Real-time Double-Entry Journal Preview (§5 item 2) */}
              {totalReturnQty > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Jurnal Retur Pembelian (§5):</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Debit = Kredit ({formatRupiah(totalReturnAmount)})
                    </span>
                  </div>
                  <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] space-y-1">
                    <div className="flex justify-between text-emerald-300">
                      <span>Dr {isCredit ? '2110 HUTANG_USAHA' : '1110 KAS'}</span>
                      <span>{formatRupiah(totalReturnAmount)}</span>
                    </div>
                    <div className="flex justify-between text-amber-300 pl-4">
                      <span>Cr 1310 PERSEDIAAN</span>
                      <span>{formatRupiah(totalReturnAmount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reason input */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Alasan Retur ke Supplier (Wajib diisi):
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Barang cacat dari pabrik, mendekati kadaluwarsa..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
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
                  className="flex-1 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold transition shadow-xs flex items-center justify-center gap-1.5 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isProcessing ? 'Memproses...' : `Kirim Retur (${totalReturnQty})`}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
