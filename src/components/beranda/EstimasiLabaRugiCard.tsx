import React, { useState, useMemo } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { TabDestination } from '../layout/BottomNav';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight, 
  ArrowUpRight, 
  ArrowDownRight, 
  Receipt, 
  Wallet, 
  PieChart, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  FileText, 
  Percent, 
  AlertCircle,
  PlusCircle,
  Building2,
  CheckCircle2
} from 'lucide-react';

interface EstimasiLabaRugiCardProps {
  onNavigate?: (tab: TabDestination) => void;
}

type PeriodFilter = 'hari_ini' | '7_hari' | 'bulan_ini' | 'semua';

export const EstimasiLabaRugiCard: React.FC<EstimasiLabaRugiCardProps> = ({ onNavigate }) => {
  const { sales, saleLines, operationalExpenses, generalJournals } = useAppDatabase();

  const [period, setPeriod] = useState<PeriodFilter>('7_hari');
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const [showFormulaExplanation, setShowFormulaExplanation] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Rentang tanggal filter
  const dateRange = useMemo(() => {
    const today = new Date();
    if (period === 'hari_ini') {
      return { start: todayStr, end: todayStr, label: 'Hari Ini' };
    }
    if (period === '7_hari') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { start: d.toISOString().split('T')[0], end: todayStr, label: '7 Hari Terakhir' };
    }
    if (period === 'bulan_ini') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      return { start: `${y}-${m}-01`, end: todayStr, label: 'Bulan Ini' };
    }
    return { start: '1970-01-01', end: '2099-12-31', label: 'Semua Periode' };
  }, [period, todayStr]);

  // 1. FILTER PENJUALAN KASIR
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (s.status !== 'COMMITTED') return false;
      return s.businessDate >= dateRange.start && s.businessDate <= dateRange.end;
    });
  }, [sales, dateRange]);

  // Total Penjualan Kasir (Tunai + Kredit)
  const salesSummary = useMemo(() => {
    let cashSales = 0;
    let creditSales = 0;
    const saleIds = new Set<string>();

    filteredSales.forEach(s => {
      saleIds.add(s.id);
      if (s.paymentMethod === 'CASH') {
        cashSales += s.grandTotal;
      } else {
        creditSales += s.grandTotal;
      }
    });

    const totalSales = cashSales + creditSales;

    // Hitung HPP (Modal Pokok Barang Terjual)
    let totalHpp = 0;
    saleLines.forEach(line => {
      if (saleIds.has(line.saleId)) {
        totalHpp += (line.hppLine || 0);
      }
    });

    return {
      cashSales,
      creditSales,
      totalSales,
      totalHpp,
      salesCount: filteredSales.length
    };
  }, [filteredSales, saleLines]);

  // 2. FILTER PENGELUARAN OPERASIONAL TOKO
  const filteredOperationalExpenses = useMemo(() => {
    return operationalExpenses.filter(exp => {
      return exp.businessDate >= dateRange.start && exp.businessDate <= dateRange.end;
    });
  }, [operationalExpenses, dateRange]);

  // Beban operasional dari Jurnal Umum Non-Kasir
  const filteredGeneralJournalExpenses = useMemo(() => {
    return generalJournals.filter(gj => {
      const isExpenseCategory = 
        gj.category === 'BEBAN_LISTRIK' || 
        gj.category === 'BEBAN_SEWA' || 
        gj.category === 'BEBAN_OPERASIONAL';
      return isExpenseCategory && gj.businessDate >= dateRange.start && gj.businessDate <= dateRange.end;
    });
  }, [generalJournals, dateRange]);

  // Total Pengeluaran Operasional & Rincian Kategori
  const expenseSummary = useMemo(() => {
    let directExpenseTotal = 0;
    const categoryMap: Record<string, number> = {};

    // Dari tabel operationalExpenses
    filteredOperationalExpenses.forEach(exp => {
      directExpenseTotal += exp.amount;
      const cat = exp.category || 'Operasional Lainnya';
      categoryMap[cat] = (categoryMap[cat] || 0) + exp.amount;
    });

    // Dari tabel generalJournals kategori beban
    let journalExpenseTotal = 0;
    filteredGeneralJournalExpenses.forEach(gj => {
      journalExpenseTotal += gj.totalAmount;
      const cat = gj.category === 'BEBAN_LISTRIK' 
        ? 'Beban Listrik & Utilitas (Jurnal)'
        : gj.category === 'BEBAN_SEWA'
          ? 'Beban Sewa Gedung/Tempat (Jurnal)'
          : 'Beban Operasional Umum (Jurnal)';
      categoryMap[cat] = (categoryMap[cat] || 0) + gj.totalAmount;
    });

    const totalExpenses = directExpenseTotal + journalExpenseTotal;
    const totalTransactions = filteredOperationalExpenses.length + filteredGeneralJournalExpenses.length;

    // Urutkan kategori terbesar
    const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

    return {
      directExpenseTotal,
      journalExpenseTotal,
      totalExpenses,
      totalTransactions,
      categories: sortedCategories
    };
  }, [filteredOperationalExpenses, filteredGeneralJournalExpenses]);

  // 3. KALKULASI SELISIH OTOMATIS (ESTIMASI LABA-RUGI)
  const calculations = useMemo(() => {
    const totalSales = salesSummary.totalSales;
    const totalExpenses = expenseSummary.totalExpenses;
    const totalHpp = salesSummary.totalHpp;

    // Sesuai permintaan spesifik pengguna: "selisih total penjualan kasir dengan total pengeluaran operasional"
    const selisihOperasional = totalSales - totalExpenses;

    // Laba Kotor (Gross Profit) = Penjualan - HPP
    const labaKotor = totalSales - totalHpp;

    // Estimasi Laba Bersih Usaha (Net Profit) = Laba Kotor - Beban Operasional
    const estimasiLabaBersih = labaKotor - totalExpenses;

    // Rasio Efisiensi Pengeluaran terhadap Penjualan
    const expenseRatio = totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0;

    // Margin Selisih Operasional
    const selisihMargin = totalSales > 0 ? (selisihOperasional / totalSales) * 100 : 0;

    // Margin Laba Bersih
    const netMargin = totalSales > 0 ? (estimasiLabaBersih / totalSales) * 100 : 0;

    return {
      selisihOperasional,
      labaKotor,
      estimasiLabaBersih,
      expenseRatio,
      selisihMargin,
      netMargin,
      isSurplus: selisihOperasional >= 0,
      isNetProfit: estimasiLabaBersih >= 0
    };
  }, [salesSummary, expenseSummary]);

  return (
    <div 
      id="card-estimasi-laba-rugi"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
    >
      {/* Header Kartu */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <Calculator className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                Estimasi Laba-Rugi
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Kalkulasi Otomatis
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Selisih otomatis antara total penjualan kasir dengan total pengeluaran operasional toko
            </p>
          </div>
        </div>

        {/* Filter Periode */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start md:self-auto text-xs">
          <button
            id="btn-laba-rugi-hari-ini"
            onClick={() => setPeriod('hari_ini')}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              period === 'hari_ini'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hari Ini
          </button>
          <button
            id="btn-laba-rugi-7-hari"
            onClick={() => setPeriod('7_hari')}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              period === '7_hari'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 Hari
          </button>
          <button
            id="btn-laba-rugi-bulan-ini"
            onClick={() => setPeriod('bulan_ini')}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              period === 'bulan_ini'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bulan Ini
          </button>
          <button
            id="btn-laba-rugi-semua"
            onClick={() => setPeriod('semua')}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              period === 'semua'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua
          </button>
        </div>
      </div>

      {/* Konten Utama */}
      <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
        
        {/* HERO CARD: HASIL SELISIH OTOMATIS (PENJUALAN KASIR - PENGELUARAN OPERASIONAL) */}
        <div 
          id="hero-selisih-result"
          className={`p-4 sm:p-5 rounded-xl border transition ${
            calculations.isSurplus 
              ? 'bg-emerald-50/70 border-emerald-200' 
              : 'bg-rose-50/70 border-rose-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  calculations.isSurplus
                    ? 'bg-emerald-200/80 text-emerald-900'
                    : 'bg-rose-200/80 text-rose-900'
                }`}>
                  {calculations.isSurplus ? 'Surplus Operasional' : 'Defisit Operasional'}
                </span>
                <span className="text-xs text-slate-500">
                  Periode: <strong className="text-slate-800 font-semibold">{dateRange.label}</strong>
                </span>
              </div>

              <div className="flex items-baseline gap-2 pt-1">
                <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                  calculations.isSurplus ? 'text-emerald-900' : 'text-rose-900'
                }`}>
                  {formatRupiah(calculations.selisihOperasional)}
                </div>
                <div className={`text-xs font-bold flex items-center gap-0.5 ${
                  calculations.isSurplus ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {calculations.isSurplus ? (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      <span>+{calculations.selisihMargin.toFixed(1)}%</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4" />
                      <span>{calculations.selisihMargin.toFixed(1)}%</span>
                    </>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-600">
                {calculations.isSurplus 
                  ? 'Total penjualan kasir melampaui seluruh beban pengeluaran operasional toko.' 
                  : 'Total pengeluaran operasional melebihi hasil penjualan kasir pada periode ini.'}
              </p>
            </div>

            {/* Metrik Pendukung: Estimasi Laba Bersih Setelah HPP */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs sm:text-right min-w-[210px]">
              <div className="text-[11px] text-slate-500 font-medium">Estimasi Laba Bersih (Setelah HPP):</div>
              <div className={`text-lg font-bold font-mono ${
                calculations.isNetProfit ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {formatRupiah(calculations.estimasiLabaBersih)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Margin Bersih: <strong>{calculations.netMargin.toFixed(1)}%</strong> dari Omzet
              </div>
            </div>
          </div>
        </div>

        {/* 3 PILAR METRIK: PENJUALAN KASIR VS PENGELUARAN OPERASIONAL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          
          {/* Kolom 1: Total Penjualan Kasir */}
          <div 
            id="stat-penjualan-kasir"
            className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  Total Penjualan Kasir
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {salesSummary.salesCount} Transaksi
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-2">
                {formatRupiah(salesSummary.totalSales)}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Penjualan Tunai:</span>
                <strong className="text-slate-800 font-mono">{formatRupiah(salesSummary.cashSales)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Penjualan Tempo/Kredit:</span>
                <strong className="text-slate-800 font-mono">{formatRupiah(salesSummary.creditSales)}</strong>
              </div>
            </div>
          </div>

          {/* Kolom 2: Total Pengeluaran Operasional */}
          <div 
            id="stat-pengeluaran-operasional"
            className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-rose-600" />
                  Pengeluaran Operasional
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  {expenseSummary.totalTransactions} Catatan
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-black text-rose-700 font-mono mt-2">
                {formatRupiah(expenseSummary.totalExpenses)}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Beban Operasional Langsung:</span>
                <strong className="text-slate-800 font-mono">{formatRupiah(expenseSummary.directExpenseTotal)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Beban Jurnal Umum:</span>
                <strong className="text-slate-800 font-mono">{formatRupiah(expenseSummary.journalExpenseTotal)}</strong>
              </div>
            </div>
          </div>

          {/* Kolom 3: Rasio & Efisiensi Operasional */}
          <div 
            id="stat-efisiensi-operasional"
            className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-indigo-600" />
                  Rasio Beban Operasional
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  calculations.expenseRatio < 30 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : calculations.expenseRatio < 60 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-rose-100 text-rose-800'
                }`}>
                  {calculations.expenseRatio < 30 ? 'Efisien' : calculations.expenseRatio < 60 ? 'Moderat' : 'Tinggi'}
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-2">
                {calculations.expenseRatio.toFixed(1)}%
              </div>
            </div>

            {/* Progress Bar Beban vs Penjualan */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1.5">
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    calculations.expenseRatio < 30 
                      ? 'bg-emerald-500' 
                      : calculations.expenseRatio < 60 
                        ? 'bg-amber-500' 
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, calculations.expenseRatio))}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                Porsi beban operasional dari tiap rupiah penjualan kasir
              </div>
            </div>
          </div>

        </div>

        {/* FORMULA TRANSPARAN (DIAGRAM RUMUS SELISIH) */}
        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/70 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-800 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-slate-600" />
              <span>Rumus Perhitungan Otomatis:</span>
            </div>
            <button
              id="btn-toggle-formula-explanation"
              onClick={() => setShowFormulaExplanation(prev => !prev)}
              className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 text-[11px]"
            >
              <span>{showFormulaExplanation ? 'Sembunyikan Rincian' : 'Penjelasan Akuntansi'}</span>
              {showFormulaExplanation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:gap-3 font-mono text-xs">
            <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-800 font-bold">
              Penjualan Kasir: <span className="text-emerald-700">{formatRupiah(salesSummary.totalSales)}</span>
            </div>
            <span className="text-slate-400 font-bold font-sans text-base">−</span>
            <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-800 font-bold">
              Beban Operasional: <span className="text-rose-700">{formatRupiah(expenseSummary.totalExpenses)}</span>
            </div>
            <span className="text-slate-400 font-bold font-sans text-base">=</span>
            <div className={`px-2.5 py-1.5 rounded-lg border font-bold ${
              calculations.isSurplus 
                ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900' 
                : 'bg-rose-100/70 border-rose-300 text-rose-900'
            }`}>
              Selisih Operasional: {formatRupiah(calculations.selisihOperasional)}
            </div>
          </div>

          {showFormulaExplanation && (
            <div className="mt-3 pt-3 border-t border-slate-200/80 text-slate-600 space-y-2 text-[11px] font-sans">
              <p>
                <strong>1. Selisih Penjualan Kasir vs Pengeluaran Operasional:</strong> Mengukur kapasitas omzet kasir untuk menutup seluruh biaya rutin operasional toko (seperti listrik, air, sewa, bensin, perlengkapan, dan administrasi).
              </p>
              <p>
                <strong>2. Estimasi Laba Bersih (Net Profit):</strong> Menghitung keuntungan murni setelah memperhitungkan modal pokok barang dagangan (HPP FIFO sebesar <span className="font-mono font-bold text-slate-800">{formatRupiah(salesSummary.totalHpp)}</span>).
              </p>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700 space-y-1 font-mono text-[10px]">
                <div>• Omzet Penjualan Kasir: {formatRupiah(salesSummary.totalSales)}</div>
                <div>• Dikurangi HPP (Modal Barang): -{formatRupiah(salesSummary.totalHpp)}</div>
                <div className="font-bold text-slate-900">• = Laba Kotor Toko: {formatRupiah(calculations.labaKotor)}</div>
                <div>• Dikurangi Beban Operasional: -{formatRupiah(expenseSummary.totalExpenses)}</div>
                <div className={`font-bold ${calculations.isNetProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                  • = Estimasi Laba Bersih Toko: {formatRupiah(calculations.estimasiLabaBersih)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ACCORDION RINCIAN PENGELUARAN OPERASIONAL */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            id="btn-toggle-expense-details"
            onClick={() => setShowExpenseDetails(prev => !prev)}
            className="w-full p-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-800 transition text-left"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Rincian Pos Pengeluaran Operasional Periode Ini ({expenseSummary.categories.length} Kategori)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <span>{showExpenseDetails ? 'Tutup' : 'Buka Rincian'}</span>
              {showExpenseDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showExpenseDetails && (
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 space-y-3">
              {expenseSummary.categories.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500">Breakdown Kategori Pengeluaran:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {expenseSummary.categories.map(([category, amount]) => {
                      const pct = expenseSummary.totalExpenses > 0 
                        ? ((amount / expenseSummary.totalExpenses) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <div 
                          key={category}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 block">{category}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{pct}% dari total beban</span>
                          </div>
                          <span className="font-mono font-bold text-rose-700">{formatRupiah(amount)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Transaksi Beban Terakhir */}
                  <div className="pt-2">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Catatan Pengeluaran Terkini:</div>
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                      {filteredOperationalExpenses.map(exp => (
                        <div key={exp.id} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-semibold text-slate-800">{exp.notes || exp.category}</div>
                            <div className="text-[10px] text-slate-400">
                              {formatDateIndo(exp.businessDate)} • {exp.category} • oleh {exp.createdByName}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-rose-700">{formatRupiah(exp.amount)}</span>
                        </div>
                      ))}
                      {filteredGeneralJournalExpenses.map(gj => (
                        <div key={gj.id} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-semibold text-slate-800">{gj.description}</div>
                            <div className="text-[10px] text-slate-400">
                              {formatDateIndo(gj.businessDate)} • Jurnal Umum • oleh {gj.createdByName}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-rose-700">{formatRupiah(gj.totalAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-400">
                  Belum ada pengeluaran operasional yang dicatat pada rentang waktu ini.
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER AKSI CEPAT */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Angka diperbarui otomatis setiap kali ada transaksi kasir atau pencatatan beban baru.</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onNavigate && (
              <>
                <button
                  id="btn-nav-kasir-from-laba-rugi"
                  onClick={() => onNavigate('kasir')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center gap-1 shadow-2xs text-xs"
                >
                  <Receipt className="w-3.5 h-3.5 text-slate-600" />
                  <span>Ke Kasir</span>
                </button>
                <button
                  id="btn-nav-operasional-from-laba-rugi"
                  onClick={() => onNavigate('operasional')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition flex items-center gap-1 shadow-2xs text-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Catat Beban Operasional</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
