import React, { useState, useEffect, useMemo } from 'react';
import { useAppDatabase } from '../database/useAppDatabase';
import { formatRupiah, calculateLineTotal, formatDateTimeIndo, addDaysToDate, formatDateIndo, isDateOverdue } from '../utils/formatters';
import { commitCashSaleUseCase } from '../domain/usecase/CommitCashSaleUseCase';
import { ReceiptModal } from '../components/kasir/ReceiptModal';
import { ArSettlementModal } from '../components/ar/ArSettlementModal';
import { VoidSaleModal } from '../components/retur/VoidSaleModal';
import { ReturnSaleModal } from '../components/retur/ReturnSaleModal';
import { OpenCashSessionModal } from '../components/kasir/OpenCashSessionModal';
import { CloseCashSessionModal } from '../components/kasir/CloseCashSessionModal';
import { CashSessionHistoryModal } from '../components/kasir/CashSessionHistoryModal';
import { PriceCheckModal } from '../components/kasir/PriceCheckModal';
import { BukuPiutangKasirModal } from '../components/kasir/BukuPiutangKasirModal';
import { PromotionManagementModal } from '../components/kasir/PromotionManagementModal';
import { hasPermission } from '../rbac/permissions';
import { Sale, SaleLine, Journal, JournalLine, CashSession, Promotion } from '../types/erp';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  Info, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Banknote, 
  Receipt, 
  FileCheck2, 
  X, 
  History, 
  ShieldAlert, 
  Coins, 
  User as UserIcon, 
  Calendar, 
  AlertTriangle, 
  RotateCcw, 
  Lock, 
  Unlock, 
  Clock,
  Tag,
  LayoutGrid,
  List,
  BookOpen
} from 'lucide-react';

interface KasirScreenProps {
  onOpenInspector?: () => void;
}

