import React, { useState } from 'react';
import { Purchase, PurchaseLine, PurchaseReceipt } from '../../types/erp';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah } from '../../utils/formatters';
import { 
  X, 
  FileText, 
  Building2, 
  CheckCircle2, 
  Clock, 
  Truck, 
  ShieldAlert, 
  Layers, 
  CreditCard, 
  Calendar,
  AlertCircle,
  PackageCheck,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { hasPermission } from '../../rbac/permissions';
import { ReturnPurchaseModal } from './ReturnPurchaseModal';

interface PurchaseDetailModalProps {
  isOpen: boolean;
  purchase: Purchase | null;
  onClose: () => void;
  onOpenReceiveModal: (purchase: Purchase, lines: PurchaseLine[]) => void;
}

export const PurchaseDetailModal: React.FC<PurchaseDetailModalProps> = ({
  isOpen,
  purchase,
  onClose,
  onOpenReceiveModal
}) => {
  const { suppliers, products, currentUser, db } = useAppDatabase();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);

  if (!isOpen || !purchase) return null;

  const supplier = suppliers.find(s => s.id === purchase.supplierId);
  const lines = db.getPurchaseLines(purchase.id);
  const receipts = db.getPurchaseReceipts(purchase.id);
  const purchaseReturns = db.getPurchaseReturnsByPurchaseId(purchase.id);

  const totalQtyOrdered = lines.reduce((sum, l) => sum + l.qtyOrdered, 0);
  const totalQtyReceived = lines.reduce((sum, l) => sum + l.qtyReceivedCumulative, 0);
  const percentReceived = totalQtyOrdered > 0 
    ? Math.round((totalQtyReceived / totalQtyOrdered) * 100) 
    : 0;

  const canApprove = hasPermission(currentUser.role, 'PO_APPROVE');
  const canReturnPurchase = hasPermission(currentUser.role, 'PURCHASE_RETURN') && purchase.status === 'RECEIVED';
  const isGudangRole = currentUser.role === 'GUDANG';

  const handleApprove = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = db.approvePurchase(
      purchase.id,
      `${currentUser.name} (${currentUser.role})`,
      currentUser.role
    );

    if (!res.success) {
      setErrorMsg(res.error || 'Gagal menyetujui PO');
    } else {
      setSuccessMsg('PO berhasil disetujui (APPROVED). Siap untuk menerima barang di gudang!');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>DRAFT (Menunggu Approval)</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>APPROVED (Siap Terima Barang)</span>
          </span>
        );
      case 'RECEIVING':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" />
            <span>RECEIVING (Diterima Sebagian)</span>
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
            <PackageCheck className="w-3.5 h-3.5" />
            <span>RECEIVED (Lengkap / Terkunci)</span>
          </span>
        );
      case 'RETURNED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RETURNED (Barang Dikembalikan ke Supplier)</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white leading-tight font-mono">{purchase.id}</h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-sans">
                  {purchase.paymentMethod === 'CREDIT' ? 'Tempo (Kredit)' : 'Tunai (Cash)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Supplier: <strong className="text-white">{supplier?.name || purchase.supplierId}</strong>
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Status & Progress Bar */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-slate-500 block">Status State Machine (§3):</span>
                <div className="mt-1">{getStatusBadge(purchase.status)}</div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Kemajuan Penerimaan:</span>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  {totalQtyReceived} / {totalQtyOrdered} Unit ({percentReceived}%)
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  purchase.status === 'RECEIVED'
                    ? 'bg-emerald-600'
                    : percentReceived > 0
                    ? 'bg-amber-500'
                    : 'bg-slate-300'
                }`}
                style={{ width: `${percentReceived}%` }}
              ></div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl border border-slate-200 bg-white">
            <div>
              <span className="text-[10px] text-slate-400 block">Tanggal Bisnis:</span>
              <span className="font-semibold text-slate-800">{purchase.businessDate}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Pembayaran:</span>
              <span className="font-bold text-slate-800">{purchase.paymentMethod}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Dibuat Oleh:</span>
              <span className="font-medium text-slate-700 truncate block" title={purchase.createdBy}>
                {purchase.createdBy}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Disetujui Oleh:</span>
              <span className="font-medium text-slate-700 truncate block" title={purchase.approvedBy || '-'}>
                {purchase.approvedBy || '-'}
              </span>
            </div>
          </div>

          {purchase.notes && (
            <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
              <strong>Catatan:</strong> {purchase.notes}
            </p>
          )}

          {/* Line Items Table */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-xs">
              Rincian Barang yang Dipesan ({lines.length} Baris):
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="p-2.5">Produk</th>
                    <th className="p-2.5 text-center">Dipesan</th>
                    <th className="p-2.5 text-center">Diterima</th>
                    <th className="p-2.5 text-center">Sisa</th>
                    <th className="p-2.5 text-right">Harga PO</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {lines.map(line => {
                    const prod = products.find(p => p.id === line.productId);
                    const remaining = line.qtyOrdered - line.qtyReceivedCumulative;

                    return (
                      <tr key={line.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5">
                          <span className="font-bold text-slate-900 block">{prod?.name || line.productId}</span>
                          <span className="text-[10px] text-slate-400">{prod?.unit}</span>
                        </td>
                        <td className="p-2.5 text-center font-mono font-semibold text-slate-800">
                          {line.qtyOrdered}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-blue-700">
                          {line.qtyReceivedCumulative}
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {remaining > 0 ? (
                            <span className="font-bold text-amber-700">{remaining}</span>
                          ) : (
                            <span className="text-emerald-700 font-bold text-[11px]">✓ 0</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-700">
                          {formatRupiah(line.poPrice)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(line.qtyOrdered * line.poPrice)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Subtotal Summary */}
            <div className="flex justify-end pt-1 text-xs">
              <div className="w-64 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">{formatRupiah(purchase.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>PPN (0% Bebas):</span>
                  <span className="font-mono">{formatRupiah(purchase.ppnAmount)}</span>
                </div>
                <div className="pt-1 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                  <span>Grand Total PO:</span>
                  <span className="font-mono text-emerald-700">{formatRupiah(purchase.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Riwayat Penerimaan (Receipts) */}
          {receipts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Riwayat Penerimaan Barang ({receipts.length} Event):</span>
              </h4>

              <div className="space-y-1.5">
                {receipts.map(rc => (
                  <div
                    key={rc.id}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-800">{rc.id}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(rc.receivedAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Diterima oleh: <strong className="text-slate-700">{rc.receivedBy}</strong>
                        {rc.notes && ` • ${rc.notes}`}
                      </p>
                    </div>

                    <div className="text-right text-[10px] text-slate-500">
                      {rc.itemsReceived ? (
                        <span className="font-semibold text-slate-700">
                          {rc.itemsReceived.reduce((s, i) => s + i.qtyReceived, 0)} unit diterima
                        </span>
                      ) : (
                        'Barang masuk'
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Separation of Duty Notice (if GUDANG tries to view DRAFT) */}
          {purchase.status === 'DRAFT' && isGudangRole && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>Peringatan Separation of Duty (§3)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Role Anda saat ini adalah <strong>GUDANG</strong> ({currentUser.name}). Anda berwenang membuat draft PO dan menerima barang fisik di gudang, namun persetujuan (Approve) PO <strong>wajib dilakukan oleh OWNER atau ADMIN</strong>. Silakan ganti user di menu atas jika Anda ingin menguji approval sebagai Pak Budi (OWNER).
              </p>
            </div>
          )}

          {/* Purchase Return History if any */}
          {purchaseReturns.length > 0 && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <RotateCcw className="w-3.5 h-3.5 text-purple-700" />
                <span>Riwayat Retur ke Supplier ({purchaseReturns.length} kali):</span>
              </div>
              <div className="divide-y divide-purple-200/60">
                {purchaseReturns.map(pr => (
                  <div key={pr.id} className="py-1 flex justify-between text-[11px]">
                    <div>
                      <span className="font-semibold">{pr.id}</span>
                      <span className="text-purple-700 ml-1">({pr.items.reduce((s, i) => s + i.qtyReturned, 0)} unit) - {pr.reason || 'Retur'}</span>
                    </div>
                    <span className="font-bold text-purple-950 font-mono">{formatRupiah(pr.totalAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {purchase.status === 'RECEIVED' && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <p className="text-xs">
                  PO ini telah berstatus <strong>RECEIVED</strong> (semua pesanan telah lengkap diterima di gudang).
                </p>
              </div>
              {canReturnPurchase && (
                <button
                  type="button"
                  onClick={() => setShowReturnModal(true)}
                  className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-2xs transition flex-shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retur ke Supplier</span>
                </button>
              )}
            </div>
          )}

          {purchase.status === 'RETURNED' && (
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-300 text-purple-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-purple-700 flex-shrink-0" />
              <p className="text-xs">
                PO ini telah berstatus <strong>RETURNED</strong> (seluruh barang telah dikembalikan ke supplier dan hutang/kas telah disesuaikan).
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            {/* Action 1: Approve Button (Only DRAFT, and only for OWNER/ADMIN) */}
            {purchase.status === 'DRAFT' && canApprove && (
              <button
                type="button"
                onClick={handleApprove}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Setujui PO (Approve)</span>
              </button>
            )}

            {/* Action 2: Receive Button (APPROVED or RECEIVING, for OWNER/ADMIN/GUDANG) */}
            {(purchase.status === 'APPROVED' || purchase.status === 'RECEIVING') && (
              <button
                type="button"
                onClick={() => onOpenReceiveModal(purchase, lines)}
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Truck className="w-4 h-4" />
                <span>Terima Barang (Goods Receipt)</span>
              </button>
            )}

            {/* Action 3: Retur ke Supplier (Only RECEIVED, for OWNER/ADMIN) */}
            {canReturnPurchase && (
              <button
                type="button"
                onClick={() => setShowReturnModal(true)}
                className="py-2 px-4 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retur ke Supplier</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Return Purchase Modal */}
      {showReturnModal && (
        <ReturnPurchaseModal
          isOpen={showReturnModal}
          purchase={purchase}
          lines={lines}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => {
            setShowReturnModal(false);
            onClose();
          }}
        />
      )}
    </div>
  );
};
