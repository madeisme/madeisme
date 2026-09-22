import React, { useState, useEffect } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah } from '../../utils/formatters';
import { Purchase, PurchaseLine, PurchasePaymentMethod } from '../../types/erp';
import { 
  X, 
  Plus, 
  Trash2, 
  FileText, 
  Building2, 
  CreditCard, 
  DollarSign, 
  AlertCircle,
  CheckCircle2,
  Calendar,
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface CreatePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (poId: string) => void;
  initialSupplierId?: string;
  initialLines?: Array<{ productId: string; qtyOrdered: number; poPrice: number }>;
}

interface NewPOLineItem {
  tempId: string;
  productId: string;
  qtyOrdered: number;
  poPrice: number;
}

export const CreatePurchaseModal: React.FC<CreatePurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialSupplierId,
  initialLines
}) => {
  const { suppliers, products, currentUser, db } = useAppDatabase();

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    initialSupplierId || suppliers[0]?.id || ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('CREDIT');
  const [businessDate, setBusinessDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Line items state
  const [lines, setLines] = useState<NewPOLineItem[]>([
    {
      tempId: 'line-1',
      productId: products[0]?.id || '',
      qtyOrdered: 10,
      poPrice: Math.round((products[0]?.sellPrice || 10000) * 0.85)
    }
  ]);

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      if (initialSupplierId) {
        setSelectedSupplierId(initialSupplierId);
      } else if (!selectedSupplierId && suppliers.length > 0) {
        setSelectedSupplierId(suppliers[0].id);
      }

      if (initialLines && initialLines.length > 0) {
        setLines(initialLines.map((l, idx) => ({
          tempId: `line-init-${idx}-${Date.now()}`,
          productId: l.productId,
          qtyOrdered: l.qtyOrdered,
          poPrice: l.poPrice
        })));
      } else if (lines.length === 0 && products.length > 0) {
        setLines([{
          tempId: 'line-1',
          productId: products[0].id,
          qtyOrdered: 10,
          poPrice: Math.round(products[0].sellPrice * 0.85)
        }]);
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialSupplierId]);

  if (!isOpen) return null;

  // Helper untuk Memuat Barang yang Pernah Dipesan dari Supplier Terpilih (Repeat Order)
  const handleLoadSupplierPastItems = () => {
    if (!selectedSupplierId) return;
    const allPurchases = db.getAllPurchases().filter(p => p.supplierId === selectedSupplierId);
    if (allPurchases.length === 0) {
      setErrorMsg('Belum ada riwayat pembelian sebelumnya untuk supplier ini.');
      return;
    }

    const pastPoIds = allPurchases.map(p => p.id);
    const allLines = db.getAllPurchaseLines().filter(pl => pastPoIds.includes(pl.purchaseId));
    
    // Ambil item unik beserta harga terakhir
    const productMap = new Map<string, { qty: number; poPrice: number }>();
    for (const pl of allLines) {
      if (!productMap.has(pl.productId)) {
        productMap.set(pl.productId, { qty: pl.qtyOrdered, poPrice: pl.poPrice });
      }
    }

    if (productMap.size === 0) {
      setErrorMsg('Tidak ditemukan item barang dari riwayat PO sebelumnya.');
      return;
    }

    const loadedLines: NewPOLineItem[] = Array.from(productMap.entries()).map(([prodId, val], idx) => ({
      tempId: `line-reorder-${idx}-${Date.now()}`,
      productId: prodId,
      qtyOrdered: val.qty,
      poPrice: val.poPrice
    }));

    setLines(loadedLines);
    setErrorMsg(null);
  };

  const handleAddLine = () => {
    const defaultProduct = products[0];
    setLines([
      ...lines,
      {
        tempId: `line-${Date.now()}-${Math.random()}`,
        productId: defaultProduct ? defaultProduct.id : '',
        qtyOrdered: 10,
        poPrice: defaultProduct ? Math.round(defaultProduct.sellPrice * 0.85) : 10000
      }
    ]);
  };

  const handleRemoveLine = (tempId: string) => {
    if (lines.length <= 1) {
      setErrorMsg('PO harus memiliki minimal 1 baris item');
      return;
    }
    setLines(lines.filter(l => l.tempId !== tempId));
    setErrorMsg(null);
  };

  const handleProductChange = (tempId: string, newProductId: string) => {
    const prod = products.find(p => p.id === newProductId);
    const defaultPrice = prod ? Math.round(prod.sellPrice * 0.85) : 10000;
    setLines(lines.map(l => {
      if (l.tempId === tempId) {
        return {
          ...l,
          productId: newProductId,
          poPrice: defaultPrice
        };
      }
      return l;
    }));
  };

  const handleQtyChange = (tempId: string, qty: number) => {
    setLines(lines.map(l => (l.tempId === tempId ? { ...l, qtyOrdered: Math.max(1, qty) } : l)));
  };

  const handlePriceChange = (tempId: string, price: number) => {
    setLines(lines.map(l => (l.tempId === tempId ? { ...l, poPrice: Math.max(0, price) } : l)));
  };

  // Calculations
  const subtotal = lines.reduce((sum, l) => sum + (l.qtyOrdered * l.poPrice), 0);
  const ppnAmount = 0; // Sembako default bebas PPN
  const grandTotal = subtotal + ppnAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedSupplierId) {
      setErrorMsg('Pilih supplier terlebih dahulu');
      return;
    }

    if (lines.length === 0) {
      setErrorMsg('Tambahkan minimal 1 item produk');
      return;
    }

    for (const line of lines) {
      if (!line.productId) {
        setErrorMsg('Pilih produk yang valid di setiap baris');
        return;
      }
      if (line.qtyOrdered <= 0) {
        setErrorMsg('Qty pesanan harus lebih dari 0');
        return;
      }
      if (line.poPrice < 0) {
        setErrorMsg('Harga PO tidak boleh negatif');
        return;
      }
    }

    const poNumber = `PO-${Date.now().toString().slice(-8)}`;
    const newPurchase: Purchase = {
      id: poNumber,
      supplierId: selectedSupplierId,
      status: 'DRAFT', // Aturan state machine: selalu mulai dari DRAFT
      paymentMethod: paymentMethod,
      businessDate: businessDate,
      subtotal: subtotal,
      ppnAmount: ppnAmount,
      grandTotal: grandTotal,
      createdBy: `${currentUser.name} (${currentUser.role})`,
      createdAt: new Date().toISOString(),
      notes: notes.trim() || undefined
    };

    const newPurchaseLines: PurchaseLine[] = lines.map((l, idx) => ({
      id: `${poNumber}-${idx + 1}`,
      purchaseId: poNumber,
      productId: l.productId,
      qtyOrdered: l.qtyOrdered,
      qtyReceivedCumulative: 0,
      poPrice: l.poPrice
    }));

    const result = db.insertPurchase(newPurchase, newPurchaseLines);
    if (!result.success) {
      setErrorMsg(result.error || 'Gagal menyimpan Purchase Order');
      return;
    }

    onSuccess(poNumber);
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Buat Purchase Order (PO) Baru</h3>
              <p className="text-[11px] text-slate-300">
                Pemesanan barang ke supplier • Status awal: <span className="font-semibold text-amber-300">DRAFT</span>
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

          {/* Supplier & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Supplier Selector */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Pilih Supplier</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 font-medium text-slate-800"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Hutang: {formatRupiah(s.apBalance)})
                  </option>
                ))}
              </select>
              {selectedSupplier && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Telp: {selectedSupplier.phone} • Saldo Hutang Berjalan: {formatRupiah(selectedSupplier.apBalance)}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>Metode Pembayaran</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDIT')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'CREDIT'
                      ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>KREDIT (Tempo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>TUNAI (Cash)</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                {paymentMethod === 'CREDIT' 
                  ? 'Menambah Saldo Hutang Usaha (Akun 2110) saat barang diterima' 
                  : 'Memotong Kas (Akun 1110) saat barang diterima'}
              </p>
            </div>
          </div>

          {/* Business Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Tanggal Bisnis</span>
              </label>
              <input
                type="date"
                value={businessDate}
                onChange={e => setBusinessDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Catatan Pengadaan (Opsional)</label>
              <input
                type="text"
                placeholder="Contoh: Pengiriman via armada supplier..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800"
              />
            </div>
          </div>

          {/* Line Items List */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-800">
                Daftar Barang yang Dipesan ({lines.length} Item)
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleLoadSupplierPastItems}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 transition"
                  title="Muat daftar barang yang pernah dipesan dari supplier ini"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Muat Riwayat Supplier</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Item</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, idx) => {
                const prod = products.find(p => p.id === line.productId);
                const lineTotal = line.qtyOrdered * line.poPrice;

                return (
                  <div
                    key={line.tempId}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500 font-mono">
                        #{idx + 1}
                      </span>
                      <select
                        value={line.productId}
                        onChange={e => handleProductChange(line.tempId, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-600"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                      </select>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.tempId)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-12 gap-2 text-xs">
                      <div className="col-span-4">
                        <label className="text-[10px] text-slate-500 block mb-0.5">
                          Qty ({prod?.unit || 'unit'})
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={line.qtyOrdered}
                          onChange={e => handleQtyChange(line.tempId, parseInt(e.target.value) || 1)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono font-bold text-slate-800 text-center"
                        />
                      </div>

                      <div className="col-span-4">
                        <label className="text-[10px] text-slate-500 block mb-0.5">
                          Harga Beli PO (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={line.poPrice}
                          onChange={e => handlePriceChange(line.tempId, parseInt(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono font-semibold text-slate-800 text-right"
                        />
                      </div>

                      <div className="col-span-4 text-right flex flex-col justify-center">
                        <span className="text-[10px] text-slate-500 block">Subtotal</span>
                        <span className="font-bold text-slate-900 font-mono text-xs">
                          {formatRupiah(lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Box */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-1.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Subtotal Pembelian:</span>
              <span className="font-mono font-medium">{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>PPN Masukan (Default Sembako 0%):</span>
              <span className="font-mono">{formatRupiah(ppnAmount)}</span>
            </div>
            <div className="pt-2 border-t border-slate-700 flex justify-between text-sm font-bold text-emerald-400">
              <span>Estimasi Grand Total PO:</span>
              <span className="font-mono">{formatRupiah(grandTotal)}</span>
            </div>
          </div>

          {/* SoD & Workflow Note */}
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
              <span>Aturan Alur Persetujuan (Separation of Duty §3):</span>
            </p>
            <p className="text-[10px] text-amber-800 leading-relaxed">
              Dibuat oleh: <strong>{currentUser.name} ({currentUser.role})</strong>. Status awal adalah <strong>DRAFT</strong>. PO harus disetujui (APPROVED) oleh <strong>OWNER</strong> atau <strong>ADMIN</strong> sebelum barang dapat diterima di gudang.
            </p>
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
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Purchase Order (DRAFT)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