export const KasirScreen: React.FC<KasirScreenProps> = ({ onOpenInspector }) => {
  const { products, kasirCart, getStockForProduct, currentUser, sales, saleLines, journals, journalLines, customers, promotions, db } = useAppDatabase();
  
  // Navigation & filter states
  const [search, setSearch] = useState(db.kasirSearchQuery);
  const [selectedCategory, setSelectedCategory] = useState(db.kasirSelectedCategory);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [activeView, setActiveView] = useState<'katalog' | 'riwayat'>('katalog');

  // Fitur Cek Harga Cepat & Daftar Harga Jual Real-Time
  const [showPriceCheckModal, setShowPriceCheckModal] = useState(false);
  const [catalogViewMode, setCatalogViewMode] = useState<'grid' | 'table'>('grid');

  // Fitur Buku Piutang Kasir (Catatan Bon Pelanggan & Jatuh Tempo)
  const [showBukuPiutangModal, setShowBukuPiutangModal] = useState(false);
  const [initialArCustomerId, setInitialArCustomerId] = useState<string | undefined>();

  // Fitur Modul Promosi & Kode Diskon Layar Kasir
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | null>(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showPromoInputInCheckout, setShowPromoInputInCheckout] = useState(false);

  // Keyboard shortcut F2 (Cek Harga Cepat) & F3 (Buku Piutang)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setShowPriceCheckModal(prev => !prev);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setShowBukuPiutangModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Hitung jumlah transaksi piutang pelanggan yang belum lunas
  const totalUnsettledArCount = useMemo(() => {
    let count = 0;
    customers.forEach(c => {
      if (c.arBalance > 0) {
        const creditSales = db.getCustomerCreditSalesWithSettlement(c.id);
        count += creditSales.filter(s => !s.isFullyPaid).length;
      }
    });
    return count;
  }, [customers, sales, db]);

  // Prompt 2 & 4: Payment Method & PPN 11% Toggle
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT'>('CASH');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [creditOverride, setCreditOverride] = useState<boolean>(false);
  const [applyPpn, setApplyPpn] = useState(false);

  // Checkout & Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showArModal, setShowArModal] = useState(false);
  const [cashPaidInput, setCashPaidInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // §4 Idempotency key (UUID generated once when checkout is opened)
  const [clientSaleKey, setClientSaleKey] = useState<string>('');

  // Receipt Modal State
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [completedLines, setCompletedLines] = useState<SaleLine[]>([]);
  const [completedJournal, setCompletedJournal] = useState<Journal | undefined>();
  const [completedJLines, setCompletedJLines] = useState<JournalLine[]>([]);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Selected historic sale to view receipt
  const [viewHistorySale, setViewHistorySale] = useState<Sale | null>(null);

  // Prompt 5: Void & Return Sale modal states (Gated for OWNER & ADMIN)
  const [selectedVoidSale, setSelectedVoidSale] = useState<Sale | null>(null);
  const [selectedReturnSale, setSelectedReturnSale] = useState<Sale | null>(null);

  // Prompt 8: Sesi Kasir (Shift & Rekonsiliasi)
  const [showOpenSessionModal, setShowOpenSessionModal] = useState(false);
  const [showCloseSessionModal, setShowCloseSessionModal] = useState(false);
  const [showSessionHistoryModal, setShowSessionHistoryModal] = useState(false);
  const [sessionToClose, setSessionToClose] = useState<CashSession | null>(null);
  const [sessionNotification, setSessionNotification] = useState<{ title: string; message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Sesi kasir yang aktif untuk kasir saat ini
  const activeCashSession = db.getActiveCashSession(currentUser.id);

  // Generate unique clientSaleKey when opening checkout modal
  const openCheckout = () => {
    setErrorMessage(null);
    setPaymentMethod('CASH');
    setCreditOverride(false);
    if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
    const newKey = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `sale-key-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setClientSaleKey(newKey);
    setShowPaymentModal(true);
  };

  // Sync retained search state
  const handleSearchChange = (val: string) => {
    setSearch(val);
    db.kasirSearchQuery = val;
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    db.kasirSelectedCategory = cat;
  };

  const categories = ['Semua', ...Array.from(new Set(products.map(p => p.category || 'Lainnya')))];

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  // Calculate cart line items with exact per-line rounding & optional PPN per-line
  const cartWithDetails = useMemo(() => {
    return kasirCart.map(item => {
      const product = products.find(p => p.id === item.productId);
      const lineSubtotal = calculateLineTotal(item.qty, item.unitPrice);
      const linePpn = applyPpn ? Math.round(lineSubtotal * 0.11) : 0;
      const lineTotal = lineSubtotal + linePpn;

      return {
        ...item,
        product,
        lineSubtotal,
        linePpn,
        lineTotal
      };
    });
  }, [kasirCart, products, applyPpn]);

  const totalSubtotal = cartWithDetails.reduce((sum, item) => sum + item.lineSubtotal, 0);

  // Hitung jumlah promosi yang sedang aktif
  const activePromosCount = useMemo(() => {
    return (promotions || []).filter(p => p.isActive).length;
  }, [promotions]);

  // Hitung besaran diskon berdasarkan appliedPromotion & totalSubtotal
  const discountCalculation = useMemo(() => {
    if (!appliedPromotion) return { discountAmount: 0, isEligible: true, ineligibleReason: null };

    if (appliedPromotion.minPurchase && totalSubtotal < appliedPromotion.minPurchase) {
      return {
        discountAmount: 0,
        isEligible: false,
        ineligibleReason: `Minimal belanja ${formatRupiah(appliedPromotion.minPurchase)} (Kurang ${formatRupiah(appliedPromotion.minPurchase - totalSubtotal)})`
      };
    }

    let calculated = 0;
    if (appliedPromotion.type === 'PERCENTAGE') {
      calculated = Math.round((totalSubtotal * appliedPromotion.value) / 100);
      if (appliedPromotion.maxDiscount && calculated > appliedPromotion.maxDiscount) {
        calculated = appliedPromotion.maxDiscount;
      }
    } else {
      // FIXED NOMINAL
      calculated = Math.min(totalSubtotal, appliedPromotion.value);
    }

    return {
      discountAmount: calculated,
      isEligible: true,
      ineligibleReason: null
    };
  }, [appliedPromotion, totalSubtotal]);

  const discountAmount = discountCalculation.discountAmount;
  const totalPpn = cartWithDetails.reduce((sum, item) => sum + item.linePpn, 0);
  const grandTotal = Math.max(0, totalSubtotal - discountAmount) + totalPpn;
  const totalItemsCount = kasirCart.reduce((sum, item) => sum + item.qty, 0);

  // Terapkan kode promo
  const handleApplyPromoCode = (codeToApply?: string) => {
    const code = (codeToApply !== undefined ? codeToApply : promoCodeInput).trim().toUpperCase();
    setPromoMessage(null);
    if (!code) {
      setPromoMessage({ text: 'Masukkan kode promo terlebih dahulu', type: 'error' });
      return;
    }
    const promo = db.getPromotionByCode(code);
    if (!promo) {
      setPromoMessage({ text: `Kode promo "${code}" tidak ditemukan atau tidak valid`, type: 'error' });
      return;
    }
    if (!promo.isActive) {
      setPromoMessage({ text: `Kode promo "${code}" sudah tidak aktif`, type: 'error' });
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (promo.startDate && promo.startDate > today) {
      setPromoMessage({ text: `Kode promo baru mulai berlaku pada ${formatDateIndo(promo.startDate)}`, type: 'error' });
      return;
    }
    if (promo.endDate && promo.endDate < today) {
      setPromoMessage({ text: `Kode promo sudah kedaluwarsa pada ${formatDateIndo(promo.endDate)}`, type: 'error' });
      return;
    }
    if (promo.minPurchase && totalSubtotal < promo.minPurchase) {
      setPromoMessage({
        text: `Minimal belanja untuk kupon ini adalah ${formatRupiah(promo.minPurchase)} (Belanja saat ini: ${formatRupiah(totalSubtotal)})`,
        type: 'error'
      });
      return;
    }

    setAppliedPromotion(promo);
    setPromoCodeInput(promo.code);
    setPromoMessage({
      text: `Promo "${promo.code}" aktif! Potongan: ${promo.type === 'PERCENTAGE' ? `${promo.value}%` : formatRupiah(promo.value)}`,
      type: 'success'
    });
  };

  const handleRemovePromotion = () => {
    setAppliedPromotion(null);
    setPromoCodeInput('');
    setPromoMessage(null);
  };

  // Quick cash nominations based on grandTotal
  const quickCashOptions = useMemo(() => {
    if (grandTotal <= 0) return [];
    const opts = new Set<number>();
    opts.add(grandTotal); // Uang pas

    // Rounded denominations
    const roundTo10k = Math.ceil(grandTotal / 10000) * 10000;
    const roundTo20k = Math.ceil(grandTotal / 20000) * 20000;
    const roundTo50k = Math.ceil(grandTotal / 50000) * 50000;
    const roundTo100k = Math.ceil(grandTotal / 100000) * 100000;

    if (roundTo10k > grandTotal) opts.add(roundTo10k);
    if (roundTo20k > grandTotal) opts.add(roundTo20k);
    if (roundTo50k > grandTotal) opts.add(roundTo50k);
    if (roundTo100k > grandTotal) opts.add(roundTo100k);

    return Array.from(opts).sort((a, b) => a - b).slice(0, 4);
  }, [grandTotal]);

  // Set default cash paid to grandTotal when opening modal
  useEffect(() => {
    if (showPaymentModal && grandTotal > 0 && !cashPaidInput) {
      setCashPaidInput(String(grandTotal));
    }
  }, [showPaymentModal, grandTotal]);

  const parsedCashPaid = Number(cashPaidInput) || 0;
  const changeAmount = Math.max(0, parsedCashPaid - grandTotal);
  const isCashSufficient = parsedCashPaid >= grandTotal;

  // Selected customer for credit sale & credit limit calculations
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const customerExposure = selectedCustomer ? selectedCustomer.arBalance : 0;
  const newExposure = customerExposure + grandTotal;
  const customerLimit = selectedCustomer ? selectedCustomer.creditLimit : 0;
  const isZeroLimit = selectedCustomer ? customerLimit <= 0 : false;
  const isCreditLimitExceeded = selectedCustomer ? newExposure > customerLimit : false;
  const isManagerRole = hasPermission(currentUser.role, 'CREDIT_OVERRIDE');

  const todayStr = new Date().toISOString().split('T')[0];
  const dueDatePreview = selectedCustomer ? addDaysToDate(todayStr, selectedCustomer.creditTermsDays || 30) : '';

  // Can commit transaction validation check (§3 & §5)
  const canCommit = useMemo(() => {
    if (isProcessing) return false;
    if (kasirCart.length === 0) return false;
    if (paymentMethod === 'CASH') {
      return isCashSufficient;
    } else {
      // CREDIT:
      if (!selectedCustomerId || !selectedCustomer) return false;
      if (isZeroLimit) return false;
      if (isCreditLimitExceeded) {
        return isManagerRole && creditOverride;
      }
      return true;
    }
  }, [isProcessing, kasirCart.length, paymentMethod, isCashSufficient, selectedCustomerId, selectedCustomer, isZeroLimit, isCreditLimitExceeded, isManagerRole, creditOverride]);

  // Handle Commit Sale (CASH or CREDIT) Execution
  const handleCommitSale = () => {
    if (!canCommit) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = commitCashSaleUseCase.execute({
        clientSaleKey,
        currentUser,
        cart: kasirCart,
        applyPpn,
        paymentMethod,
        cashPaid: paymentMethod === 'CASH' ? parsedCashPaid : 0,
        customerId: paymentMethod === 'CREDIT' ? selectedCustomerId : (selectedCustomerId || undefined),
        creditOverride: paymentMethod === 'CREDIT' ? creditOverride : false,
        discountCode: appliedPromotion?.code,
        discountType: appliedPromotion?.type,
        discountValue: appliedPromotion?.value,
        discountAmount: discountAmount > 0 ? discountAmount : undefined
      });

      if (!result.success) {
        setErrorMessage(result.errorMessage || 'Gagal memproses transaksi');
        setIsProcessing(false);
        return;
      }

      // Success: Close payment modal and open receipt modal
      setShowPaymentModal(false);
      setShowCartDrawer(false);
      setCompletedSale(result.sale || null);
      setCompletedLines(result.saleLines || []);
      setCompletedJournal(result.journal);
      setCompletedJLines(result.journalLines || []);
      setShowReceiptModal(true);
      setCashPaidInput('');
      setCreditOverride(false);
      setAppliedPromotion(null);
      setPromoCodeInput('');
      setPromoMessage(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // View historical sale receipt
  const handleOpenHistoricalSale = (sale: Sale) => {
    const lines = saleLines.filter(l => l.saleId === sale.id);
    const jrn = journals.find(j => j.refId === sale.id && j.refType === 'SALE');
    const jLines = jrn ? journalLines.filter(jl => jl.journalId === jrn.id) : [];

    setCompletedSale(sale);
    setCompletedLines(lines);
    setCompletedJournal(jrn);
    setCompletedJLines(jLines);
    setShowReceiptModal(true);
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Top Bar: View Switcher (Katalog Produk vs Riwayat Transaksi Hari Ini) */}
      <div className="bg-white px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveView('katalog')}
            className={`px-3 py-1 rounded-md transition ${
              activeView === 'katalog'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Katalog Kasir
          </button>
          <button
            onClick={() => setActiveView('riwayat')}
            className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
              activeView === 'riwayat'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat Transaksi ({sales.length})</span>
          </button>
        </div>

        {/* Action: Pelunasan Piutang & Role Info */}
        <div className="flex items-center gap-2">
          {/* Tombol Cek Daftar Harga Jual (Real-Time) */}
          <button
            id="btn-open-price-check-modal"
            onClick={() => setShowPriceCheckModal(true)}
            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Lihat daftar harga jual produk & cek harga real-time tanpa masuk keranjang (F2)"
          >
            <Tag className="w-3.5 h-3.5 text-teal-700" />
            <span>Daftar Harga</span>
          </button>

          {/* FITUR MODUL PROMOSI & DISKON */}
          <button
            id="open-promotions-btn"
            onClick={() => setShowPromotionModal(true)}
            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Kelola Kode Kupon Promo & Potongan Belanja Kasir (Persen / Nominal)"
          >
            <Tag className="w-3.5 h-3.5 text-emerald-700" />
            <span>Promosi & Diskon</span>
            {activePromosCount > 0 && (
              <span className="bg-emerald-700 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                {activePromosCount}
              </span>
            )}
          </button>

          {/* Tombol Riwayat Shift Kasir */}
          {hasPermission(currentUser.role, 'CASH_SESSION_VIEW') && (
            <button
              onClick={() => setShowSessionHistoryModal(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
              title="Lihat riwayat shift dan rekonsiliasi kas"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Riwayat Shift</span>
            </button>
          )}

          {/* Tombol Buka / Tutup Sesi Cepat */}
          {activeCashSession ? (
            <button
              onClick={() => {
                setSessionToClose(activeCashSession);
                setShowCloseSessionModal(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
              title="Tutup sesi kasir yang sedang aktif"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Tutup Shift</span>
            </button>
          ) : (
            hasPermission(currentUser.role, 'CASH_SESSION_OPEN') && (
              <button
                onClick={() => setShowOpenSessionModal(true)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                title="Buka sesi kasir baru (Shift)"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka Shift</span>
              </button>
            )
          )}

          {/* FITUR BUKU PIUTANG KASIR */}
          <button
            id="open-buku-piutang-btn"
            onClick={() => setShowBukuPiutangModal(true)}
            className="px-2.5 py-1 rounded-lg bg-amber-800 hover:bg-amber-900 text-amber-50 border border-amber-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Buku Piutang Kasir: Catat & Pantau Transaksi Bon Pelanggan Belum Lunas Beserta Tanggal Jatuh Tempo (Shortcut F3)"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-200" />
            <span>Buku Piutang</span>
            {totalUnsettledArCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                {totalUnsettledArCount}
              </span>
            )}
            <kbd className="hidden lg:inline text-[9px] bg-amber-950/80 px-1 py-0.5 rounded text-amber-200 border border-amber-700">F3</kbd>
          </button>

          {hasPermission(currentUser.role, 'AR_SETTLE') && (
            <button
              id="open-ar-settlement-btn"
              onClick={() => {
                setInitialArCustomerId(undefined);
                setShowArModal(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
              title="Pelunasan Piutang Pelanggan (Prompt 4)"
            >
              <Coins className="w-3.5 h-3.5 text-amber-700" />
              <span>Pelunasan Piutang (AR)</span>
              {customers.filter(c => c.arBalance > 0).length > 0 && (
                <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                  {customers.filter(c => c.arBalance > 0).length}
                </span>
              )}
            </button>
          )}
          <span className="text-[10px] text-slate-500 hidden md:inline">
            Kasir: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.role})
          </span>
        </div>
      </div>

      {/* PROMPT 8: BANNER STATUS SESI KASIR */}
      {activeCashSession ? (
        <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-1.5 flex items-center justify-between text-xs text-emerald-950 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span>
              <strong>Shift Aktif:</strong> <span className="font-mono font-bold text-emerald-900">{activeCashSession.id}</span>
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-emerald-800 hidden sm:inline">
              Buka: {formatDateTimeIndo(activeCashSession.openedAt)}
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-emerald-900">
              Modal Awal: <strong>{formatRupiah(activeCashSession.openingFloat)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setSessionToClose(activeCashSession);
                setShowCloseSessionModal(true);
              }}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-2xs transition"
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Tutup Sesi</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center justify-between text-xs text-amber-900 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Belum Buka Sesi Kasir:</strong> Transaksi kasir tetap dapat berjalan biasa, namun tidak terikat pada shift rekonsiliasi kas.
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasPermission(currentUser.role, 'CASH_SESSION_OPEN') && (
              <button
                onClick={() => setShowOpenSessionModal(true)}
                className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold text-[11px] flex items-center gap-1 shadow-2xs transition"
              >
                <Unlock className="w-3 h-3" />
                <span>Buka Shift</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* NOTIFIKASI HASIL REKONSILIASI KAS */}
      {sessionNotification && (
        <div className="bg-slate-800 text-white border-b border-slate-700 px-3 py-2 flex items-center justify-between text-xs flex-shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <strong className="text-amber-400">{sessionNotification.title}:</strong> {sessionNotification.message}
            </div>
          </div>
          <button
            onClick={() => setSessionNotification(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {activeView === 'katalog' ? (
        <>
          {/* Search & Category Filter Bar */}
          <div className="bg-white p-3 border-b border-slate-200/80 shadow-xs space-y-2.5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="kasir-search-input"
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Cari cepat produk sembako (gula, beras, telur, minyak)..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-800"
                />
                {search && (
                  <button
                    id="btn-clear-kasir-search"
                    onClick={() => handleSearchChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Tombol Cek Harga Cepat */}
              <button
                id="btn-quick-price-checker"
                onClick={() => setShowPriceCheckModal(true)}
                className="px-2.5 sm:px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs flex-shrink-0"
                title="Buka dialog cek harga real-time tanpa masuk keranjang (Shortcut: F2)"
              >
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Cek Harga</span>
                <span className="text-[10px] px-1 py-0.2 bg-emerald-200 text-emerald-900 rounded font-mono hidden md:inline">F2</span>
              </button>

              {/* Toggle Mode Tampilan: Kartu (Grid) vs Daftar Harga (Tabel) */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex-shrink-0">
                <button
                  id="btn-view-mode-grid"
                  onClick={() => setCatalogViewMode('grid')}
                  className={`p-1.5 rounded-md text-xs transition flex items-center gap-1 ${
                    catalogViewMode === 'grid'
                      ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilan Grid Kartu"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="text-[10px] hidden lg:inline">Kartu</span>
                </button>
                <button
                  id="btn-view-mode-table"
                  onClick={() => setCatalogViewMode('table')}
                  className={`p-1.5 rounded-md text-xs transition flex items-center gap-1 ${
                    catalogViewMode === 'table'
                      ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilan Tabel Daftar Harga Ringkas"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="text-[10px] hidden lg:inline">Daftar Harga</span>
                </button>
              </div>
            </div>

            {/* Category Pills & Count */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs flex-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-emerald-700 text-white font-semibold'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400 whitespace-nowrap hidden sm:inline">
                {filteredProducts.length} produk
              </span>
            </div>
          </div>

          {/* Main Products Container (Grid or Table View) */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {catalogViewMode === 'table' ? (
              /* Tampilan Tabel Daftar Harga Jual Real-Time */
              <div id="tabel-daftar-harga-katalog" className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Nama Produk Sembako</th>
                        <th className="py-2.5 px-3">Kategori</th>
                        <th className="py-2.5 px-3 text-right">Harga Jual Satuan (Real-Time)</th>
                        <th className="py-2.5 px-3 text-center">Status Stok</th>
                        <th className="py-2.5 px-3 text-center">Aksi Beli</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map(product => {
                        const stock = getStockForProduct(product.id);
                        const inCart = kasirCart.find(i => i.productId === product.id);
                        const isLowStock = stock <= (product.minStockAlert || 5) && stock > 0;
                        const isOutOfStock = stock <= 0;

                        return (
                          <tr key={product.id} id={`table-row-${product.id}`} className="hover:bg-emerald-50/40 transition">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{product.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {product.id} • Satuan: {product.unit}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                {product.category || 'Lainnya'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-mono font-bold text-emerald-800 text-sm">
                                {formatRupiah(product.sellPrice)}
                              </span>
                              <span className="text-[10px] font-normal text-slate-400 font-sans ml-1">/{product.unit}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 ${
                                isOutOfStock 
                                  ? 'bg-rose-100 text-rose-800' 
                                  : isLowStock 
                                    ? 'bg-amber-100 text-amber-900' 
                                    : 'bg-emerald-50 text-emerald-800'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                                }`} />
                                {stock} {product.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {inCart ? (
                                <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-300 rounded-lg px-1.5 py-0.5">
                                  <button
                                    onClick={() => db.updateCartItemQty(product.id, inCart.qty - 1)}
                                    className="w-5 h-5 flex items-center justify-center text-emerald-700 hover:bg-emerald-200 rounded"
                                    title="Kurang Qty"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="text-xs font-bold text-emerald-900 min-w-4 text-center font-mono">
                                    {inCart.qty}
                                  </span>
                                  <button
                                    onClick={() => db.updateCartItemQty(product.id, inCart.qty + 1)}
                                    className="w-5 h-5 flex items-center justify-center text-emerald-700 hover:bg-emerald-200 rounded"
                                    title="Tambah Qty"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  id={`btn-table-buy-${product.id}`}
                                  onClick={() => db.addToCart(product.id, product.sellPrice)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 transition shadow-2xs"
                                  title="Masukkan ke keranjang jika pelanggan ingin beli"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Beli</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                {filteredProducts.map(product => {
                  const stock = getStockForProduct(product.id);
                  const inCart = kasirCart.find(i => i.productId === product.id);

                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs hover:border-emerald-300 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {product.itemType}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            stock <= (product.minStockAlert || 5)
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}>
                            Stok: {stock} {product.unit}
                          </span>
                        </div>

                        <h4 className="font-semibold text-xs sm:text-sm text-slate-900 mt-1.5 leading-snug">
                          {product.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Satuan: {product.unit}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-emerald-700">
                            {formatRupiah(product.sellPrice)}
                          </span>
                          <span className="text-[10px] text-slate-400">/{product.unit}</span>
                        </div>

                        {inCart ? (
                          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 rounded-lg px-1.5 py-0.5">
                            <button
                              onClick={() => db.updateCartItemQty(product.id, inCart.qty - 1)}
                              className="w-5 h-5 flex items-center justify-center text-emerald-700 hover:bg-emerald-200 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold text-emerald-900 min-w-4 text-center">
                              {inCart.qty}
                            </span>
                            <button
                              onClick={() => db.updateCartItemQty(product.id, inCart.qty + 1)}
                              className="w-5 h-5 flex items-center justify-center text-emerald-700 hover:bg-emerald-200 rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => db.addToCart(product.id, product.sellPrice)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1 shadow-2xs transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p className="text-sm font-medium">Produk sembako tidak ditemukan.</p>
                <p className="text-xs text-slate-400 mt-1">Coba kata kunci lain atau pilih kategori Semua.</p>
              </div>
            )}
          </div>

          {/* Floating Bottom Cart Bar */}
          {kasirCart.length > 0 && (
            <div className="bg-white border-t border-slate-200 p-3 shadow-lg flex-shrink-0">
              <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
                <div 
                  onClick={() => setShowCartDrawer(!showCartDrawer)}
                  className="cursor-pointer flex items-center gap-2.5"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Keranjang ({totalItemsCount} item) • <span className="text-emerald-700 font-semibold underline">Detail</span>
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {formatRupiah(grandTotal)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => db.clearCart()}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                    title="Kosongkan Keranjang"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    id="kasir-bayar-direct-btn"
                    onClick={openCheckout}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Bayar (CASH)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Slide-Up Cart Details Drawer */}
          {showCartDrawer && kasirCart.length > 0 && (
            <div className="fixed inset-0 bg-black/40 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
                {/* Drawer Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-sm text-slate-900">
                      Keranjang Belanja ({kasirCart.length} jenis produk)
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCartDrawer(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded"
                  >
                    Tutup
                  </button>
                </div>

                {/* Cart Items List */}
                <div className="p-4 overflow-y-auto space-y-3 divide-y divide-slate-100 flex-1">
                  {cartWithDetails.map(item => (
                    <div key={item.productId} className="pt-3 first:pt-0 flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {item.product?.name || item.productId}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.qty} × {formatRupiah(item.unitPrice)}/{item.product?.unit || 'unit'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-800">
                          {formatRupiah(item.lineSubtotal)}
                        </span>
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                          <button
                            onClick={() => db.updateCartItemQty(item.productId, item.qty - 1)}
                            className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-white rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => db.updateCartItemQty(item.productId, item.qty + 1)}
                            className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-white rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo Code & Voucher Section */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-teal-600" />
                      <span>Kupon & Diskon Belanja</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPromotionModal(true)}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-800 underline"
                    >
                      Pilih Dari Daftar Kupon
                    </button>
                  </div>

                  {appliedPromotion ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-emerald-700 text-white">
                            {appliedPromotion.code}
                          </span>
                          <span className="text-xs font-bold text-emerald-900">
                            {appliedPromotion.type === 'PERCENTAGE' ? `Diskon ${appliedPromotion.value}%` : `Potongan ${formatRupiah(appliedPromotion.value)}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 truncate">
                          {appliedPromotion.name}
                        </p>
                        {!discountCalculation.isEligible && (
                          <p className="text-[10px] text-amber-700 font-semibold">
                            ⚠️ {discountCalculation.ineligibleReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-mono font-bold text-emerald-800">
                          -{formatRupiah(discountAmount)}
                        </span>
                        <button
                          type="button"
                          onClick={handleRemovePromotion}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Hapus Kupon"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Ketik kode kupon (misal: HEMAT10)..."
                          value={promoCodeInput}
                          onChange={e => {
                            setPromoCodeInput(e.target.value.toUpperCase());
                            setPromoMessage(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyPromoCode();
                            }
                          }}
                          className="w-full px-3 py-1.5 text-xs uppercase font-mono font-bold border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-teal-500 placeholder:normal-case placeholder:font-sans placeholder:font-normal"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyPromoCode()}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-2xs transition"
                      >
                        Terapkan
                      </button>
                    </div>
                  )}

                  {promoMessage && (
                    <p className={`text-[11px] font-medium ${promoMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {promoMessage.text}
                    </p>
                  )}
                </div>

                {/* Calculation & PPN Toggle */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                  {/* §6 PPN Toggle */}
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Kenakan PPN 11%</span>
                      <span className="text-[10px] text-slate-400">Default mati untuk sembako bebas PPN</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyPpn}
                        onChange={(e) => setApplyPpn(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Pembulatan per-baris):</span>
                      <span className="font-semibold text-slate-900">{formatRupiah(totalSubtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-emerald-600" />
                          <span>Diskon Promo ({appliedPromotion?.code}):</span>
                        </span>
                        <span className="font-bold font-mono">-{formatRupiah(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>PPN {applyPpn ? '11%' : '0% (Bebas PPN)'}:</span>
                      <span className="font-semibold text-slate-900">{formatRupiah(totalPpn)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                      <span>Total Tagihan:</span>
                      <span className="text-emerald-700 font-mono font-bold">{formatRupiah(grandTotal)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCartDrawer(false)}
                      className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      Kembali ke Katalog
                    </button>
                    <button
                      onClick={openCheckout}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Lanjut Bayar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Tab Riwayat Transaksi Hari Ini */
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Riwayat Penjualan Sembako ({sales.length} transaksi)
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Status: COMMITTED (Immutable)
            </span>
          </div>

          {sales.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6 space-y-2">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">Belum ada transaksi penjualan</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Silakan tambahkan produk ke keranjang di tab Katalog Kasir dan tekan tombol Bayar untuk melakukan transaksi tunai atau kredit pertama.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sales.map(s => {
                const lines = saleLines.filter(l => l.saleId === s.id);
                const cust = s.customerId ? customers.find(c => c.id === s.customerId) : undefined;
                const isCredit = s.paymentMethod === 'CREDIT';
                const isOverdue = isCredit && s.dueDate ? isDateOverdue(s.dueDate) : false;

                const canVoid = hasPermission(currentUser.role, 'SALE_VOID') && s.status === 'COMMITTED';
                const canReturn = hasPermission(currentUser.role, 'SALE_RETURN') && (s.status === 'COMMITTED' || s.status === 'PARTIALLY_RETURNED');

                const getSaleStatusBadge = (status: string) => {
                  switch (status) {
                    case 'COMMITTED':
                      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
                    case 'PARTIALLY_RETURNED':
                      return 'bg-amber-100 text-amber-900 border-amber-300';
                    case 'RETURNED':
                      return 'bg-purple-100 text-purple-900 border-purple-300';
                    case 'REVERSED':
                      return 'bg-red-100 text-red-900 border-red-300';
                    default:
                      return 'bg-slate-100 text-slate-700 border-slate-300';
                  }
                };

                return (
                  <div
                    key={s.id}
                    onClick={() => handleOpenHistoricalSale(s)}
                    className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs hover:border-emerald-400 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-800">{s.id}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getSaleStatusBadge(s.status)}`}>
                          {s.status === 'REVERSED' ? 'REVERSED (VOID)' : s.status}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          isCredit 
                            ? 'bg-amber-100 text-amber-900 border-amber-300' 
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}>
                          {isCredit ? 'TEMPO (KREDIT)' : 'TUNAI (CASH)'}
                        </span>
                        {s.ppnAmount > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            PPN 11%
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                            JATUH TEMPO
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-1">
                        Kasir: {s.cashierName} • {formatDateTimeIndo(s.createdAt)}
                      </p>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{lines.length} jenis item sembako</span>
                        {cust && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">Pelanggan: {cust.name}</span>
                          </>
                        )}
                        {s.dueDate && (
                          <>
                            <span>•</span>
                            <span className="text-amber-800 font-medium">Jatuh Tempo: {formatDateIndo(s.dueDate)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                      <div className="text-left sm:text-right">
                        <span className="text-sm font-bold text-emerald-800 block">
                          {formatRupiah(s.grandTotal)}
                        </span>
                        <span className="text-[10px] text-slate-400 underline inline-block">
                          Lihat Struk & Jurnal
                        </span>
                      </div>

                      {/* Prompt 5 RBAC Buttons: Void & Retur (Only for OWNER & ADMIN) */}
                      {(canVoid || canReturn) && (
                        <div className="flex items-center gap-1.5 pt-1">
                          {canVoid && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVoidSale(s);
                              }}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-2xs"
                              title="Void Transaksi (Pembatalan Penuh)"
                            >
                              <RotateCcw className="w-3 h-3 text-red-600" />
                              <span>Void</span>
                            </button>
                          )}

                          {canReturn && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReturnSale(s);
                              }}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-2xs"
                              title="Retur Barang (Sebagian / Seluruh)"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-600" />
                              <span>Retur</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* §10 MODAL PEMBAYARAN KASIR (CASH ATAU TEMPO/KREDIT) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Pembayaran Kasir POS</h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Precondition Error Alert (§3) */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="block font-bold">Transaksi Ditolak:</strong>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Payment Method Switcher (TUNAI vs TEMPO) */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('CASH');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Tunai (CASH)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('CREDIT');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'CREDIT'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>Tempo (KREDIT)</span>
                </button>
              </div>

              {/* Total Tagihan Box & Promo Breakdown */}
              <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-emerald-800 font-semibold block">Total Yang Harus Dibayar:</span>
                    <span className="text-xl font-bold text-emerald-950 font-mono">{formatRupiah(grandTotal)}</span>
                  </div>
                  <span className="text-xs bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-md">
                    {totalItemsCount} Unit Barang
                  </span>
                </div>

                {/* Subtotal & Diskon Breakdown */}
                <div className="pt-2 border-t border-emerald-200/80 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Barang:</span>
                    <span className="font-mono">{formatRupiah(totalSubtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Kupon Promo ({appliedPromotion?.code}):</span>
                      </span>
                      <span className="font-mono">-{formatRupiah(discountAmount)}</span>
                    </div>
                  )}
                  {applyPpn && (
                    <div className="flex justify-between text-slate-600">
                      <span>PPN 11%:</span>
                      <span className="font-mono">{formatRupiah(totalPpn)}</span>
                    </div>
                  )}
                </div>

                {/* Quick Promo Toggle in Payment Modal */}
                <div className="pt-1.5 flex items-center justify-between text-[11px]">
                  {appliedPromotion ? (
                    <div className="flex items-center justify-between w-full text-emerald-800">
                      <span>Kupon aktif: <strong>{appliedPromotion.code}</strong></span>
                      <button
                        type="button"
                        onClick={handleRemovePromotion}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        Hapus Kupon
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <button
                        type="button"
                        onClick={() => setShowPromoInputInCheckout(!showPromoInputInCheckout)}
                        className="text-emerald-800 font-bold hover:underline flex items-center gap-1"
                      >
                        <Tag className="w-3 h-3 text-emerald-700" />
                        <span>{showPromoInputInCheckout ? 'Sembunyikan Kupon' : 'Punya Kode Promo / Kupon?'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPromotionModal(true)}
                        className="text-slate-600 font-medium hover:underline text-[10px]"
                      >
                        Lihat Daftar Promo
                      </button>
                    </div>
                  )}
                </div>

                {/* Promo Code Input in Payment Modal */}
                {!appliedPromotion && showPromoInputInCheckout && (
                  <div className="pt-2 border-t border-emerald-200/60 space-y-1.5">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Ketik kode promo (misal: HEMAT10)..."
                        value={promoCodeInput}
                        onChange={e => {
                          setPromoCodeInput(e.target.value.toUpperCase());
                          setPromoMessage(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyPromoCode();
                          }
                        }}
                        className="flex-1 px-2.5 py-1 text-xs uppercase font-mono font-bold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyPromoCode()}
                        className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                      >
                        Gunakan
                      </button>
                    </div>
                    {promoMessage && (
                      <p className={`text-[10px] font-semibold ${promoMessage.type === 'success' ? 'text-emerald-800' : 'text-rose-600'}`}>
                        {promoMessage.text}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Pelanggan Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Pilih Pelanggan {paymentMethod === 'CREDIT' && <span className="text-red-500">*</span>}:</span>
                  {paymentMethod === 'CASH' && (
                    <span className="text-[10px] text-slate-400 font-normal">Opsional untuk penjualan tunai</span>
                  )}
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setCreditOverride(false);
                    setErrorMessage(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  {paymentMethod === 'CASH' && (
                    <option value="">-- Pelanggan Umum / Tunai Kasir --</option>
                  )}
                  {paymentMethod === 'CREDIT' && (
                    <option value="" disabled>-- Pilih Pelanggan Kredit --</option>
                  )}
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} • Limit: {formatRupiah(c.creditLimit)} • Piutang: {formatRupiah(c.arBalance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Credit Specific Validation & Profile */}
              {paymentMethod === 'CREDIT' && selectedCustomer && (
                <div className="space-y-2.5">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Plafon Limit</span>
                      <span className="font-bold text-slate-800 block mt-0.5">{formatRupiah(customerLimit)}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Piutang Berjalan</span>
                      <span className="font-bold text-amber-800 block mt-0.5">{formatRupiah(customerExposure)}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Exposure</span>
                      <span className={`font-bold block mt-0.5 ${isCreditLimitExceeded ? 'text-red-600 font-extrabold' : 'text-slate-800'}`}>
                        {formatRupiah(newExposure)}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Jatuh Tempo</span>
                      <span className="font-bold text-slate-800 block mt-0.5">{dueDatePreview}</span>
                    </div>
                  </div>

                  {/* Warning: Zero Credit Limit */}
                  {isZeroLimit && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="block font-bold">Limit Kredit Rp 0:</strong>
                        <span>Pelanggan ini tidak memiliki fasilitas kredit/tempo. Pilih metode Tunai atau ubah limit di master data.</span>
                      </div>
                    </div>
                  )}

                  {/* Warning: Limit Exceeded */}
                  {!isZeroLimit && isCreditLimitExceeded && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="block font-bold">Melebihi Limit Kredit!</strong>
                          <span>
                            Total piutang akan menjadi <span className="font-bold">{formatRupiah(newExposure)}</span>, melebihi plafon limit <span className="font-bold">{formatRupiah(customerLimit)}</span>.
                          </span>
                        </div>
                      </div>

                      {/* Supervisor Override Option */}
                      {isManagerRole ? (
                        <label className="flex items-center gap-2 bg-white/80 p-2 rounded-lg border border-amber-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={creditOverride}
                            onChange={(e) => setCreditOverride(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                          />
                          <span className="font-bold text-[11px] text-amber-900">
                            Otorisasi {currentUser.role}: Setujui penjualan melebihi limit kredit
                          </span>
                        </label>
                      ) : (
                        <p className="text-[11px] text-red-700 font-bold bg-white/70 p-2 rounded-lg border border-red-200">
                          Kasir tidak dapat memproses penjualan melebihi limit kredit tanpa otorisasi Owner/Admin.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] bg-amber-50/70 border border-amber-200/80 p-2 rounded-lg text-amber-900">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                      <span>Transaksi tempo ini akan tercatat di <strong>Buku Piutang</strong>.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentModal(false);
                        setShowBukuPiutangModal(true);
                      }}
                      className="text-amber-800 hover:text-amber-950 font-bold underline text-[11px]"
                    >
                      Buka Buku Piutang
                    </button>
                  </div>
                </div>
              )}

              {/* PPN 11% Toggle */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 block">Faktur Pajak (PPN 11%)</span>
                  <span className="text-[10px] text-slate-500">Aktifkan jika transaksi dikenakan faktur PPN</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyPpn}
                    onChange={(e) => setApplyPpn(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* CASH Payment Inputs */}
              {paymentMethod === 'CASH' && (
                <>
                  {/* Quick Cash Buttons */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      Pilihan Cepat Uang Tunai Diterima:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {quickCashOptions.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setCashPaidInput(String(opt))}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border ${
                            parsedCashPaid === opt
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                          }`}
                        >
                          {opt === grandTotal ? 'Uang Pas' : formatRupiah(opt)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Cash Input */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Nominal Uang Tunai Diterima (Rupiah)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        min={grandTotal}
                        step="500"
                        value={cashPaidInput}
                        onChange={(e) => setCashPaidInput(e.target.value)}
                        placeholder="Contoh: 100000"
                        className="w-full pl-9 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Change Calculation Box */}
                  <div className="bg-slate-100 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-slate-600 font-semibold">Uang Kembalian:</span>
                    <span className={`text-base font-bold ${changeAmount > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {formatRupiah(changeAmount)}
                    </span>
                  </div>
                </>
              )}

              {/* CREDIT Payment Info Banner */}
              {paymentMethod === 'CREDIT' && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-1 text-[11px] text-amber-900">
                  <p className="font-bold">Penjualan Tempo (Kredit):</p>
                  <p className="text-amber-800">
                    Tagihan sebesar <span className="font-bold">{formatRupiah(grandTotal)}</span> akan dicatat sebagai Piutang Usaha (Akun 1210) pada pelanggan <span className="font-bold">{selectedCustomer?.name || 'terpilih'}</span> dengan jatuh tempo pada <span className="font-bold">{dueDatePreview}</span>.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  id="confirm-cash-commit-btn"
                  type="button"
                  disabled={!canCommit || isProcessing}
                  onClick={handleCommitSale}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition flex items-center justify-center gap-1.5 ${
                    canCommit && !isProcessing
                      ? paymentMethod === 'CREDIT'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-slate-400 cursor-not-allowed'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>
                    {isProcessing 
                      ? 'Memproses FIFO...' 
                      : paymentMethod === 'CREDIT' 
                      ? 'Konfirmasi Jual Kredit' 
                      : 'Konfirmasi & Cetak'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL UPON COMMIT SUCCESS */}
      {showReceiptModal && completedSale && (
        <ReceiptModal
          isOpen={showReceiptModal}
          sale={completedSale}
          saleLines={completedLines}
          journal={completedJournal}
          journalLines={completedJLines}
          onClose={() => setShowReceiptModal(false)}
          onOpenInspector={onOpenInspector}
        />
      )}

      {/* FITUR BUKU PIUTANG KASIR (CATATAN BON & JATUH TEMPO) */}
      {showBukuPiutangModal && (
        <BukuPiutangKasirModal
          isOpen={showBukuPiutangModal}
          onClose={() => setShowBukuPiutangModal(false)}
          onOpenArSettlement={(customerId) => {
            setInitialArCustomerId(customerId);
            setShowArModal(true);
          }}
          onOpenInspector={onOpenInspector}
        />
      )}

      {/* AR SETTLEMENT MODAL (Prompt 4) */}
      {showArModal && (
        <ArSettlementModal
          isOpen={showArModal}
          initialCustomerId={initialArCustomerId}
          onClose={() => {
            setShowArModal(false);
            setInitialArCustomerId(undefined);
          }}
          onOpenInspector={onOpenInspector}
        />
      )}

      {/* PROMPT 5: VOID SALE MODAL */}
      {selectedVoidSale && (
        <VoidSaleModal
          isOpen={!!selectedVoidSale}
          sale={selectedVoidSale}
          saleLines={saleLines}
          onClose={() => setSelectedVoidSale(null)}
          onSuccess={() => setSelectedVoidSale(null)}
          onOpenInspector={onOpenInspector}
        />
      )}

      {/* PROMPT 5: RETURN SALE MODAL */}
      {selectedReturnSale && (
        <ReturnSaleModal
          isOpen={!!selectedReturnSale}
          sale={selectedReturnSale}
          saleLines={saleLines}
          onClose={() => setSelectedReturnSale(null)}
          onSuccess={() => setSelectedReturnSale(null)}
          onOpenInspector={onOpenInspector}
        />
      )}

      {/* PROMPT 8: OPEN CASH SESSION MODAL */}
      {showOpenSessionModal && (
        <OpenCashSessionModal
          isOpen={showOpenSessionModal}
          currentUser={currentUser}
          onClose={() => setShowOpenSessionModal(false)}
          onSuccess={(newSession) => {
            setSessionNotification({
              type: 'success',
              title: 'Sesi Kasir Berhasil Dibuka',
              message: `Shift #${newSession.id} telah aktif dengan modal awal ${formatRupiah(newSession.openingFloat)}.`
            });
          }}
        />
      )}

      {/* PROMPT 8: CLOSE CASH SESSION MODAL */}
      {showCloseSessionModal && sessionToClose && (
        <CloseCashSessionModal
          isOpen={showCloseSessionModal}
          session={sessionToClose}
          currentUser={currentUser}
          onClose={() => {
            setShowCloseSessionModal(false);
            setSessionToClose(null);
          }}
          onSuccess={(closedSession, journal) => {
            const variance = closedSession.variance || 0;
            let varianceMsg = 'Kas fisik cocok dengan kalkulasi sistem (pas).';
            if (variance < 0) {
              varianceMsg = `Terdapat selisih kas KURANG sebesar ${formatRupiah(Math.abs(variance))}. Jurnal ${journal?.id || ''} telah dibuat otomatis (5910 SELISIH_KAS).`;
            } else if (variance > 0) {
              varianceMsg = `Terdapat selisih kas LEBIH sebesar ${formatRupiah(variance)}. Jurnal ${journal?.id || ''} telah dibuat otomatis (5910 SELISIH_KAS).`;
            }

            setSessionNotification({
              type: 'info',
              title: `Sesi Kasir #${closedSession.id} Berhasil Ditutup`,
              message: varianceMsg
            });
          }}
        />
      )}

      {/* PROMPT 8: CASH SESSION HISTORY MODAL */}
      {showSessionHistoryModal && (
        <CashSessionHistoryModal
          isOpen={showSessionHistoryModal}
          currentUser={currentUser}
          onClose={() => setShowSessionHistoryModal(false)}
          onSelectSessionToClose={(session) => {
            setShowSessionHistoryModal(false);
            setSessionToClose(session);
            setShowCloseSessionModal(true);
          }}
        />
      )}

      {/* MODAL DAFTAR HARGA JUAL & CEK HARGA CEPAT (PENCARIAN REAL-TIME TANPA KERANJANG) */}
      <PriceCheckModal
        isOpen={showPriceCheckModal}
        onClose={() => setShowPriceCheckModal(false)}
        products={products}
        getStockForProduct={getStockForProduct}
        onAddToCart={(productId, price) => {
          db.addToCart(productId, price);
        }}
        onUpdateCartQty={(productId, qty) => {
          db.updateCartItemQty(productId, qty);
        }}
        cartItems={kasirCart}
      />

      {/* MODAL MANAJEMEN PROMOSI & KODE DISKON */}
      <PromotionManagementModal
        isOpen={showPromotionModal}
        onClose={() => setShowPromotionModal(false)}
        cartSubtotal={totalSubtotal}
        onApplyPromoToCart={(promo) => {
          handleApplyPromoCode(promo.code);
          setShowPromotionModal(false);
        }}
      />
    </div>
  );
};
