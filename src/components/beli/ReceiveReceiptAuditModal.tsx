import React from 'react';
import { Purchase, PurchaseReceipt, InventoryLayer, Journal, JournalLine } from '../../types/erp';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah } from '../../utils/formatters';
import { 
  CheckCircle2, 
  Layers, 
  BookOpen, 
  Database, 
  ArrowRight, 
  Building2, 
  X,
  Sparkles,
  Clock
} from 'lucide-react';

interface ReceiveReceiptAuditModalProps {
  isOpen: boolean;
  receipt: PurchaseReceipt;
  purchase: Purchase;
  createdLayers: InventoryLayer[];
  journal: Journal;
  journalLines: JournalLine[];
  grandTotalPortion: number;
  newStatus: string;
  onClose: () => void;
  onOpenInspector: () => void;
}

export const ReceiveReceiptAuditModal: React.FC<ReceiveReceiptAuditModalProps> = ({
  isOpen,
  receipt,
  purchase,
  createdLayers,
  journal,
  journalLines,
  grandTotalPortion,
  newStatus,
  onClose,
  onOpenInspector
}) => {
  const { products, suppliers } = useAppDatabase();

  if (!isOpen) return null;

  const supplier = suppliers.find(s => s.id === purchase.supplierId);
  const totalDebit = journalLines.filter(j => j.side === 'DEBIT').reduce((s, j) => s + j.amount, 0);
  const totalCredit = journalLines.filter(j => j.side === 'CREDIT').reduce((s, j) => s + j.amount, 0);
  const isBalanced = totalDebit === totalCredit;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white text-emerald-700 flex items-center justify-center font-bold shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Barang Berhasil Diterima di Gudang!</h3>
              <p className="text-[11px] text-emerald-100">
                Bukti Tanda Terima: <span className="font-mono font-bold text-white">{receipt.id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Status Progression Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Purchase Order Terkait:</span>
              <span className="font-mono font-bold text-slate-800">{purchase.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Supplier:</span>
              <span className="font-bold text-slate-900">{supplier?.name || purchase.supplierId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Status PO Baru:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                newStatus === 'RECEIVED'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {newStatus} {newStatus === 'RECEIVED' ? '(Lengkap / Terkunci)' : '(Diterima Sebagian)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Penerima:</span>
              <span className="text-slate-700">{receipt.receivedBy}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Waktu Terima:</span>
              <span className="text-slate-600 font-mono text-[11px]">{new Date(receipt.receivedAt).toLocaleTimeString('id-ID')}</span>
            </div>
          </div>

          {/* New FIFO Layers Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>InventoryLayer FIFO Baru Terbentuk ({createdLayers.length})</span>
              </h4>
              <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-semibold">
                Batch Siap Dikonsumsi Kasir
              </span>
            </div>

            <div className="space-y-1.5 font-mono">
              {createdLayers.map(layer => {
                const prod = products.find(p => p.id === layer.productId);
                return (
                  <div
                    key={layer.id}
                    className="p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 font-sans">{prod?.name}</span>
                        <span className="text-[10px] text-slate-500">({layer.id})</span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-sans mt-0.5">
                        Modal Terkunci (PO Price): <strong className="text-slate-800">{formatRupiah(layer.unitCost)}</strong> / {prod?.unit}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-700">
                        +{layer.quantityRemaining} {prod?.unit}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-sans">
                        Subtotal: {formatRupiah(layer.quantityRemaining * layer.unitCost)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Double Entry Accounting Journal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-purple-600" />
                <span>Jurnal Akuntansi Pembelian (§5)</span>
              </h4>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                isBalanced 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}>
                {isBalanced ? '✓ DOUBLE-ENTRY BALANCE' : '⚠ TIDAK BALANCE'}
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden font-mono text-[11px]">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex justify-between text-slate-600 text-[10px] font-sans font-semibold">
                <span>Akun & Keterangan</span>
                <span>Debit / Kredit (Rp)</span>
              </div>

              <div className="divide-y divide-slate-100 bg-white">
                {journalLines.map(line => (
                  <div key={line.id} className="px-3 py-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 mr-2">{line.accountCode}</span>
                      <span className="font-sans text-slate-600">
                        {line.accountCode === '1310' 
                          ? 'Persediaan Barang Dagang' 
                          : line.accountCode === '2110' 
                          ? 'Hutang Usaha' 
                          : 'Kas Toko'}
                      </span>
                    </div>

                    <div className="text-right">
                      {line.side === 'DEBIT' ? (
                        <span className="text-blue-700 font-bold">
                          Dr {formatRupiah(line.amount)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">
                          Cr {formatRupiah(line.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex justify-between font-bold text-slate-800 font-sans text-xs">
                <span>Total Portio Diterima:</span>
                <span className="font-mono text-emerald-700">{formatRupiah(grandTotalPortion)}</span>
              </div>
            </div>

            {purchase.paymentMethod === 'CREDIT' && supplier && (
              <p className="text-[11px] text-slate-500 bg-blue-50 border border-blue-200 p-2.5 rounded-xl">
                💳 <strong>Pembelian Kredit:</strong> Saldo hutang usaha ke supplier <strong>{supplier.name}</strong> otomatis bertambah sebesar <strong className="text-slate-900">{formatRupiah(grandTotalPortion)}</strong>. Saldo hutang terkini: <strong className="text-blue-700">{formatRupiah(supplier.apBalance)}</strong>.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenInspector}
            className="flex-1 py-2 px-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cek di Database Inspector</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
