import React, { useState } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { Purchase, PurchaseLine, InventoryLayer, PurchaseReceipt, Journal, JournalLine } from '../../types/erp';
import { formatRupiah } from '../../utils/formatters';
import { 
  X, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  PackageCheck, 
  ArrowDownToLine, 
  Calendar, 
  FileCheck 
} from 'lucide-react';

interface ReceiveGoodsModalProps {
  isOpen: boolean;
  purchase: Purchase;
  lines: PurchaseLine[];
  onClose: () => void;
  onSuccess: (data: {
    receipt: PurchaseReceipt;
    createdLayers: InventoryLayer[];
    journal: Journal;
    journalLines: JournalLine[];
    grandTotalPortion: number;
    newStatus: string;
  }) => void;
}

export const ReceiveGoodsModal: React.FC<ReceiveGoodsModalProps> = ({
  isOpen,
  purchase,
  lines,
  onClose,
  onSuccess
}) => {
  const { products, currentUser, db } = useAppDatabase();

  const [businessDate, setBusinessDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Map of lineId -> qtyToReceive
  const [qtyInputs, setQtyInputs] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    lines.forEach(line => {
      const remaining = line.qtyOrdered - line.qtyReceivedCumulative;
      // Default: 0 agar user eksplisit mengisi atau klik "Terima Semua"
      initial[line.id] = remaining > 0 ? remaining : 0;
    });
    return initial;
  });

  if (!isOpen) return null;

  const handleQtyChange = (lineId: string, val: number) => {
    setQtyInputs(prev => ({
      ...prev,
      [lineId]: isNaN(val) ? 0 : Math.max(0, val)
    }));
    setErrorMsg(null);
  };

  const handleFillAllRemaining = () => {
    const updated: Record<string, number> = {};
    lines.forEach(line => {
      const remaining = line.qtyOrdered - line.qtyReceivedCumulative;
      updated[line.id] = remaining > 0 ? remaining : 0;
    });
    setQtyInputs(updated);
    setErrorMsg(null);
  };

  const handleClearAll = () => {
    const updated: Record<string, number> = {};
    lines.forEach(line => {
      updated[line.id] = 0;
    });
    setQtyInputs(updated);
    setErrorMsg(null);
  };

  // Calculations
  let totalQtyToReceive = 0;
  let estimatedPortionValue = 0;

  for (const line of lines) {
    const inputQty = qtyInputs[line.id] || 0;
    totalQtyToReceive += inputQty;
    estimatedPortionValue += inputQty * line.poPrice;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validasi 1: Qty per line tidak boleh melebihi sisa pesanan
    for (const line of lines) {
      const inputQty = qtyInputs[line.id] || 0;
      const remaining = line.qtyOrdered - line.qtyReceivedCumulative;
      if (inputQty > remaining) {
        const prod = products.find(p => p.id === line.productId);
        setErrorMsg(`Qty diterima melebihi pesanan untuk ${prod?.name || 'produk'}`);
        return;
      }
    }

    // Validasi 2: Minimal ada 1 barang diterima
    if (totalQtyToReceive <= 0) {
      setErrorMsg('Masukkan kuantitas barang yang diterima (> 0)');
      return;
    }

    const itemsToReceive = lines.map(line => ({
      lineId: line.id,
      qtyReceived: qtyInputs[line.id] || 0
    })).filter(i => i.qtyReceived > 0);

    const res = db.receiveGoods({
      purchaseId: purchase.id,
      userRole: currentUser.role,
      receivedBy: `${currentUser.name} (${currentUser.role})`,
      businessDate: businessDate,
      notes: notes.trim() || undefined,
      items: itemsToReceive
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Gagal memproses penerimaan barang');
      return;
    }

    const updatedPO = db.getPurchaseById(purchase.id);

    onSuccess({
      receipt: res.receipt!,
      createdLayers: res.createdLayers!,
      journal: res.journal!,
      journalLines: res.journalLines!,
      grandTotalPortion: res.grandTotalPortion || 0,
      newStatus: updatedPO?.status || 'RECEIVING'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Terima Barang (Goods Receipt)</h3>
              <p className="text-[11px] text-slate-300">
                PO: <span className="font-mono text-emerald-400 font-bold">{purchase.id}</span> • Batch Baru <span className="font-mono text-amber-300">InventoryLayer</span> FIFO
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Actions & Date */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFillAllRemaining}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold hover:bg-emerald-100 transition flex items-center gap-1"
              >
                <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terima Semua Sisa</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1.5 rounded-lg bg-white text-slate-600 border border-slate-200 text-xs font-medium hover:bg-slate-100 transition"
              >
                Kosongkan
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Tgl Masuk:</span>
              <input
                type="date"
                value={businessDate}
                onChange={e => setBusinessDate(e.target.value)}
                className="px-2 py-0.5 border border-slate-300 rounded-lg text-xs font-mono bg-white"
              />
            </div>
          </div>

          {/* Lines Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">
                Daftar Item & Jumlah Diterima Saat Ini:
              </h4>
              <span className="text-[11px] text-slate-500">
                Penerima: <strong className="text-slate-800">{currentUser.name}</strong>
              </span>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => {
                const prod = products.find(p => p.id === line.productId);
                const remaining = line.qtyOrdered - line.qtyReceivedCumulative;
                const inputVal = qtyInputs[line.id] || 0;
                const isOver = inputVal > remaining;

                return (
                  <div
                    key={line.id}
                    className={`p-3 rounded-xl border transition ${
                      isOver 
                        ? 'border-rose-300 bg-rose-50/50' 
                        : inputVal > 0 
                        ? 'border-emerald-300 bg-emerald-50/40' 
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {prod?.name || line.productId}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Harga PO Terkunci: <strong className="text-slate-700">{formatRupiah(line.poPrice)}</strong> / {prod?.unit || 'unit'}
                        </p>
                      </div>

                      <div className="text-right text-[11px]">
                        <span className="text-slate-500 block text-[10px]">Status Pesanan:</span>
                        <span className="font-semibold text-slate-800">
                          {line.qtyReceivedCumulative} / {line.qtyOrdered} {prod?.unit || 'unit'}
                        </span>
                        {remaining > 0 ? (
                          <span className="text-[10px] font-bold text-amber-700 block">
                            (Sisa {remaining} {prod?.unit || 'unit'})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 block">
                            ✓ Lengkap
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Input Controls */}
                    <div className="grid grid-cols-12 gap-2 items-center pt-2 border-t border-slate-100 text-xs">
                      <div className="col-span-7 sm:col-span-8 flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                          Terima Sekarang:
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          disabled={remaining <= 0}
                          value={inputVal}
                          onChange={e => handleQtyChange(line.id, parseInt(e.target.value) || 0)}
                          className={`w-24 px-2.5 py-1 border rounded-lg font-mono font-bold text-center text-xs ${
                            isOver 
                              ? 'border-rose-500 bg-white text-rose-700 ring-1 ring-rose-500' 
                              : remaining <= 0 
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                              : 'border-slate-300 bg-white text-slate-800 focus:border-emerald-600'
                          }`}
                        />
                        <span className="text-xs text-slate-500">{prod?.unit || 'unit'}</span>
                      </div>

                      <div className="col-span-5 sm:col-span-4 text-right">
                        <span className="text-[10px] text-slate-400 block">Nilai Batch</span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {formatRupiah(inputVal * line.poPrice)}
                        </span>
                      </div>
                    </div>

                    {isOver && (
                      <p className="text-[10px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>Qty diterima melebihi sisa pesanan ({remaining})</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes / Surat Jalan */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Nomor Surat Jalan / Catatan Gudang (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Surat Jalan SJ-7821 / Pengiriman Tahap 1..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-emerald-600 text-slate-800"
            />
          </div>

          {/* Portion Summary & Double Entry Preview */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300">Total Unit Diterima Event Ini:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{totalQtyToReceive} item</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300">Nilai Persediaan Baru (grandTotalPortion):</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {formatRupiah(estimatedPortionValue)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
              <span>Jurnal Otomatis (§5):</span>
              <span className="font-mono text-[10px] text-slate-400">
                Dr 1310 PERSEDIAAN / {purchase.paymentMethod === 'CASH' ? 'Cr 1110 KAS' : 'Cr 2110 HUTANG_USAHA'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={totalQtyToReceive <= 0}
              className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 ${
                totalQtyToReceive <= 0
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Konfirmasi Terima Barang</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
