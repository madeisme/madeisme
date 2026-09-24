import React, { useState, useMemo } from 'react';
import { useAppDatabase } from '../database/useAppDatabase';
import { formatRupiah, formatDateTimeIndo } from '../utils/formatters';
import { hasPermission } from '../rbac/permissions';
import { LaporanContainer } from '../components/laporan/LaporanContainer';
import { generateProfitAndLoss, generateBalanceSheet } from '../utils/accountingReports';
import { runSystemHealthCheck } from '../utils/systemHealthCheck';
import { FinancialInsightCharts } from '../components/beranda/FinancialInsightCharts';
import { LaporanArusKasCard } from '../components/beranda/LaporanArusKasCard';
import { RingkasanKeuanganCard } from '../components/beranda/RingkasanKeuanganCard';
import { EstimasiLabaRugiCard } from '../components/beranda/EstimasiLabaRugiCard';
import { DailySalesTrendCard } from '../components/beranda/DailySalesTrendCard';
import { MonthlySalesTrendCard } from '../components/beranda/MonthlySalesTrendCard';
import { 
  ReceiptText, 
  AlertTriangle, 
  ArrowRight, 
  ShieldCheck, 
  Layers, 
  Coins,
  CreditCard,
  FileText,
  LayoutDashboard,
  Clock,
  CheckCircle2,
  Package,
  ShoppingBag,
  TrendingUp,
  Activity,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { TabDestination } from '../components/layout/BottomNav';

interface BerandaScreenProps {
  onNavigate: (tab: TabDestination) => void;
  onOpenInspector: () => void;
}

export const BerandaScreen: React.FC<BerandaScreenProps> = ({ onNavigate, onOpenInspector }) => {
  const { 
    products, 
    inventoryLayers, 
    currentUser, 
    accounts, 
    journals,
    journalLines,
    sales, 
    customers, 
    suppliers,
    purchases,
    db
  } = useAppDatabase();

  const [activeView, setActiveView] = useState<'ringkasan' | 'laporan'>('ringkasan');
  const canViewReports = hasPermission(currentUser.role, 'REPORT_VIEW');

  // Tanggal hari ini (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Tanggal awal bulan berjalan (YYYY-MM-01)
  const monthStartStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }, []);

  // 1. Penjualan Hari Ini: grandTotal semua Sale COMMITTED dengan businessDate = hari ini
  const committedSales = useMemo(() => {
    return sales.filter(s => s.status === 'COMMITTED');
  }, [sales]);

  const todayCommittedSales = useMemo(() => {
    return committedSales.filter(s => s.businessDate === todayStr);
  }, [committedSales, todayStr]);

  const todaySalesTotal = useMemo(() => {
    return todayCommittedSales.reduce((sum, s) => sum + s.grandTotal, 0);
  }, [todayCommittedSales]);

  const totalCommittedSalesAllTime = useMemo(() => {
    return committedSales.reduce((sum, s) => sum + s.grandTotal, 0);
  }, [committedSales]);

  // 2. Sesi Kasir Aktif untuk user yang login
  const activeCashSession = useMemo(() => {
    return db.getActiveCashSession(currentUser.id);
  }, [db, currentUser.id]);

  // 3. Piutang Pelanggan (AR) & Piutang Jatuh Tempo (Overdue)
  const totalArBalance = useMemo(() => {
    return customers.reduce((sum, c) => sum + c.arBalance, 0);
  }, [customers]);

  const overdueAnalysis = useMemo(() => {
    let overdueInvoicesCount = 0;
    let overdueAmountTotal = 0;
    const customersWithOverdue: { customerId: string; customerName: string; overdueAmount: number; count: number }[] = [];

    customers.filter(c => c.arBalance > 0).forEach(c => {
      const creditSalesInfo = db.getCustomerCreditSalesWithSettlement(c.id);
      const overdueList = creditSalesInfo.filter(item => item.remainingBalance > 0 && item.isOverdue);
      if (overdueList.length > 0) {
        const custOverdueAmount = overdueList.reduce((sum, item) => sum + item.remainingBalance, 0);
        overdueInvoicesCount += overdueList.length;
        overdueAmountTotal += custOverdueAmount;
        customersWithOverdue.push({
          customerId: c.id,
          customerName: c.name,
          overdueAmount: custOverdueAmount,
          count: overdueList.length
        });
      }
    });

    return {
      overdueInvoicesCount,
      overdueAmountTotal,
      customersWithOverdue
    };
  }, [customers, db]);

  // 4. Hutang ke Supplier (AP)
  const totalApBalance = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + s.apBalance, 0);
  }, [suppliers]);
  const suppliersWithApCount = useMemo(() => {
    return suppliers.filter(s => s.apBalance > 0).length;
  }, [suppliers]);

  // 5. Stok Menipis (quantityRemaining < minStockAlert || 5)
  const lowStockItems = useMemo(() => {
    return products.map(product => {
      const totalQty = inventoryLayers
        .filter(l => l.productId === product.id)
        .reduce((sum, l) => sum + l.quantityRemaining, 0);
      const threshold = product.minStockAlert !== undefined ? product.minStockAlert : 5;
      return {
        product,
        totalQty,
        threshold,
        isLow: totalQty < threshold
      };
    }).filter(item => item.isLow);
  }, [products, inventoryLayers]);

  // 6. PO Menunggu Aksi: DRAFT (perlu approve) atau APPROVED/RECEIVING (perlu diterima)
  const draftPoCount = useMemo(() => {
    return purchases.filter(p => p.status === 'DRAFT').length;
  }, [purchases]);

  const receivingPoCount = useMemo(() => {
    return purchases.filter(p => p.status === 'APPROVED' || p.status === 'RECEIVING').length;
  }, [purchases]);

  const totalPendingPoCount = draftPoCount + receivingPoCount;

  // 7. Ringkas Laporan: Laba Kotor bulan berjalan (diambil langsung dari logic Laba Rugi Prompt 6)
  const currentMonthIncomeStatement = useMemo(() => {
    try {
      return generateProfitAndLoss({
        startDate: monthStartStr,
        endDate: todayStr,
        accounts,
        journals,
        journalLines
      });
    } catch {
      return null;
    }
  }, [monthStartStr, todayStr, accounts, journals, journalLines]);

  // 8. System Health Check quick status
  const healthReport = useMemo(() => {
    return runSystemHealthCheck(db);
  }, [db, sales, inventoryLayers, journals, purchases, customers, suppliers]);

  // Total nilai persediaan (Aset 1310) dari InventoryLayer FIFO
  const totalInventoryValue = useMemo(() => {
    return inventoryLayers.reduce((sum, layer) => {
      return sum + (layer.quantityRemaining * layer.unitCost);
    }, 0);
  }, [inventoryLayers]);

  // 9. Perhitungan Harta Kas (Akun 1110) dari Neraca Hari Ini
  const currentCashBalance = useMemo(() => {
    try {
      const bs = generateBalanceSheet({
        asOfDate: todayStr,
        accounts,
        journals,
        journalLines
      });
      const cashAcc = bs.assetRows.find(r => r.account.code === '1110');
      return cashAcc ? cashAcc.balance : 0;
    } catch {
      return 0;
    }
  }, [todayStr, accounts, journals, journalLines]);

  // 10. Pembagian Penjualan Tunai vs Tempo
  const cashSalesTotal = useMemo(() => {
    return committedSales.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.grandTotal, 0);
  }, [committedSales]);

  const creditSalesTotal = useMemo(() => {
    return committedSales.filter(s => s.paymentMethod === 'CREDIT').reduce((sum, s) => sum + s.grandTotal, 0);
  }, [committedSales]);

  // 11. Tren Penjualan 7 Hari Terakhir
  const weeklyTrend = useMemo(() => {
    const days: { dayLabel: string; sales: number; cogs: number; profit: number }[] = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
      
      const daySales = committedSales.filter(s => s.businessDate === dateStr);
      const salesTotal = daySales.reduce((sum, s) => sum + s.grandTotal, 0);
      const cogsTotal = daySales.reduce((sum, s) => sum + (s.totalCostOfGoodsSold || 0), 0);
      const profitTotal = Math.max(0, salesTotal - cogsTotal);
      
      days.push({
        dayLabel: dayName,
        sales: salesTotal,
        cogs: cogsTotal,
        profit: profitTotal
      });
    }
    return days;
  }, [committedSales]);

  return (
    <div className="p-4 sm:p-5 space-y-5 pb-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-800 to-teal-950 text-white rounded-2xl p-5 shadow-sm border border-emerald-700/50 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-emerald-300 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Sistem Operasional Aktif
            </span>
            <span className="text-xs bg-emerald-700/60 px-2.5 py-0.5 rounded-full border border-emerald-600/60 font-medium">
              Peran: {currentUser.role}
            </span>
          </div>
          <h2 className="text-xl font-bold mt-2">Selamat datang, {currentUser.name}</h2>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-md">
            Dashboard konsolidasi real-time Omah Sembako Sehati. Seluruh data transaksi, mutasi stok, jurnal, dan piutang tersinkronisasi.
          </p>

          {/* Quick Health Status Indicator */}
          <div className="mt-3 pt-3 border-t border-emerald-700/60 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${healthReport.overallStatus === 'PASS' ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`}></span>
              <span className="text-emerald-200">
                Integritas Sistem: <strong className="text-white">{healthReport.passedCount}/{healthReport.totalChecks} {healthReport.overallStatus}</strong>
              </span>
            </div>
            <button
              onClick={() => onNavigate('operasional')}
              className="text-[11px] bg-white/10 hover:bg-white/20 text-emerald-100 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition"
            >
              <span>Detail Health Check</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-menu Toggle (Visible for OWNER, ADMIN, BOOKKEEPER - RBAC) */}
      {canViewReports && (
        <div className="flex items-center p-1 bg-slate-200/80 rounded-xl border border-slate-300/80">
          <button
            onClick={() => setActiveView('ringkasan')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeView === 'ringkasan'
                ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Ringkasan Eksekutif</span>
          </button>

          <button
            onClick={() => setActiveView('laporan')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeView === 'laporan'
                ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-700" />
            <span>Pusat Laporan Keuangan (5)</span>
          </button>
        </div>
      )}

      {/* VIEW 1: LAPORAN KEUANGAN */}
      {canViewReports && activeView === 'laporan' ? (
        <LaporanContainer />
      ) : (
        /* VIEW 2: RINGKASAN OPERASIONAL */
        <>
          {/* Card Sesi Kasir Aktif (Audit #2) */}
          <div className={`p-4 rounded-xl border transition shadow-xs ${
            activeCashSession 
              ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-300' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  activeCashSession ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                }`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900">
                      Status Sesi Kasir ({currentUser.name})
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                      activeCashSession 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {activeCashSession ? 'SHIFT TERBUKA (OPEN)' : 'TIDAK AKTIF'}
                    </span>
                  </div>
                  {activeCashSession ? (
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Dibuka sejak <span className="font-semibold text-slate-800">{formatDateTimeIndo(activeCashSession.openedAt)}</span> • Modal Awal: <strong className="text-emerald-800 font-mono">{formatRupiah(activeCashSession.openingFloat)}</strong>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Anda belum membuka laci kasir hari ini. Buka sesi di Kasir sebelum memproses struk tunai.
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => onNavigate('kasir')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  activeCashSession 
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white' 
                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                }`}
              >
                <span>{activeCashSession ? 'Buka Kasir' : 'Buka Shift Baru'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Metric Cards Grid (4 Cards: Penjualan Hari Ini, Laba Kotor, Piutang AR, Hutang AP) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Penjualan Hari Ini */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Penjualan Hari Ini</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ReceiptText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {formatRupiah(todaySalesTotal)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <strong className="text-emerald-700">{todayCommittedSales.length} transaksi</strong> hari ini
                </p>
                {todayCommittedSales.length === 0 && committedSales.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    Total riwayat: {formatRupiah(totalCommittedSalesAllTime)}
                  </p>
                )}
              </div>
            </div>

            {/* 2. Laba Kotor Bulan Berjalan */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Untung Penjualan (Laba Kotor)</span>
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {formatRupiah(currentMonthIncomeStatement?.grossProfit || 0)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Omzet Bersih: <span className="font-mono font-medium">{formatRupiah(currentMonthIncomeStatement?.netRevenue || 0)}</span>
                </p>
              </div>
            </div>

            {/* 3. Piutang Usaha (Tagihan ke Pelanggan) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Tagihan Pelanggan (Piutang AR)</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {formatRupiah(totalArBalance)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {overdueAnalysis.overdueInvoicesCount > 0 ? (
                    <span className="text-rose-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      {overdueAnalysis.overdueInvoicesCount} tempo lewat ({formatRupiah(overdueAnalysis.overdueAmountTotal)})
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      Semua tempo lancar
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* 4. Hutang Usaha (Hutang ke Supplier) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Hutang ke Supplier (Hutang AP)</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {formatRupiah(totalApBalance)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kewajiban bayar ke <strong className="text-purple-700">{suppliersWithApCount} supplier</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Visualisasi Tren Penjualan Harian 7 Hari Terakhir (Recharts) */}
          <DailySalesTrendCard onNavigate={onNavigate} />

          {/* Laporan & Tren Penjualan Bulanan (Recharts Jangka Panjang) */}
          <MonthlySalesTrendCard onNavigate={onNavigate} />

          {/* Section: PO Menunggu Aksi (Audit #2) */}
          {totalPendingPoCount > 0 && (
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-blue-950">
                      Purchase Order Menunggu Aksi ({totalPendingPoCount} PO)
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-blue-200 text-blue-900">
                      Perlu Tindakan
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    {draftPoCount > 0 && <span><strong>{draftPoCount} PO DRAFT</strong> perlu disetujui (Approval) • </span>}
                    {receivingPoCount > 0 && <span><strong>{receivingPoCount} PO</strong> siap diterima di Gudang (Goods Receipt)</span>}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('beli')}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                <span>Proses di Menu Beli</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section: Stok Menipis (Alert < 5 unit) */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Peringatan Stok Menipis ({lowStockItems.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('stok')}
                  className="text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg font-bold flex items-center gap-1 border border-emerald-200"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  AI Prediksi Stok
                </button>
                <button
                  onClick={() => onNavigate('stok')}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1"
                >
                  Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="py-3 px-3 bg-emerald-50 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Semua persediaan barang berada di atas batas minimum (Aman).</span>
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockItems.map(({ product, totalQty, threshold }) => (
                  <div 
                    key={product.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/70 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{product.name}</p>
                      <p className="text-[11px] text-amber-800">
                        Batas minimum: {threshold} {product.unit} (Harga Jual: {formatRupiah(product.sellPrice)})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 rounded-md font-bold bg-amber-200 text-amber-900 text-xs font-mono">
                        Sisa {totalQty} {product.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Monitoring Piutang Pelanggan & Jatuh Tempo */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Coins className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Monitoring Piutang Pelanggan ({customers.filter(c => c.arBalance > 0).length} Aktif)
                </h3>
              </div>
              <button
                onClick={() => onNavigate('kasir')}
                className="text-xs text-amber-800 hover:text-amber-900 font-semibold flex items-center gap-1"
              >
                Pelunasan di Kasir <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {customers.filter(c => c.arBalance > 0).length === 0 ? (
              <p className="text-xs text-slate-500 py-1">Tidak ada piutang tertunggak. Semua tagihan telah lunas.</p>
            ) : (
              <div className="space-y-2">
                {customers.filter(c => c.arBalance > 0).map(cust => {
                  const usagePercent = cust.creditLimit > 0 
                    ? Math.min(100, Math.round((cust.arBalance / cust.creditLimit) * 100))
                    : 0;
                  const custOverdue = overdueAnalysis.customersWithOverdue.find(o => o.customerId === cust.id);

                  return (
                    <div 
                      key={cust.id}
                      className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/70 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{cust.name}</span>
                          <span className="text-[11px] text-slate-500 ml-2">Tempo {cust.creditTermsDays || 30} Hari</span>
                          {custOverdue && (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200">
                              {custOverdue.count} Lewat Jatuh Tempo
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-amber-900 text-sm font-mono">
                          {formatRupiah(cust.arBalance)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Plafon: {formatRupiah(cust.creditLimit)}</span>
                        <span>Penggunaan Limit: {usagePercent}%</span>
                      </div>

                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${usagePercent >= 90 ? 'bg-red-500' : 'bg-amber-500'}`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => onNavigate('kasir')}
              className="p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex flex-col justify-between text-left transition shadow-xs group"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                <ReceiptText className="w-4 h-4" />
              </div>
              <div className="mt-3">
                <p className="font-bold text-xs sm:text-sm">Buka Kasir</p>
                <p className="text-[10px] text-emerald-100">Katalog & Struk</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('beli')}
              className="p-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex flex-col justify-between text-left transition shadow-xs group"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="mt-3">
                <p className="font-bold text-xs sm:text-sm">Pembelian (PO)</p>
                <p className="text-[10px] text-blue-100">Order & Penerimaan</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('stok')}
              className="p-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white flex flex-col justify-between text-left transition shadow-xs group"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div className="mt-3">
                <p className="font-bold text-xs sm:text-sm">Manajemen Stok</p>
                <p className="text-[10px] text-amber-100">FIFO {inventoryLayers.length} Layers</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('operasional')}
              className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white flex flex-col justify-between text-left transition shadow-xs group"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center">
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3">
                <p className="font-bold text-xs sm:text-sm">Health Check</p>
                <p className="text-[10px] text-slate-300">Diagnostik H1–H6</p>
              </div>
            </button>
          </div>

          {/* Kartu Laporan Estimasi Laba-Rugi (Penjualan Kasir vs Pengeluaran Operasional) */}
          <EstimasiLabaRugiCard onNavigate={onNavigate} />

          {/* Kartu Ringkasan Keuangan: Grafik Batang Arus Kas Mingguan Menggunakan Recharts */}
          <RingkasanKeuanganCard onNavigate={onNavigate} />

          {/* Komponen Laporan Arus Kas Sederhana (Pendapatan Kasir vs Pengeluaran Operasional) */}
          <LaporanArusKasCard onNavigate={onNavigate} />

          {/* Blok Grafik Keuangan Informatif (Donut, Pie & Bar Chart) */}
          <FinancialInsightCharts
            cashBalance={currentCashBalance}
            inventoryValue={totalInventoryValue}
            arBalance={totalArBalance}
            apBalance={totalApBalance}
            cashSalesTotal={cashSalesTotal}
            creditSalesTotal={creditSalesTotal}
            weeklyTrend={weeklyTrend}
          />
        </>
      )}
    </div>
  );
};
