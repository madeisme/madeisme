import React, { useState, useMemo } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { Customer, ArTransaction, Journal, JournalLine } from '../../types/erp';
import { hasPermission } from '../../rbac/permissions';
import { formatRupiah, formatDateIndo, formatDateTimeIndo } from '../../utils/formatters';
import { 
  X, 
  Coins, 
  User as UserIcon, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  FileText, 
  ShieldCheck, 
  ArrowRight,
  Receipt,
  Check
} from 'lucide-react';

interface ArSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomerId?: string;
  onOpenInspector?: () => void;
}

export const ArSettlementModal: React.FC<ArSettlementModalProps> = ({
  isOpen,
  onClose,
  initialCustomerId,
  onOpenInspector
}) => {
  const { customers, currentUser, db, arTransactions } = useAppDatabase();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialCustomerId || (customers.find(c => c.arBalance > 0)?.id || customers[0]?.id || '')
  );
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | undefined>(undefined);
  const [notesInput, setNotesInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Success Settlement State
  const [successResult, setSuccessResult] = useState<{
    arTransaction: ArTransaction;
    journal: Journal;
    journalLines: JournalLine[];
    customerName: string;
    newArBalance: number;
    amountPaid: number;
  } | null>(null);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // Retrieve customer credit sales with computed settlement status (FIFO)
  const creditSalesWithSettlement = useMemo(() => {
    if (!selectedCustomerId) return [];
    return db.getCustomerCreditSalesWithSettlement(selectedCustomerId);
  }, [db, selectedCustomerId, successResult, arTransactions]);

  const parsedPaymentAmount = Number(paymentAmountInput) || 0;

  // Filter customers for dropdown/search
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch) ||
      c.id.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [customers, customerSearch]);

  if (!isOpen) return null;

  // Validation rules (§5)
  const isAmountPositive = parsedPaymentAmount > 0;
  const isExceedingBalance = selectedCustomer ? parsedPaymentAmount > selectedCustomer.arBalance : false;
  const canSubmit = selectedCustomer && isAmountPositive && !isExceedingBalance && !isProcessing;

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedSaleId(undefined);
    setPaymentAmountInput('');
    setErrorMessage(null);
    setSuccessResult(null);
  };

  const handleQuickPayAll = () => {
    if (!selectedCustomer) return;
    setPaymentAmountInput(String(selectedCustomer.arBalance));
    setSelectedSaleId(undefined);
    setErrorMessage(null);
  };

  const handleQuickPaySale = (saleId: string, remainingBalance: number) => {
    setSelectedSaleId(saleId);
    setPaymentAmountInput(String(remainingBalance));
    setErrorMessage(null);
  };

  const handleConfirmSettlement = () => {
    if (!hasPermission(currentUser.role, 'AR_SETTLE')) {
      setErrorMessage('Akses ditolak: Peran Anda tidak memiliki hak akses pelunasan piutang (AR_SETTLE). Diperlukan peran OWNER, ADMIN, atau BOOKKEEPER.');
      return;
    }

    if (!selectedCustomer) {
      setErrorMessage('Pilih pelanggan terlebih dahulu');
      return;
    }

    if (parsedPaymentAmount <= 0) {
      setErrorMessage('Nominal pelunasan harus lebih dari Rp 0');
      return;
    }

    // Strict Prompt 4 Rule: Kembalian tidak diperbolehkan
    if (parsedPaymentAmount > selectedCustomer.arBalance) {
      setErrorMessage(
        `Jumlah bayar melebihi piutang yang dipilih (Piutang saat ini: ${formatRupiah(selectedCustomer.arBalance)}, Input: ${formatRupiah(parsedPaymentAmount)})`
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const result = db.settleArPayment({
        customerId: selectedCustomer.id,
        amount: parsedPaymentAmount,
        businessDate: today,
        cashierName: currentUser.name,
        userRole: currentUser.role,
        notes: notesInput || undefined,
        selectedSaleId: selectedSaleId
      });

      if (!result.success || !result.arTransaction || !result.journal || !result.journalLines) {
        setErrorMessage(result.errorMessage || 'Gagal memproses pelunasan');
        setIsProcessing(false);
        return;
      }

      setSuccessResult({
        arTransaction: result.arTransaction,
        journal: result.journal,
        journalLines: result.journalLines,
        customerName: selectedCustomer.name,
        newArBalance: result.newArBalance ?? 0,
        amountPaid: parsedPaymentAmount
      });
      setPaymentAmountInput('');
      setSelectedSaleId(undefined);
      setNotesInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
              <Coins className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Pelunasan Piutang Pelanggan (AR)</h3>
              <p className="text-[11px] text-slate-300">Prompt 4: Pembayaran Tempo & Jurnal Berpasangan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Success Notification Box */}
          {successResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-emerald-900 text-sm">
                      Pelunasan Sebesar {formatRupiah(successResult.amountPaid)} Berhasil!
                    </h4>
                    <p className="text-[11px] text-emerald-700">
                      Pelanggan: <span className="font-semibold">{successResult.customerName}</span> • Sisa Piutang: <span className="font-bold">{formatRupiah(successResult.newArBalance)}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSuccessResult(null)}
                  className="text-emerald-600 hover:text-emerald-900 text-[11px] font-semibold underline"
                >
                  Tutup Notifikasi
                </button>
              </div>

              <div className="bg-white/90 p-3 rounded-lg border border-emerald-200 font-mono text-[11px] space-y-1">
                <div className="flex justify-between text-slate-700">
                  <span>ID Transaksi AR:</span>
                  <span className="font-bold text-slate-900">{successResult.arTransaction.id}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>ID Jurnal Akuntansi:</span>
                  <span className="font-bold text-slate-900">{successResult.journal.id}</span>
                </div>
                <div className="pt-1.5 border-t border-dashed border-emerald-200 space-y-0.5">
                  <div className="flex justify-between text-slate-800">
                    <span>[Dr] 1110 KAS:</span>
                    <span className="font-bold text-emerald-700">{formatRupiah(successResult.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between text-slate-800">
                    <span>[Cr] 1210 PIUTANG_USAHA:</span>
                    <span className="font-bold text-emerald-700">{formatRupiah(successResult.amountPaid)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customer Selection Row */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center justify-between">
              <span>Pilih Pelanggan:</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {customers.filter(c => c.arBalance > 0).length} pelanggan memiliki piutang aktif
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-xl bg-white font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="" disabled>-- Pilih Pelanggan --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.arBalance > 0 ? `(Piutang: ${formatRupiah(c.arBalance)})` : '(Lunas/Rp 0)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick info if customer has debt */}
              {selectedCustomer && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Total Piutang Berjalan:</span>
                    <span className={`font-bold text-sm ${selectedCustomer.arBalance > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                      {formatRupiah(selectedCustomer.arBalance)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Plafon Limit:</span>
                    <span className="font-semibold text-slate-700 text-xs">
                      {selectedCustomer.creditLimit > 0 ? formatRupiah(selectedCustomer.creditLimit) : 'Tidak ada limit (Rp 0)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selected Customer Credit Profile Card */}
          {selectedCustomer && (
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Saldo Piutang</span>
                <span className="text-sm font-bold text-amber-700 block mt-0.5">
                  {formatRupiah(selectedCustomer.arBalance)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Plafon Limit</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">
                  {formatRupiah(selectedCustomer.creditLimit)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Sisa Plafon</span>
                <span className="text-sm font-bold text-emerald-700 block mt-0.5">
                  {formatRupiah(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.arBalance))}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Ketentuan Tempo</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">
                  {selectedCustomer.creditTermsDays || 30} Hari
                </span>
              </div>
            </div>
          )}

          {/* Daftar Sale Kredit Milik Pelanggan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Daftar Nota Kredit Pelanggan ({creditSalesWithSettlement.length} Transaksi)</span>
              </h4>
              {selectedCustomer && selectedCustomer.arBalance > 0 && (
                <button
                  type="button"
                  onClick={handleQuickPayAll}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Lunasi Semua ({formatRupiah(selectedCustomer.arBalance)})</span>
                </button>
              )}
            </div>

            {creditSalesWithSettlement.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
                <p className="text-slate-500 font-medium">Tidak ada riwayat penjualan kredit untuk pelanggan ini.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Transaksi kredit baru dapat dibuat di tab Kasir dengan memilih metode bayar "Kredit (Tempo)".
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {creditSalesWithSettlement.map(({ sale, grandTotal, settledAmount, remainingBalance, isFullyPaid, isOverdue, dueInfo }) => (
                  <div
                    key={sale.id}
                    className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      selectedSaleId === sale.id
                        ? 'bg-emerald-50/70 border-emerald-400 shadow-2xs'
                        : isFullyPaid
                        ? 'bg-slate-50/70 border-slate-200 opacity-80'
                        : isOverdue
                        ? 'bg-red-50/40 border-red-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900">{sale.id}</span>
                        {isFullyPaid ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            LUNAS
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            BELUM LUNAS
                          </span>
                        )}
                        {isOverdue && !isFullyPaid && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 animate-pulse">
                            TERLAMBAT {dueInfo?.days} HARI
                          </span>
                        )}
                        {!isOverdue && !isFullyPaid && dueInfo && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            Sisa {dueInfo.days} hari
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                        <span>Tgl: {formatDateIndo(sale.businessDate)}</span>
                        <span>•</span>
                        <span>Jatuh Tempo: {sale.dueDate ? formatDateIndo(sale.dueDate) : '-'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">
                          Total: {formatRupiah(grandTotal)}
                        </span>
                        <span className={`text-xs font-bold block ${isFullyPaid ? 'text-emerald-700' : 'text-amber-800'}`}>
                          Sisa: {formatRupiah(remainingBalance)}
                        </span>
                      </div>

                      {!isFullyPaid && (
                        <button
                          type="button"
                          onClick={() => handleQuickPaySale(sale.id, remainingBalance)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                            selectedSaleId === sale.id
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Pilih Nota</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Input Pembayaran */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>Input Pembayaran Pelunasan</span>
            </h4>

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="block font-bold">Validasi Gagal:</strong>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nominal Bayar (Rupiah) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={paymentAmountInput}
                    onChange={(e) => {
                      setPaymentAmountInput(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder="Contoh: 150000"
                    className={`w-full pl-9 pr-3 py-2 text-sm font-bold text-slate-900 border rounded-xl focus:outline-none ${
                      isExceedingBalance 
                        ? 'border-red-500 bg-red-50/30' 
                        : 'border-slate-300 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                </div>
                {isExceedingBalance && (
                  <p className="text-[10px] text-red-600 font-bold mt-1">
                    * Kembalian tidak diperbolehkan: Nominal melebihi saldo piutang ({formatRupiah(selectedCustomer?.arBalance || 0)})
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Contoh: Cicilan nota gula pasir, titip Bu RT"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Live Double-Entry Journal Preview */}
            {parsedPaymentAmount > 0 && !isExceedingBalance && (
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
                <div className="flex items-center justify-between font-sans font-bold text-slate-700 mb-1 border-b border-slate-100 pb-1">
                  <div className="flex items-center gap-1.5 text-slate-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Jurnal Otomatis Berpasangan (Double-Entry Seimbang):</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Balance
                  </span>
                </div>
                <div className="flex justify-between text-slate-800">
                  <span>[Dr] 1110 KAS</span>
                  <span className="font-bold text-emerald-700">{formatRupiah(parsedPaymentAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-800">
                  <span>[Cr] 1210 PIUTANG_USAHA</span>
                  <span className="font-bold text-emerald-700">{formatRupiah(parsedPaymentAmount)}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans pt-1">
                  Efek: Saldo kas bertambah {formatRupiah(parsedPaymentAmount)}, piutang {selectedCustomer?.name} berkurang menjadi {formatRupiah((selectedCustomer?.arBalance || 0) - parsedPaymentAmount)}.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleConfirmSettlement}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition flex items-center gap-1.5 ${
              canSubmit
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : 'bg-slate-400 cursor-not-allowed'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>{isProcessing ? 'Memproses Jurnal...' : 'Konfirmasi Pelunasan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
