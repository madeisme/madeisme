import React, { useState } from 'react';
import { Supplier, Purchase, PurchaseLine, Product } from '../../types/erp';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { 
  X, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  RotateCcw, 
  ShoppingCart, 
  Package, 
  Clock, 
  DollarSign, 
  ChevronRight, 
  FileText,
  ExternalLink,
  MessageCircle
} from 'lucide-react';

interface SupplierHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onRepeatOrder: (supplierId: string, items?: Array<{ productId: string; qtyOrdered: number; poPrice: number }>) => void;
  onViewPoDetail?: (poId: string) => void;
}

export const SupplierHistoryModal: React.FC<SupplierHistoryModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onRepeatOrder,
  onViewPoDetail
}) => {
  const { purchases, purchaseLines, products } = useAppDatabase();
  const [activeTab, setActiveTab] = useState<'po' | 'items'>('po');

  if (!isOpen || !supplier) return null;

  // Filter seluruh PO milik supplier ini
  const supplierPurchases = purchases
    .filter(p => p.supplierId === supplier.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalSpent = supplierPurchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0);

  // Kumpulkan item-item yang pernah dibeli
  const poIds = new Set(supplierPurchases.map(p => p.id));
  const relevantLines = purchaseLines.filter(pl => poIds.has(pl.purchaseId));

  const itemsMap = new Map<string, {
    product: Product | undefined;
    totalQtyOrdered: number;
    lastPrice: number;
    lastDate: string;
    orderCount: number;
  }>();

  for (const line of relevantLines) {
    const parentPo = supplierPurchases.find(p => p.id === line.purchaseId);
    const date = parentPo?.businessDate || '';
    const existing = itemsMap.get(line.productId);

    if (existing) {
      existing.totalQtyOrdered += line.qtyOrdered;
      existing.orderCount += 1;
      if (date >= existing.lastDate) {
        existing.lastDate = date;
        existing.lastPrice = line.poPrice;
      }
    } else {
      const prod = products.find(p => p.id === line.productId);
      itemsMap.set(line.productId, {
        product: prod,
        totalQtyOrdered: line.qtyOrdered,
        lastPrice: line.poPrice,
        lastDate: date,
        orderCount: 1
      });
    }
  }

  const purchasedProducts = Array.from(itemsMap.values());

  const handleRepeatSpecificPo = (po: Purchase) => {
    const linesForPo = purchaseLines.filter(pl => pl.purchaseId === po.id);
    const items = linesForPo.map(l => ({
      productId: l.productId,
      qtyOrdered: l.qtyOrdered,
      poPrice: l.poPrice
    }));
    onClose();
    onRepeatOrder(supplier.id, items);
  };

  const handleRepeatAllHistory = () => {
    const items = purchasedProducts.map(item => ({
      productId: item.product?.id || '',
      qtyOrdered: Math.max(1, Math.round(item.totalQtyOrdered / item.orderCount) || 10),
      poPrice: item.lastPrice
    })).filter(i => Boolean(i.productId));

    onClose();
    onRepeatOrder(supplier.id, items.length > 0 ? items : undefined);
  };

  const cleanPhone = (supplier.phone || '').replace(/[^0-9]/g, '');
  const waUrl = cleanPhone.startsWith('0') 
    ? `https://wa.me/62${cleanPhone.slice(1)}` 
    : cleanPhone.startsWith('62') 
    ? `https://wa.me/${cleanPhone}` 
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">{supplier.name}</h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  supplier.isActive !== false ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'
                }`}>
                  {supplier.isActive !== false ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2">
                <span>ID: {supplier.id}</span>
                {supplier.city && <span>• {supplier.city}</span>}
                {supplier.contactPerson && <span>• PIC: {supplier.contactPerson}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Contact & Bank Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-slate-700">
            {supplier.phone && (
              <div className="flex items-center gap-1.5 font-medium">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>{supplier.phone}</span>
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[10px] transition"
                    title="Buka Chat WhatsApp"
                  >
                    <MessageCircle className="w-3 h-3 text-emerald-700" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>{supplier.email}</span>
              </div>
            )}
            {supplier.bankAccountNo && (
              <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                <span>{supplier.bankName || 'Bank'}: <strong className="font-mono">{supplier.bankAccountNo}</strong> ({supplier.bankAccountName || supplier.name})</span>
              </div>
            )}
          </div>

          {/* Repeat Order Top Button */}
          <button
            onClick={handleRepeatAllHistory}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 text-xs shadow-xs transition ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Pesan Ulang Cepat (PO Baru)</span>
          </button>
        </div>

        {/* Financial & Order KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 pb-3">
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
            <span className="text-[11px] font-semibold text-blue-800 block">Total Pesanan (PO)</span>
            <div className="text-xl font-bold text-blue-950 mt-0.5">
              {supplierPurchases.length} <span className="text-xs font-normal text-blue-700">transaksi</span>
            </div>
            <span className="text-[10px] text-blue-600">
              {purchasedProducts.length} jenis item pernah dibeli
            </span>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
            <span className="text-[11px] font-semibold text-emerald-800 block">Total Belanja Historis</span>
            <div className="text-xl font-bold text-emerald-950 mt-0.5">
              {formatRupiah(totalSpent)}
            </div>
            <span className="text-[10px] text-emerald-600">
              Termin tempo: {supplier.paymentTermsDays || 0} hari
            </span>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl">
            <span className="text-[11px] font-semibold text-amber-800 block">Hutang Berjalan (AP)</span>
            <div className="text-xl font-bold text-amber-950 mt-0.5">
              {formatRupiah(supplier.apBalance || 0)}
            </div>
            <span className="text-[10px] text-amber-700">
              {(supplier.apBalance || 0) > 0 ? 'Ada tagihan jatuh tempo' : 'Tidak ada tagihan tertunggak'}
            </span>
          </div>
        </div>

        {/* Sub-tab Switcher: Daftar PO vs Barang yang Pernah Dibeli */}
        <div className="px-5 border-b border-slate-200 flex items-center gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('po')}
            className={`pb-2.5 pt-1 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'po'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Riwayat Purchase Order ({supplierPurchases.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`pb-2.5 pt-1 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'items'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Katalog Barang Yang Pernah Dibeli ({purchasedProducts.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {activeTab === 'po' ? (
            <div className="space-y-2.5">
              {supplierPurchases.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold">Belum ada riwayat PO ke supplier ini</p>
                  <p className="text-[11px] mt-1">Gunakan tombol "Pesan Ulang Cepat" di atas untuk membuat PO perdana.</p>
                </div>
              ) : (
                supplierPurchases.map(po => {
                  const poLines = purchaseLines.filter(pl => pl.purchaseId === po.id);
                  const itemCount = poLines.reduce((s, l) => s + l.qtyOrdered, 0);

                  const statusColors: Record<string, string> = {
                    DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
                    APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
                    RECEIVING: 'bg-amber-50 text-amber-700 border-amber-200',
                    RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200'
                  };

                  return (
                    <div
                      key={po.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 font-mono text-sm">{po.id}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusColors[po.status] || 'bg-slate-100'}`}>
                            {po.status}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            • {formatDateIndo(po.businessDate)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          {poLines.length} macam barang ({itemCount} total unit) • Metode: <strong className="text-slate-800">{po.paymentMethod}</strong>
                          {po.notes && ` • "${po.notes}"`}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 block">Total Nilai PO</span>
                          <span className="font-bold text-slate-900 text-sm">{formatRupiah(po.grandTotal)}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {onViewPoDetail && (
                            <button
                              onClick={() => {
                                onClose();
                                onViewPoDetail(po.id);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[11px] transition"
                              title="Lihat Detail PO"
                            >
                              Detail
                            </button>
                          )}
                          <button
                            onClick={() => handleRepeatSpecificPo(po)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-[11px] flex items-center gap-1 transition"
                            title="Pesan ulang item yang sama persis dari PO ini"
                          >
                            <RotateCcw className="w-3 h-3 text-emerald-600" />
                            <span>Pesan Ulang PO Ini</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {purchasedProducts.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold">Belum ada data barang dari supplier ini</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100/90 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Nama Produk</th>
                        <th className="py-2.5 px-3">Satuan</th>
                        <th className="py-2.5 px-3 text-right">Total Akumulasi</th>
                        <th className="py-2.5 px-3 text-right">Harga Beli Terakhir</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {purchasedProducts.map(item => (
                        <tr key={item.product?.id || Math.random()} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {item.product?.name || 'Produk dihapus'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {item.product?.unit || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {item.totalQtyOrdered} {item.product?.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatRupiah(item.lastPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                if (!item.product) return;
                                onClose();
                                onRepeatOrder(supplier.id, [{
                                  productId: item.product.id,
                                  qtyOrdered: 10,
                                  poPrice: item.lastPrice
                                }]);
                              }}
                              className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[10px] border border-blue-200 inline-flex items-center gap-1 transition"
                            >
                              <RotateCcw className="w-3 h-3 text-blue-600" />
                              <span>Pesan Barang Ini</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {supplier.address && `Alamat: ${supplier.address}`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
