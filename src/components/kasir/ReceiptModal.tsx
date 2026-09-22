import React, { useState } from 'react';
import { Sale, SaleLine, Journal, JournalLine, InventoryLayer } from '../../types/erp';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { 
  CheckCircle2, 
  Receipt, 
  Layers, 
  BookOpen, 
  Printer, 
  X, 
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { db } from '../../database/appDatabase';
import { useAppDatabase } from '../../database/useAppDatabase';
import { hasPermission } from '../../rbac/permissions';
import { VoidSaleModal } from '../retur/VoidSaleModal';
import { ReturnSaleModal } from '../retur/ReturnSaleModal';

interface ReceiptModalProps {
  isOpen: boolean;
  sale: Sale;
  saleLines: SaleLine[];
  journal?: Journal;
  journalLines?: JournalLine[];
  onClose: () => void;
  onOpenInspector?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  sale,
  saleLines,
  journal,
  journalLines = [],
  onClose,
  onOpenInspector
}) => {
  const { currentUser } = useAppDatabase();
  const [showAuditDetails, setShowAuditDetails] = useState(true);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  if (!isOpen) return null;

  const store = db.getStore();
  const allProducts = db.getAllProducts();
  const saleReturns = db.getSaleReturnsBySaleId(sale.id);

  const totalDebit = journalLines
    .filter(l => l.side === 'DEBIT')
    .reduce((sum, l) => sum + l.amount, 0);

  const totalCredit = journalLines
    .filter(l => l.side === 'CREDIT')
    .reduce((sum, l) => sum + l.amount, 0);

  const isBalanced = totalDebit === totalCredit;

  const canVoid = hasPermission(currentUser.role, 'SALE_VOID') && sale.status === 'COMMITTED';
  const canReturn = hasPermission(currentUser.role, 'SALE_RETURN') && (sale.status === 'COMMITTED' || sale.status === 'PARTIALLY_RETURNED');

  const getHeaderGradient = () => {
    switch (sale.status) {
      case 'REVERSED':
        return 'from-red-800 to-rose-900';
      case 'RETURNED':
        return 'from-purple-800 to-indigo-900';
      case 'PARTIALLY_RETURNED':
        return 'from-amber-700 to-yellow-800';
      default:
        return 'from-emerald-700 to-teal-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Dynamic Header */}
        <div className={`bg-gradient-to-r ${getHeaderGradient()} text-white p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
              {sale.status === 'REVERSED' ? (
                <RotateCcw className="w-5 h-5 text-white" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                {sale.status === 'REVERSED' 
                  ? 'Transaksi Dibatalkan (REVERSED / VOID)'
                  : sale.status === 'RETURNED'
                  ? 'Transaksi Diretur Penuh (RETURNED)'
                  : sale.status === 'PARTIALLY_RETURNED'
                  ? 'Transaksi Diretur Sebagian'
                  : 'Transaksi Penjualan Resmi'}
              </h3>
              <p className="text-[11px] text-white/80">Status: {sale.status} (Room Database)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Receipt Simulation */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {sale.status === 'REVERSED' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold block">Status Transaksi: REVERSED (VOID)</span>
                <span>Seluruh efek penjualan telah dibalik melalui Jurnal Pembalik, dan stok barang telah dipulihkan ke batch layer FIFO per tanggal transaksi.</span>
              </div>
            </div>
          )}

          {saleReturns.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                <span>Riwayat Retur Pada Transaksi Ini ({saleReturns.length} kali retur):</span>
              </div>
              <div className="divide-y divide-amber-200/60 pt-1">
                {saleReturns.map(sr => (
                  <div key={sr.id} className="py-1 flex justify-between text-[11px]">
                    <span>{sr.id} ({sr.items.reduce((s, i) => s + i.qtyReturned, 0)} item) - {sr.reason || 'Retur'}</span>
                    <span className="font-bold">{formatRupiah(sr.totalRefund)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/90 font-mono text-xs space-y-3">
            {/* Store & Receipt Metadata */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <h2 className="font-bold font-sans text-sm text-slate-900 tracking-tight">
                {store.name}
              </h2>
              <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                {sale.paymentMethod === 'CREDIT' ? 'Nota Penjualan Kredit (Tempo) Sembako' : 'Struk Resmi Penjualan Tunai Sembako'}
              </p>
              <div className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                <div>No: <span className="font-bold text-slate-800">{sale.id}</span></div>
                <div>Waktu: {formatDateTimeIndo(sale.createdAt)}</div>
                <div>Kasir: {sale.cashierName}</div>
                {sale.customerId && (
                  <div>
                    Pelanggan: <span className="font-bold text-slate-800">{db.getCustomerById(sale.customerId)?.name || sale.customerId}</span>
                  </div>
                )}
                <div>
                  Cara Bayar: <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${sale.paymentMethod === 'CREDIT' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                    {sale.paymentMethod === 'CREDIT' ? 'TEMPO (KREDIT)' : 'TUNAI (CASH)'}
                  </span>
                </div>
                {sale.dueDate && (
                  <div className="text-amber-800 font-bold">
                    Jatuh Tempo: {sale.dueDate}
                  </div>
                )}
                {sale.creditOverride && (
                  <div className="text-red-700 font-bold text-[10px]">
                    * Otorisasi Override Limit Kredit Diizinkan
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
              {saleLines.map(line => {
                const product = allProducts.find(p => p.id === line.productId);
                return (
                  <div key={line.id} className="text-xs">
                    <div className="flex justify-between font-semibold text-slate-800">
                      <span className="truncate pr-2 font-sans">{product?.name || line.productId}</span>
                      <span>{formatRupiah(line.qty * line.unitPrice)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>{line.qty} {product?.unit || 'unit'} × {formatRupiah(line.unitPrice)}</span>
                      <span className="text-[10px] text-slate-400">HPP: {formatRupiah(line.hppLine)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals & Payments */}
            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatRupiah(sale.subtotal)}</span>
              </div>
              {sale.discountAmount && sale.discountAmount > 0 ? (
                <div className="flex justify-between text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                  <span>Diskon Promo {sale.discountCode ? `(${sale.discountCode})` : ''}:</span>
                  <span>-{formatRupiah(sale.discountAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-500">
                <span>PPN {sale.ppnAmount > 0 ? '11%' : '0% (Bebas PPN)'}:</span>
                <span>{formatRupiah(sale.ppnAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>TOTAL:</span>
                <span className="text-emerald-700">{formatRupiah(sale.grandTotal)}</span>
              </div>
              {sale.paymentMethod === 'CREDIT' ? (
                <>
                  <div className="flex justify-between pt-1 text-amber-800 font-semibold">
                    <span>Metode Bayar:</span>
                    <span>KREDIT (TEMPO)</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-900">
                    <span>Piutang Tercatat (AR):</span>
                    <span>+{formatRupiah(sale.grandTotal)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between pt-1 text-slate-600">
                    <span>Tunai (CASH):</span>
                    <span>{formatRupiah(sale.cashPaid)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Kembalian:</span>
                    <span className="text-emerald-800">{formatRupiah(sale.changeAmount)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center pt-2 text-[10px] text-slate-400 font-sans">
              Terima kasih telah berbelanja di {store.name}
            </div>
          </div>

          {/* Collapsible Accordion: FIFO & Accounting Audit Trail */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <button
              onClick={() => setShowAuditDetails(!showAuditDetails)}
              className="w-full bg-slate-100 hover:bg-slate-150 p-3 text-left font-bold text-slate-800 flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Audit FIFO & Jurnal Otomatis (§5 & §7)</span>
              </div>
              {showAuditDetails ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>

            {showAuditDetails && (
              <div className="p-3.5 bg-white space-y-3 divide-y divide-slate-100">
                {/* FIFO Inventory Layer Consumption */}
                <div>
                  <h4 className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Konsumsi Batch Stok (FIFO Tertua Duluan):</span>
                  </h4>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {saleLines.map(line => {
                      const product = allProducts.find(p => p.id === line.productId);
                      return (
                        <div key={line.id} className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                          <p className="font-sans font-semibold text-slate-800">{product?.name}:</p>
                          {line.consumedLayers && line.consumedLayers.length > 0 ? (
                            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-600">
                              {line.consumedLayers.map((c, idx) => (
                                <li key={idx}>
                                  Batch <span className="font-bold text-slate-800">{c.layerId}</span>: diambil {c.qty} {product?.unit} @ HPP {formatRupiah(c.unitCost)} = {formatRupiah(c.qty * c.unitCost)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-slate-400">Total HPP Baris: {formatRupiah(line.hppLine)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Double-Entry Balanced Journal */}
                <div className="pt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                      <span>Jurnal Umum Ter-Generate ({journal?.id}):</span>
                    </h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isBalanced ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-red-100 text-red-900'}`}>
                      {isBalanced ? '✓ Double-Entry Seimbang' : '✕ Tidak Seimbang'}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 font-mono text-[11px]">
                    <div className="space-y-1">
                      {journalLines.map(jl => (
                        <div key={jl.id} className="flex justify-between text-slate-700">
                          <span className={jl.side === 'CREDIT' ? 'pl-4' : 'font-semibold'}>
                            {jl.side === 'DEBIT' ? 'Dr' : 'Cr'} {jl.accountCode}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {formatRupiah(jl.amount)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between text-[11px] font-bold text-slate-900">
                      <span>Total Debit: {formatRupiah(totalDebit)}</span>
                      <span>Total Credit: {formatRupiah(totalCredit)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onOpenInspector && (
              <button
                onClick={() => {
                  onClose();
                  onOpenInspector();
                }}
                className="text-xs text-slate-600 hover:text-slate-900 underline font-medium"
              >
                Cek di Room DB Inspector
              </button>
            )}

            {/* Prompt 5 RBAC Action Buttons */}
            {canVoid && (
              <button
                type="button"
                onClick={() => setShowVoidModal(true)}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                <span>Void Transaksi</span>
              </button>
            )}

            {canReturn && (
              <button
                type="button"
                onClick={() => setShowReturnModal(true)}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                <span>Retur Barang</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modals for Void and Return */}
      {showVoidModal && (
        <VoidSaleModal
          isOpen={showVoidModal}
          sale={sale}
          saleLines={saleLines}
          onClose={() => setShowVoidModal(false)}
          onSuccess={() => {
            setShowVoidModal(false);
            onClose();
          }}
          onOpenInspector={onOpenInspector}
        />
      )}

      {showReturnModal && (
        <ReturnSaleModal
          isOpen={showReturnModal}
          sale={sale}
          saleLines={saleLines}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => {
            setShowReturnModal(false);
            onClose();
          }}
          onOpenInspector={onOpenInspector}
        />
      )}
    </div>
  );
};
