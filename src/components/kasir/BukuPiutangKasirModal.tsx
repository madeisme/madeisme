import React, { useState, useMemo } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { Customer, Product, Sale, SaleLine } from '../../types/erp';
import { hasPermission } from '../../rbac/permissions';
import { commitCashSaleUseCase } from '../../domain/usecase/CommitCashSaleUseCase';
import { formatRupiah, formatDateIndo, isDateOverdue, getDaysRemainingOrOverdue, addDaysToDate } from '../../utils/formatters';
import { 
  X, 
  BookOpen, 
  Search, 
  User as UserIcon, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Coins, 
  Plus, 
  Filter, 
  ArrowRight, 
  Receipt, 
  MessageSquare, 
  Check, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  ShoppingBag, 
  Sparkles,
  Phone,
  CreditCard,
  Send,
  Trash2,
  Share2,
  FileCheck2,
  UserPlus
} from 'lucide-react';

interface BukuPiutangKasirModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenArSettlement?: (customerId: string) => void;
  onOpenInspector?: () => void;
}

type FilterStatus = 'BELUM_LUNAS' | 'SEMUA' | 'JATUH_TEMPO' | 'JATUH_TEMPO_MINGGU_INI' | 'LUNAS';

export const BukuPiutangKasirModal: React.FC<BukuPiutangKasirModalProps> = ({
  isOpen,
  onClose,
  onOpenArSettlement,
  onOpenInspector
}) => {
  const { 
    customers, 
    products, 
    sales, 
    saleLines, 
    arTransactions, 
    currentUser, 
    db, 
    getStockForProduct,
    kasirCart 
  } = useAppDatabase();

  const [activeTab, setActiveTab] = useState<'daftar' | 'catat_baru' | 'pelanggan'>('daftar');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('BELUM_LUNAS');
  const [selectedCustomerIdFilter, setSelectedCustomerIdFilter] = useState<string>('ALL');
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [copiedWaSaleId, setCopiedWaSaleId] = useState<string | null>(null);

  // Form Catat Piutang Baru State
  const [newCustomerId, setNewCustomerId] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    return addDaysToDate(today, 14); // default 14 hari
  });
  const [newNotes, setNewNotes] = useState('');
  const [newCreditOverride, setNewCreditOverride] = useState(false);
  const [newCartItems, setNewCartItems] = useState<{ productId: string; qty: number; unitPrice: number }[]>([]);
  const [isSubmittingNewCredit, setIsSubmittingNewCredit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);

  // Modal Tambah Pelanggan Baru Cepat State
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustLimit, setNewCustLimit] = useState('2000000');
  const [newCustTerms, setNewCustTerms] = useState('14');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 1. Ambil data semua transaksi kredit pelanggan beserta status pelunasan
  const allCreditTransactions = useMemo(() => {
    const result: Array<{
      sale: Sale;
      customer?: Customer;
      grandTotal: number;
      settledAmount: number;
      remainingBalance: number;
      isFullyPaid: boolean;
      dueDate: string;
      isOverdue: boolean;
      dueInfo: { days: number; isOverdue: boolean } | null;
    }> = [];

    // Prioritaskan dari data customer
    customers.forEach(customer => {
      const customerCreditSales = db.getCustomerCreditSalesWithSettlement(customer.id);
      customerCreditSales.forEach(item => {
        const dDate = item.dueDate || item.sale.dueDate || '';
        const overdue = dDate ? isDateOverdue(dDate) : false;
        const dueInf = dDate ? getDaysRemainingOrOverdue(dDate) : null;

        result.push({
          sale: item.sale,
          customer,
          grandTotal: item.grandTotal,
          settledAmount: item.settledAmount,
          remainingBalance: item.remainingBalance,
          isFullyPaid: item.isFullyPaid,
          dueDate: dDate,
          isOverdue: overdue,
          dueInfo: dueInf
        });
      });
    });

    // Urutkan: Yang belum lunas duluan, kemudian yang overdue duluan, lalu jatuh tempo terdekat
    return result.sort((a, b) => {
      if (!a.isFullyPaid && b.isFullyPaid) return -1;
      if (a.isFullyPaid && !b.isFullyPaid) return 1;
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });
  }, [customers, sales, arTransactions, db]);

  // Ringkasan Metrik Piutang Toko
  const metrics = useMemo(() => {
    let totalOutstanding = 0;
    let totalUnsettledCount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let dueThisWeekCount = 0;
    const customerWithDebt = new Set<string>();

    allCreditTransactions.forEach(item => {
      if (!item.isFullyPaid && item.remainingBalance > 0) {
        totalOutstanding += item.remainingBalance;
        totalUnsettledCount += 1;
        if (item.customer?.id) customerWithDebt.add(item.customer.id);

        if (item.isOverdue) {
          overdueCount += 1;
          overdueAmount += item.remainingBalance;
        } else if (item.dueInfo && !item.dueInfo.isOverdue && item.dueInfo.days <= 7) {
          dueThisWeekCount += 1;
        }
      }
    });

    return {
      totalOutstanding,
      totalUnsettledCount,
      overdueCount,
      overdueAmount,
      dueThisWeekCount,
      debtorCustomerCount: customerWithDebt.size
    };
  }, [allCreditTransactions]);

  // Filter Data Transaksi
  const filteredTransactions = useMemo(() => {
    return allCreditTransactions.filter(item => {
      // Filter status
      if (filterStatus === 'BELUM_LUNAS' && item.isFullyPaid) return false;
      if (filterStatus === 'LUNAS' && !item.isFullyPaid) return false;
      if (filterStatus === 'JATUH_TEMPO' && (!item.isOverdue || item.isFullyPaid)) return false;
      if (filterStatus === 'JATUH_TEMPO_MINGGU_INI') {
        if (item.isFullyPaid || item.isOverdue) return false;
        if (!item.dueInfo || item.dueInfo.days > 7) return false;
      }

      // Filter Customer ID
      if (selectedCustomerIdFilter !== 'ALL' && item.customer?.id !== selectedCustomerIdFilter) {
        return false;
      }

      // Filter Pencarian
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const custName = (item.customer?.name || '').toLowerCase();
        const custPhone = (item.customer?.phone || '').toLowerCase();
        const saleId = (item.sale.id || '').toLowerCase();
        const notes = (item.sale.notes || '').toLowerCase();
        return custName.includes(query) || custPhone.includes(query) || saleId.includes(query) || notes.includes(query);
      }

      return true;
    });
  }, [allCreditTransactions, filterStatus, selectedCustomerIdFilter, searchQuery]);

  // Data pelanggan terpilih pada form Catat Piutang Baru
  const selectedNewCustomer = useMemo(() => {
    return customers.find(c => c.id === newCustomerId);
  }, [customers, newCustomerId]);

  // Total nominal pada form Catat Piutang Baru
  const newCartTotal = useMemo(() => {
    return newCartItems.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
  }, [newCartItems]);

  const newExposure = (selectedNewCustomer?.arBalance || 0) + newCartTotal;
  const isLimitExceeded = selectedNewCustomer ? newExposure > selectedNewCustomer.creditLimit : false;
  const canOverride = hasPermission(currentUser.role, 'CREDIT_OVERRIDE');

  // Helper Tambah Barang ke Form Catat Piutang Baru
  const handleAddProductToNewCredit = (product: Product) => {
    const existing = newCartItems.find(i => i.productId === product.id);
    if (existing) {
      setNewCartItems(newCartItems.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setNewCartItems([...newCartItems, { productId: product.id, qty: 1, unitPrice: product.sellPrice }]);
    }
  };

  // Salin keranjang kasir saat ini ke form
  const handleCopyCurrentKasirCart = () => {
    if (kasirCart.length === 0) return;
    setNewCartItems(kasirCart.map(item => ({
      productId: item.productId,
      qty: item.qty,
      unitPrice: item.unitPrice
    })));
  };

  // Submit Transaksi Piutang Baru (Penjualan Bon/Kredit)
  const handleSubmitNewCredit = () => {
    if (!newCustomerId) {
      setFormError('Pilih nama pelanggan terlebih dahulu.');
      return;
    }
    if (newCartItems.length === 0) {
      setFormError('Tambahkan minimal satu produk sembako yang dibon pelanggan.');
      return;
    }
    if (!newDueDate) {
      setFormError('Tentukan tanggal jatuh tempo pembayaran.');
      return;
    }
    if (isLimitExceeded && !newCreditOverride) {
      setFormError('Total piutang melebihi limit kredit pelanggan. Memerlukan otorisasi Supervisor/Owner.');
      return;
    }

    setIsSubmittingNewCredit(true);
    setFormError(null);

    try {
      const clientKey = `CREDIT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const result = commitCashSaleUseCase.execute({
        clientSaleKey: clientKey,
        currentUser,
        cart: newCartItems,
        applyPpn: false,
        paymentMethod: 'CREDIT',
        customerId: newCustomerId,
        creditOverride: newCreditOverride,
        dueDate: newDueDate,
        notes: newNotes.trim() ? `[Buku Piutang] ${newNotes.trim()}` : `Bon belanja sembako tempo jatuh tempo: ${newDueDate}`
      });

      if (!result.success) {
        setFormError(result.errorMessage || 'Gagal menyimpan transaksi piutang');
        setIsSubmittingNewCredit(false);
        return;
      }

      // Berhasil
      setFormSuccessMessage(`Transaksi piutang pelanggan ${selectedNewCustomer?.name} sebesar ${formatRupiah(newCartTotal)} berhasil dicatat di Buku Piutang!`);
      setNewCartItems([]);
      setNewNotes('');
      setNewCreditOverride(false);
      setIsSubmittingNewCredit(false);

      // Pindah ke tab daftar piutang setelah 1.2 detik
      setTimeout(() => {
        setActiveTab('daftar');
        setFormSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan saat memproses transaksi kredit.');
      setIsSubmittingNewCredit(false);
    }
  };

  // Simpan Pelanggan Baru Cepat
  const handleSaveQuickCustomer = () => {
    if (!newCustName.trim()) return;
    const newId = `CUST-${String(customers.length + 1).padStart(3, '0')}`;
    const newCust: Customer = {
      id: newId,
      name: newCustName.trim(),
      phone: newCustPhone.trim() || '-',
      arBalance: 0,
      creditLimit: Number(newCustLimit) || 1000000,
      creditTermsDays: Number(newCustTerms) || 14
    };

    db.insertCustomer(newCust);
    setNewCustomerId(newCust.id);
    setNewDueDate(addDaysToDate(todayStr, newCust.creditTermsDays));
    setShowQuickAddCustomer(false);
    setNewCustName('');
    setNewCustPhone('');
  };

  // Generate template pesan WA sopan
  const handleCopyWaMessage = (item: typeof allCreditTransactions[0]) => {
    const custName = item.customer?.name || 'Pelanggan';
    const amount = formatRupiah(item.remainingBalance);
    const dDate = item.dueDate ? formatDateIndo(item.dueDate) : 'sesuai kesepakatan';
    const message = `Halo Yth. ${custName}, kami dari Omah Sembako Sehati ingin menginformasikan pengingat catatan bon belanja sembako sebesar ${amount} dengan tanggal jatuh tempo ${dDate}. Mohon konfirmasi atau pelunasan saat sempat nggih. Matur nuwun 🙏`;

    navigator.clipboard.writeText(message);
    setCopiedWaSaleId(item.sale.id);
    setTimeout(() => setCopiedWaSaleId(null), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        id="modal-buku-piutang-kasir"
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* HEADER MODAL */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-700/80 border border-amber-600 flex items-center justify-center text-amber-200 shadow-xs">
              <BookOpen className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg tracking-tight">
                  Buku Piutang Kasir (Catatan Bon & Tempo)
                </h3>
                <span className="text-[10px] bg-amber-600/70 border border-amber-400 text-amber-100 font-bold px-2 py-0.5 rounded-full">
                  Real-Time ERP
                </span>
              </div>
              <p className="text-xs text-amber-200/90 mt-0.5">
                Pencatatan dan pemantauan transaksi pelanggan yang belum melunasi pembayaran lengkap dengan tanggal jatuh tempo
              </p>
            </div>
          </div>

          <button
            id="btn-close-buku-piutang"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-amber-800/80 text-amber-200 hover:text-white transition"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* METRICS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-amber-50/50 border-b border-amber-100 flex-shrink-0 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-amber-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Piutang Belum Lunas</span>
            <span className="font-mono font-black text-sm sm:text-base text-amber-950 block mt-0.5">
              {formatRupiah(metrics.totalOutstanding)}
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-amber-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Tagihan Belum Lunas</span>
            <span className="font-mono font-bold text-sm sm:text-base text-slate-800 block mt-0.5">
              {metrics.totalUnsettledCount} Transaksi ({metrics.debtorCustomerCount} Pelanggan)
            </span>
          </div>

          <div className={`p-2.5 rounded-xl border shadow-2xs ${
            metrics.overdueCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-950' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <span className="text-[10px] text-rose-700 font-bold uppercase flex items-center gap-1">
              {metrics.overdueCount > 0 && <AlertTriangle className="w-3 h-3 text-rose-600" />}
              Sudah Lewat Jatuh Tempo
            </span>
            <span className="font-mono font-bold text-sm sm:text-base text-rose-700 block mt-0.5">
              {metrics.overdueCount} Tagihan ({formatRupiah(metrics.overdueAmount)})
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-amber-200/80 shadow-2xs">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Jatuh Tempo Minggu Ini</span>
            <span className="font-mono font-bold text-sm sm:text-base text-amber-700 block mt-0.5">
              {metrics.dueThisWeekCount} Transaksi
            </span>
          </div>
        </div>

        {/* TAB NAVIGASI BUKU PIUTANG */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 pt-2 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold">
            <button
              id="tab-daftar-piutang"
              onClick={() => setActiveTab('daftar')}
              className={`px-3.5 py-2 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'daftar'
                  ? 'border-amber-700 text-amber-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4 text-amber-700" />
              <span>Daftar Transaksi Belum Lunas</span>
              <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {metrics.totalUnsettledCount}
              </span>
            </button>

            <button
              id="tab-catat-piutang-baru"
              onClick={() => setActiveTab('catat_baru')}
              className={`px-3.5 py-2 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'catat_baru'
                  ? 'border-amber-700 text-amber-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>+ Catat Transaksi Bon/Tempo Baru</span>
            </button>

            <button
              id="tab-rekap-pelanggan"
              onClick={() => setActiveTab('pelanggan')}
              className={`px-3.5 py-2 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'pelanggan'
                  ? 'border-amber-700 text-amber-900 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserIcon className="w-4 h-4 text-slate-600" />
              <span>Rekap Piutang Pelanggan</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
            Kasir: {currentUser.name} ({currentUser.role})
          </span>
        </div>

        {/* TAB BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          
          {/* =================================================================== */}
          {/* TAB 1: DAFTAR TRANSAKSI PIUTANG & JATUH TEMPO */}
          {/* =================================================================== */}
          {activeTab === 'daftar' && (
            <div className="space-y-4">
              
              {/* FILTER & PENCARIAN BAR */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-search-buku-piutang"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama pelanggan, no telepon, no struk, atau catatan..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-600 focus:bg-white text-slate-800"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pelanggan Dropdown */}
                <select
                  id="select-filter-customer"
                  value={selectedCustomerIdFilter}
                  onChange={(e) => setSelectedCustomerIdFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-800 font-medium focus:outline-none focus:border-amber-600"
                >
                  <option value="ALL">-- Semua Pelanggan --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.arBalance > 0 ? `(Piutang: ${formatRupiah(c.arBalance)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* FILTER PILLS */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button
                  id="btn-filter-belum-lunas"
                  onClick={() => setFilterStatus('BELUM_LUNAS')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                    filterStatus === 'BELUM_LUNAS'
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Belum Lunas ({metrics.totalUnsettledCount})
                </button>
                <button
                  id="btn-filter-jatuh-tempo"
                  onClick={() => setFilterStatus('JATUH_TEMPO')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1 ${
                    filterStatus === 'JATUH_TEMPO'
                      ? 'bg-rose-700 text-white'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Lewat Jatuh Tempo ({metrics.overdueCount})</span>
                </button>
                <button
                  id="btn-filter-jatuh-tempo-minggu-ini"
                  onClick={() => setFilterStatus('JATUH_TEMPO_MINGGU_INI')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                    filterStatus === 'JATUH_TEMPO_MINGGU_INI'
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Jatuh Tempo Minggu Ini ({metrics.dueThisWeekCount})
                </button>
                <button
                  id="btn-filter-semua-piutang"
                  onClick={() => setFilterStatus('SEMUA')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                    filterStatus === 'SEMUA'
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Semua Riwayat ({allCreditTransactions.length})
                </button>
                <button
                  id="btn-filter-lunas"
                  onClick={() => setFilterStatus('LUNAS')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                    filterStatus === 'LUNAS'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Sudah Lunas
                </button>
              </div>

              {/* LIST TRANSAKSI PIUTANG PELANGGAN */}
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Tidak ada data transaksi piutang yang cocok</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    {filterStatus === 'BELUM_LUNAS' 
                      ? 'Semua transaksi piutang pelanggan saat ini sudah lunas, atau gunakan tombol "+ Catat Transaksi Bon/Tempo Baru" untuk mencatat piutang baru.'
                      : 'Coba ubah kata kunci pencarian atau filter status transaksi.'}
                  </p>
                  <button
                    onClick={() => setActiveTab('catat_baru')}
                    className="mt-3.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Catat Bon Belanja Baru</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map(item => {
                    const lines = saleLines.filter(l => l.saleId === item.sale.id);
                    const isExpanded = expandedSaleId === item.sale.id;

                    return (
                      <div
                        key={item.sale.id}
                        id={`row-piutang-${item.sale.id}`}
                        className={`rounded-xl border p-3.5 sm:p-4 transition shadow-2xs ${
                          item.isOverdue && !item.isFullyPaid
                            ? 'bg-rose-50/40 border-rose-300 hover:border-rose-400'
                            : item.isFullyPaid
                              ? 'bg-slate-50/60 border-slate-200 opacity-80'
                              : 'bg-white border-slate-200 hover:border-amber-300'
                        }`}
                      >
                        {/* Baris Atas: Info Pelanggan & Jatuh Tempo */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                                <UserIcon className="w-4 h-4 text-amber-700" />
                                {item.customer?.name || 'Pelanggan Umum (Tanpa Nama)'}
                              </span>
                              {item.customer?.phone && (
                                <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {item.customer.phone}
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {item.sale.id}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Transaksi: <strong>{formatDateIndo(item.sale.businessDate)}</strong>
                              </span>

                              {/* TANGGAL JATUH TEMPO DENGAN INDIKATOR STATUS JELAS */}
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                Jatuh Tempo: <strong className="font-semibold text-slate-800">{item.dueDate ? formatDateIndo(item.dueDate) : '-'}</strong>
                              </span>

                              {/* BADGE JATUH TEMPO */}
                              {item.isFullyPaid ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Lunas
                                </span>
                              ) : item.isOverdue ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  Terlambat {item.dueInfo?.days} Hari!
                                </span>
                              ) : item.dueInfo && item.dueInfo.days === 0 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  Jatuh Tempo Hari Ini!
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                  Sisa {item.dueInfo?.days} hari
                                </span>
                              )}
                            </div>
                          </div>

                          {/* NOMINAL & SISA PIUTANG */}
                          <div className="sm:text-right space-y-0.5">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Sisa Piutang (Belum Lunas)</div>
                            <div className={`text-base sm:text-lg font-black font-mono ${
                              item.isFullyPaid 
                                ? 'text-emerald-700 line-through' 
                                : item.isOverdue 
                                  ? 'text-rose-700' 
                                  : 'text-amber-900'
                            }`}>
                              {formatRupiah(item.remainingBalance)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Total Bon: <span className="font-mono font-medium text-slate-600">{formatRupiah(item.grandTotal)}</span>
                              {item.settledAmount > 0 && !item.isFullyPaid && (
                                <span className="text-emerald-600 ml-1">
                                  (Dibayar: {formatRupiah(item.settledAmount)})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Catatan Transaksi Bon jika ada */}
                        {item.sale.notes && (
                          <div className="mt-2 text-xs bg-amber-50/70 border border-amber-200/60 p-2 rounded-lg text-amber-900">
                            <span className="font-bold">Keterangan Bon:</span> {item.sale.notes}
                          </div>
                        )}

                        {/* Baris Bawah: Aksi Cepat & Rincian Produk */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <button
                            id={`btn-toggle-items-${item.sale.id}`}
                            onClick={() => setExpandedSaleId(isExpanded ? null : item.sale.id)}
                            className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1"
                          >
                            <span>{lines.length} Item Barang Belanja</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          <div className="flex items-center gap-2">
                            {/* Tombol Salin WA Pengingat */}
                            {!item.isFullyPaid && (
                              <button
                                id={`btn-copy-wa-${item.sale.id}`}
                                onClick={() => handleCopyWaMessage(item)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                                title="Salin format pesan pengingat WhatsApp sopan ke clipboard"
                              >
                                {copiedWaSaleId === item.sale.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Tersalin!</span>
                                  </>
                                ) : (
                                  <>
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="hidden sm:inline">Pesan WA</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Tombol Pelunasan Langsung */}
                            {!item.isFullyPaid && item.customer && (
                              <button
                                id={`btn-settle-${item.sale.id}`}
                                onClick={() => {
                                  onClose();
                                  if (onOpenArSettlement) {
                                    onOpenArSettlement(item.customer!.id);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                                title="Catat pelunasan/cicilan pembayaran pelanggan ini"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>Bayar / Cicil Bon</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Rincian Produk Sembako yang di-bon */}
                        {isExpanded && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 bg-slate-50 p-2.5 rounded-lg text-xs space-y-1.5">
                            <div className="font-bold text-slate-700 text-[11px]">Rincian Komoditas Sembako:</div>
                            <div className="divide-y divide-slate-200/60">
                              {lines.map(line => {
                                const prod = products.find(p => p.id === line.productId);
                                return (
                                  <div key={line.id} className="py-1 flex items-center justify-between">
                                    <div>
                                      <span className="font-semibold text-slate-800">{prod?.name || line.productId}</span>
                                      <span className="text-slate-400 ml-1.5 font-mono">
                                        ({line.qty} {prod?.unit || 'unit'} × {formatRupiah(line.unitPrice)})
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-slate-800">
                                      {formatRupiah(line.qty * line.unitPrice)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 2: CATAT TRANSAKSI PIUTANG BARU (BON/TEMPO) */}
          {/* =================================================================== */}
          {activeTab === 'catat_baru' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              
              {/* Alert Pesan Sukses / Error */}
              {formSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{formSuccessMessage}</span>
                </div>
              )}

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form Box */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                
                {/* 1. Pilih Pelanggan */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-amber-700" />
                      <span>Pilih Nama Pelanggan <span className="text-rose-500">*</span>:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddCustomer(true)}
                      className="text-[11px] text-amber-800 hover:text-amber-900 font-bold flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Tambah Pelanggan Baru</span>
                    </button>
                  </div>

                  <select
                    id="select-new-credit-customer"
                    value={newCustomerId}
                    onChange={(e) => {
                      const custId = e.target.value;
                      setNewCustomerId(custId);
                      const c = customers.find(item => item.id === custId);
                      if (c) {
                        setNewDueDate(addDaysToDate(todayStr, c.creditTermsDays || 14));
                      }
                      setFormError(null);
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-800 font-semibold focus:outline-none focus:border-amber-600"
                  >
                    <option value="">-- Pilih Pelanggan Bon/Tempo --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} • Limit: {formatRupiah(c.creditLimit)} • Piutang Berjalan: {formatRupiah(c.arBalance)}
                      </option>
                    ))}
                  </select>

                  {/* Info Status Limit Kredit Pelanggan Terpilih */}
                  {selectedNewCustomer && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Plafon Limit Kredit:</span>
                        <strong className="text-slate-800 font-mono">{formatRupiah(selectedNewCustomer.creditLimit)}</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Piutang Berjalan Saat Ini:</span>
                        <strong className="text-amber-800 font-mono">{formatRupiah(selectedNewCustomer.arBalance)}</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 col-span-2 sm:col-span-1">
                        <span className="text-slate-400 block text-[10px]">Sisa Plafon Kredit:</span>
                        <strong className={`font-mono ${
                          selectedNewCustomer.creditLimit - selectedNewCustomer.arBalance > 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {formatRupiah(Math.max(0, selectedNewCustomer.creditLimit - selectedNewCustomer.arBalance))}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Tanggal Jatuh Tempo (DUE DATE) */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-700" />
                      <span>Tanggal Jatuh Tempo Pembayaran <span className="text-rose-500">*</span>:</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Format: YYYY-MM-DD
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      id="input-new-due-date"
                      type="date"
                      value={newDueDate}
                      min={todayStr}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-600 sm:w-56"
                    />

                    {/* Presets Jatuh Tempo Cepat */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setNewDueDate(addDaysToDate(todayStr, 7))}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                      >
                        +7 Hari (1 Mgg)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewDueDate(addDaysToDate(todayStr, 14))}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                      >
                        +14 Hari (2 Mgg)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewDueDate(addDaysToDate(todayStr, 30))}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                      >
                        +30 Hari (1 Bln)
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Pelanggan berjanji akan melunasi pembayaran sebelum atau pada tanggal: <strong className="text-amber-900 font-bold">{newDueDate ? formatDateIndo(newDueDate) : '-'}</strong>.
                  </p>
                </div>

                {/* 3. Komoditas Sembako yang Dibon / Diambil */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
                      <span>Barang Sembako yang Di-bon ({newCartItems.length} Item) <span className="text-rose-500">*</span>:</span>
                    </label>

                    {kasirCart.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCopyCurrentKasirCart}
                        className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Gunakan {kasirCart.length} Item dari Keranjang Kasir</span>
                      </button>
                    )}
                  </div>

                  {/* Quick Product Selector */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-[11px] text-slate-600 font-semibold">Pilih Cepat Produk dari Katalog Sembako:</div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {products.slice(0, 8).map(prod => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleAddProductToNewCredit(prod)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-amber-400 text-[11px] text-slate-800 font-medium whitespace-nowrap transition shadow-2xs flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3 text-emerald-600" />
                          <span>{prod.name} ({formatRupiah(prod.sellPrice)})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Daftar Item yang Sudah Dipilih */}
                  {newCartItems.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 flex justify-between">
                        <span>Nama Produk</span>
                        <span>Qty & Total</span>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                        {newCartItems.map(item => {
                          const prod = products.find(p => p.id === item.productId);
                          const stock = getStockForProduct(item.productId);

                          return (
                            <div key={item.productId} className="px-3 py-2 flex items-center justify-between bg-white">
                              <div>
                                <div className="font-bold text-slate-900">{prod?.name || item.productId}</div>
                                <div className="text-[10px] text-slate-400">
                                  Harga: {formatRupiah(item.unitPrice)}/{prod?.unit || 'unit'} • Stok ada: {stock}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-lg px-1.5 py-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.qty <= 1) {
                                        setNewCartItems(newCartItems.filter(i => i.productId !== item.productId));
                                      } else {
                                        setNewCartItems(newCartItems.map(i => i.productId === item.productId ? { ...i, qty: i.qty - 1 } : i));
                                      }
                                    }}
                                    className="w-4 h-4 text-slate-600 hover:text-slate-900"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono font-bold min-w-4 text-center">{item.qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewCartItems(newCartItems.map(i => i.productId === item.productId ? { ...i, qty: i.qty + 1 } : i));
                                    }}
                                    className="w-4 h-4 text-slate-600 hover:text-slate-900"
                                  >
                                    +
                                  </button>
                                </div>

                                <span className="font-mono font-bold text-slate-900 min-w-[70px] text-right">
                                  {formatRupiah(item.qty * item.unitPrice)}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setNewCartItems(newCartItems.filter(i => i.productId !== item.productId))}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total Nominal Bon */}
                      <div className="bg-amber-50 px-3 py-2.5 border-t border-amber-200 flex items-center justify-between font-bold">
                        <span className="text-amber-900">Total Nominal Piutang (Bon):</span>
                        <span className="text-sm font-mono font-black text-amber-950">{formatRupiah(newCartTotal)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                      Pilih produk sembako di atas atau tekan tombol "Gunakan Item dari Keranjang Kasir"
                    </div>
                  )}
                </div>

                {/* 4. Catatan / Alasan Bon */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-800">
                    Catatan Khusus Bon / Perjanjian:
                  </label>
                  <input
                    id="input-new-credit-notes"
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Contoh: Beras 5kg diambil Bu Siti, janji bayar tanggal 25 pas gajian suami"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-amber-600"
                  />
                </div>

                {/* Otorisasi Override jika limit melebihi */}
                {isLimitExceeded && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs space-y-2 text-rose-900">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Total Piutang Melebihi Plafon Limit Kredit!</span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Total tagihan akan menjadi <strong className="font-mono">{formatRupiah(newExposure)}</strong>, sedangkan batas limit adalah <strong className="font-mono">{formatRupiah(selectedNewCustomer?.creditLimit || 0)}</strong>.
                    </p>
                    {canOverride ? (
                      <label className="flex items-center gap-2 font-bold cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={newCreditOverride}
                          onChange={(e) => setNewCreditOverride(e.target.checked)}
                          className="w-4 h-4 accent-amber-600 rounded"
                        />
                        <span>Saya sebagai {currentUser.role} menyetujui Override Plafon Kredit</span>
                      </label>
                    ) : (
                      <p className="text-[11px] text-rose-700 font-semibold italic">
                        Hubungi Owner/Admin untuk menyetujui transaksi bon ini.
                      </p>
                    )}
                  </div>
                )}

                {/* Action Submit */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCartItems([]);
                      setNewNotes('');
                      setActiveTab('daftar');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
                  >
                    Batal
                  </button>

                  <button
                    id="btn-submit-new-credit"
                    type="button"
                    disabled={isSubmittingNewCredit || newCartItems.length === 0 || !newCustomerId}
                    onClick={handleSubmitNewCredit}
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 shadow-xs ${
                      !isSubmittingNewCredit && newCartItems.length > 0 && newCustomerId
                        ? 'bg-amber-700 hover:bg-amber-800'
                        : 'bg-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>{isSubmittingNewCredit ? 'Menyimpan ke Buku Piutang...' : 'Simpan ke Buku Piutang'}</span>
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 3: REKAP PIUTANG PER PELANGGAN */}
          {/* =================================================================== */}
          {activeTab === 'pelanggan' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Daftar ringkasan total saldo piutang yang belum dilunasi oleh masing-masing pelanggan:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customers.filter(c => c.arBalance > 0).map(cust => {
                  const customerCreditSales = db.getCustomerCreditSalesWithSettlement(cust.id);
                  const unsettledSales = customerCreditSales.filter(i => !i.isFullyPaid);
                  const overdueSales = unsettledSales.filter(i => i.isOverdue);

                  return (
                    <div
                      key={cust.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-amber-300 transition space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <UserIcon className="w-4 h-4 text-amber-700" />
                            {cust.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {cust.phone} • ID: {cust.id}
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                          {unsettledSales.length} Bon Aktif
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total Piutang Belum Lunas:</span>
                          <strong className="font-mono font-bold text-amber-900">{formatRupiah(cust.arBalance)}</strong>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Plafon Limit:</span>
                          <span className="font-mono text-slate-700">{formatRupiah(cust.creditLimit)}</span>
                        </div>
                        {overdueSales.length > 0 && (
                          <div className="flex justify-between text-[11px] text-rose-700 font-bold">
                            <span>Bon Terlambat:</span>
                            <span>{overdueSales.length} Tagihan</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => {
                            setSelectedCustomerIdFilter(cust.id);
                            setActiveTab('daftar');
                          }}
                          className="text-xs text-amber-800 hover:text-amber-900 font-bold"
                        >
                          Lihat Riwayat Bon →
                        </button>

                        <button
                          onClick={() => {
                            onClose();
                            if (onOpenArSettlement) {
                              onOpenArSettlement(cust.id);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition flex items-center gap-1"
                        >
                          <Coins className="w-3 h-3" />
                          <span>Pelunasan Bon</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {customers.filter(c => c.arBalance > 0).length === 0 && (
                  <div className="col-span-2 text-center py-10 text-slate-400 text-xs">
                    Semua pelanggan saat ini memiliki saldo piutang Rp 0 (Lunas semua).
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* FOOTER MODAL */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 flex-shrink-0 text-xs">
          <div className="text-slate-500 flex items-center gap-1 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Terintegrasi otomatis dengan Buku Besar Piutang Usaha (Akun 1210) & Kasir.</span>
          </div>

          <button
            id="btn-modal-close-footer"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition"
          >
            Tutup Buku Piutang
          </button>
        </div>

      </div>

      {/* QUICK ADD CUSTOMER DIALOG */}
      {showQuickAddCustomer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl p-4 sm:p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-amber-700" />
                <span>Tambah Pelanggan Bon Cepat</span>
              </h4>
              <button onClick={() => setShowQuickAddCustomer(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Pelanggan *:</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Contoh: Pak Supri / Bu RT 02"
                  className="w-full px-3 py-2 border rounded-xl"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">No. HP / WhatsApp:</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="081234567890"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Plafon Limit Kredit (Rp):</label>
                  <input
                    type="number"
                    value={newCustLimit}
                    onChange={(e) => setNewCustLimit(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tempo Default (Hari):</label>
                  <input
                    type="number"
                    value={newCustTerms}
                    onChange={(e) => setNewCustTerms(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuickAddCustomer(false)}
                className="px-3 py-1.5 border rounded-xl text-xs font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!newCustName.trim()}
                onClick={handleSaveQuickCustomer}
                className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition disabled:bg-slate-300"
              >
                Simpan Pelanggan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
