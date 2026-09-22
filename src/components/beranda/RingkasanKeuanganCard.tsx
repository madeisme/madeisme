import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah } from '../../utils/formatters';
import { TabDestination } from '../layout/BottomNav';
import {
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Calendar,
  Wallet,
  Receipt,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';

interface RingkasanKeuanganCardProps {
  onNavigate?: (tab: TabDestination) => void;
}

type ChartDisplayMode = 'arus_kas' | 'omzet_laba';

export const RingkasanKeuanganCard: React.FC<RingkasanKeuanganCardProps> = ({ onNavigate }) => {
  const {
    sales,
    saleLines,
    operationalExpenses,
    arTransactions,
    generalJournals
  } = useAppDatabase();

  const [displayMode, setDisplayMode] = useState<ChartDisplayMode>('arus_kas');
  const [showDailyBreakdown, setShowDailyBreakdown] = useState<boolean>(false);

  // Map HPP (COGS) per Sale dari SaleLine
  const saleLinesHppMap = useMemo(() => {
    const map = new Map<string, number>();
    (saleLines || []).forEach(sl => {
      map.set(sl.saleId, (map.get(sl.saleId) || 0) + (sl.hppLine || 0));
    });
    return map;
  }, [saleLines]);

  // Tanggal acuan hari ini
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter 7 hari terakhir (mingguan)
  const weeklyDays = useMemo(() => {
    const days: {
      dateStr: string;
      dayLabel: string;
      dayFullName: string;
    }[] = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
      const dayFullName = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      days.push({
        dateStr,
        dayLabel,
        dayFullName
      });
    }
    return days;
  }, []);

  // Agregasi data arus kas & pendapatan 7 hari terakhir
  const weeklyData = useMemo(() => {
    const committedSales = (sales || []).filter(s => s.status === 'COMMITTED');

    return weeklyDays.map(({ dateStr, dayLabel, dayFullName }) => {
      // 1. Penjualan Hari Itu
      const daySales = committedSales.filter(s => s.businessDate === dateStr);
      const totalSalesRevenue = daySales.reduce((sum, s) => sum + s.grandTotal, 0);
      const cashSales = daySales
        .filter(s => s.paymentMethod === 'CASH')
        .reduce((sum, s) => sum + s.grandTotal, 0);
      const creditSales = daySales
        .filter(s => s.paymentMethod === 'CREDIT')
        .reduce((sum, s) => sum + s.grandTotal, 0);
      const cogs = daySales.reduce((sum, s) => sum + (saleLinesHppMap.get(s.id) || 0), 0);
      const grossProfit = Math.max(0, totalSalesRevenue - cogs);
      const txCount = daySales.length;

      // 2. Pelunasan Piutang Kasir (AR Settlement)
      const dayArPayments = (arTransactions || []).filter(
        ar => ar.type === 'AR_SETTLE' && ar.createdAt.startsWith(dateStr)
      );
      const arCollected = dayArPayments.reduce((sum, ar) => sum + ar.amount, 0);

      // 3. Kas Masuk Jurnal Umum Non-Kasir (Debit ke Akun 1110 Kas)
      const dayGj = (generalJournals || []).filter(gj => gj.businessDate === dateStr);
      const gjCashIn = dayGj.reduce((sum, gj) => {
        const debitKasLines = gj.lines.filter(l => l.accountCode === '1110' && l.side === 'DEBIT');
        return sum + debitKasLines.reduce((s, l) => s + l.amount, 0);
      }, 0);

      // 4. Kas Keluar Pengeluaran Operasional Langsung
      const dayExpenses = (operationalExpenses || []).filter(e => e.businessDate === dateStr);
      const operationalExp = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

      // 5. Kas Keluar Jurnal Umum Non-Kasir (Kredit ke Akun 1110 Kas: sewa, listrik, dsb)
      const gjCashOut = dayGj.reduce((sum, gj) => {
        const creditKasLines = gj.lines.filter(l => l.accountCode === '1110' && l.side === 'CREDIT');
        return sum + creditKasLines.reduce((s, l) => s + l.amount, 0);
      }, 0);

      // Total Kas Masuk & Kas Keluar Harian
      const totalCashIn = cashSales + arCollected + gjCashIn;
      const totalCashOut = operationalExp + gjCashOut;
      const netCashFlow = totalCashIn - totalCashOut;

      return {
        dateStr,
        dayLabel,
        dayFullName,
        // Metrics Arus Kas
        kasMasuk: totalCashIn,
        kasKeluar: totalCashOut,
        arusKasBersih: netCashFlow,
        // Metrics Penjualan & Margin
        omzetPenjualan: totalSalesRevenue,
        modalBarang: cogs,
        untungKotor: grossProfit,
        // Detail Rincian
        cashSales,
        creditSales,
        arCollected,
        gjCashIn,
        operationalExp,
        gjCashOut,
        txCount
      };
    });
  }, [weeklyDays, sales, arTransactions, generalJournals, operationalExpenses]);

  // Statistik Ringkasan Mingguan (KPI Pemilik Toko)
  const stats = useMemo(() => {
    const totalCashIn = weeklyData.reduce((sum, d) => sum + d.kasMasuk, 0);
    const totalCashOut = weeklyData.reduce((sum, d) => sum + d.kasKeluar, 0);
    const netCashFlow = totalCashIn - totalCashOut;
    const totalRevenue = weeklyData.reduce((sum, d) => sum + d.omzetPenjualan, 0);
    const totalGrossProfit = weeklyData.reduce((sum, d) => sum + d.untungKotor, 0);
    const avgDailyCashIn = Math.round(totalCashIn / 7);
    const totalTx = weeklyData.reduce((sum, d) => sum + d.txCount, 0);

    // Cari hari dengan penjualan/kas masuk tertinggi
    let peakDay = weeklyData[0];
    weeklyData.forEach(d => {
      if (d.kasMasuk > (peakDay?.kasMasuk || 0)) {
        peakDay = d;
      }
    });

    // Rasio Pengeluaran terhadap Kas Masuk
    const expenseRatio = totalCashIn > 0 
      ? Math.round((totalCashOut / totalCashIn) * 100)
      : (totalCashOut > 0 ? 100 : 0);

    return {
      totalCashIn,
      totalCashOut,
      netCashFlow,
      totalRevenue,
      totalGrossProfit,
      avgDailyCashIn,
      totalTx,
      peakDay,
      expenseRatio,
      isSurplus: netCashFlow >= 0
    };
  }, [weeklyData]);

  // Custom Tooltip Recharts untuk Arus Kas & Tren Pendapatan
  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;

      return (
        <div 
          id="tooltip-ringkasan-keuangan"
          className="bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-xl text-xs shadow-xl border border-slate-700 min-w-[220px]"
        >
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2">
            <span className="font-bold text-slate-200">{dataPoint.dayFullName}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
              {dataPoint.txCount} Nota Kasir
            </span>
          </div>

          {displayMode === 'arus_kas' ? (
            <div className="space-y-1.5 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Kas Masuk:
                </span>
                <span className="font-bold text-emerald-400">{formatRupiah(dataPoint.kasMasuk)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-rose-400 flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5" /> Kas Keluar:
                </span>
                <span className="font-bold text-rose-400">-{formatRupiah(dataPoint.kasKeluar)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-300">Arus Kas Bersih:</span>
                <span className={`font-bold ${dataPoint.arusKasBersih >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>
                  {dataPoint.arusKasBersih >= 0 ? '+' : ''}{formatRupiah(dataPoint.arusKasBersih)}
                </span>
              </div>

              {/* Rincian Sumber Kas */}
              <div className="text-[10px] text-slate-400 pt-1 font-sans border-t border-slate-800 space-y-0.5">
                <p>• Tunai Kasir: {formatRupiah(dataPoint.cashSales)}</p>
                {dataPoint.arCollected > 0 && <p>• Pelunasan Piutang: {formatRupiah(dataPoint.arCollected)}</p>}
                {dataPoint.gjCashIn > 0 && <p>• Setoran Non-Kasir: {formatRupiah(dataPoint.gjCashIn)}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400">Omzet Penjualan:</span>
                <span className="font-bold text-emerald-400">{formatRupiah(dataPoint.omzetPenjualan)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-400">Modal Pokok (HPP):</span>
                <span className="font-bold text-amber-400">{formatRupiah(dataPoint.modalBarang)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-teal-300">Untung Penjualan:</span>
                <span className="font-bold text-teal-300">+{formatRupiah(dataPoint.untungKotor)}</span>
              </div>
              <div className="text-[10px] text-slate-400 pt-1 font-sans border-t border-slate-800">
                <span>Tunai: {formatRupiah(dataPoint.cashSales)} • Tempo: {formatRupiah(dataPoint.creditSales)}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      id="card-ringkasan-keuangan"
      className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4"
    >
      {/* Header Kartu Ringkasan Keuangan */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Ringkasan Keuangan
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Mingguan (7 Hari)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualisasi tren arus kas masuk, arus kas keluar, dan laba operasional toko
            </p>
          </div>
        </div>

        {/* Mode Selector Toggle: Arus Kas vs Omzet & Laba */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            id="btn-toggle-arus-kas"
            onClick={() => setDisplayMode('arus_kas')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              displayMode === 'arus_kas'
                ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Arus Kas Mingguan</span>
          </button>

          <button
            id="btn-toggle-omzet-laba"
            onClick={() => setDisplayMode('omzet_laba')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              displayMode === 'omzet_laba'
                ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
            <span>Tren Omzet & Laba</span>
          </button>
        </div>
      </div>

      {/* KPI Highlights Strip (4 Metric Badges) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* 1. Total Kas Masuk / Pendapatan */}
        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
            <span>Total Kas Masuk (7 Hari)</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-emerald-950 font-mono mt-1">
            +{formatRupiah(stats.totalCashIn)}
          </p>
          <p className="text-[10px] text-emerald-700 mt-0.5">
            Rata-rata: <span className="font-semibold">{formatRupiah(stats.avgDailyCashIn)}</span>/hari
          </p>
        </div>

        {/* 2. Total Kas Keluar */}
        <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80">
          <div className="flex items-center justify-between text-xs text-rose-800 font-medium">
            <span>Total Kas Keluar (7 Hari)</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-lg font-bold text-rose-950 font-mono mt-1">
            -{formatRupiah(stats.totalCashOut)}
          </p>
          <p className="text-[10px] text-rose-700 mt-0.5">
            Rasio beban: <span className="font-semibold">{stats.expenseRatio}%</span> dari kas masuk
          </p>
        </div>

        {/* 3. Arus Kas Bersih (Net Cash Flow) */}
        <div className={`p-3 rounded-xl border ${
          stats.isSurplus 
            ? 'bg-teal-50/70 border-teal-200/80 text-teal-950' 
            : 'bg-rose-50/70 border-rose-200/80 text-rose-950'
        }`}>
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={stats.isSurplus ? 'text-teal-800' : 'text-rose-800'}>
              Arus Kas Bersih (Surplus)
            </span>
            <Scale className={`w-3.5 h-3.5 ${stats.isSurplus ? 'text-teal-600' : 'text-rose-600'}`} />
          </div>
          <p className={`text-lg font-bold font-mono mt-1 ${stats.isSurplus ? 'text-teal-900' : 'text-rose-900'}`}>
            {stats.isSurplus ? '+' : ''}{formatRupiah(stats.netCashFlow)}
          </p>
          <p className={`text-[10px] mt-0.5 font-medium ${stats.isSurplus ? 'text-teal-700' : 'text-rose-700'}`}>
            {stats.isSurplus ? 'Kondisi Kas Positif' : 'Perlu Efisiensi Beban'}
          </p>
        </div>

        {/* 4. Puncak Penjualan (Peak Day) */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Puncak Penjualan</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-sm font-bold text-slate-900 mt-1 truncate">
            {stats.peakDay?.dayLabel || '-'}
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {formatRupiah(stats.peakDay?.kasMasuk || 0)} ({stats.peakDay?.txCount || 0} nota)
          </p>
        </div>
      </div>

      {/* Visual Header & Information */}
      <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
          {displayMode === 'arus_kas' ? (
            <>
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Grafik Batang Arus Kas Mingguan (Kas Masuk vs Kas Keluar vs Bersih)</span>
            </>
          ) : (
            <>
              <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
              <span>Grafik Batang Omzet Penjualan vs Modal HPP & Untung Bersih</span>
            </>
          )}
        </span>
        <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
          Satuan: Rupiah (IDR)
        </span>
      </div>

      {/* GRAFIK BATANG RECHARTS */}
      <div id="container-grafik-arus-kas-mingguan" className="h-64 sm:h-72 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={weeklyData}
            margin={{ top: 12, right: 10, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="dayLabel"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(val) => {
                if (Math.abs(val) >= 1000000) {
                  return `${(val / 1000000).toFixed(1)}jt`;
                }
                if (Math.abs(val) >= 1000) {
                  return `${Math.round(val / 1000)}rb`;
                }
                return String(val);
              }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <Tooltip content={renderCustomTooltip} />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => {
                if (value === 'kasMasuk') return <span className="text-xs font-semibold text-slate-700">Kas Masuk (Pendapatan)</span>;
                if (value === 'kasKeluar') return <span className="text-xs font-semibold text-slate-700">Kas Keluar (Beban)</span>;
                if (value === 'arusKasBersih') return <span className="text-xs font-semibold text-slate-700">Arus Kas Bersih</span>;
                if (value === 'omzetPenjualan') return <span className="text-xs font-semibold text-slate-700">Omzet Penjualan</span>;
                if (value === 'modalBarang') return <span className="text-xs font-semibold text-slate-700">Modal Pokok (HPP)</span>;
                if (value === 'untungKotor') return <span className="text-xs font-semibold text-slate-700">Untung Penjualan (Laba)</span>;
                return value;
              }}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />

            {displayMode === 'arus_kas' ? (
              <>
                <Bar
                  dataKey="kasMasuk"
                  name="kasMasuk"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="kasKeluar"
                  name="kasKeluar"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="arusKasBersih"
                  name="arusKasBersih"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </>
            ) : (
              <>
                <Bar
                  dataKey="omzetPenjualan"
                  name="omzetPenjualan"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="modalBarang"
                  name="modalBarang"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="untungKotor"
                  name="untungKotor"
                  fill="#0d9488"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Keterangan & Insight Praktis bagi Pemilik Toko */}
      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <p className="font-semibold text-slate-800">
            {stats.isSurplus 
              ? `Surplus Kas Mingguan: Toko memiliki saldo bersih positif ${formatRupiah(stats.netCashFlow)} selama 7 hari terakhir.`
              : `Defisit Kas Mingguan: Pengeluaran operasional melebihi kas masuk sebesar ${formatRupiah(Math.abs(stats.netCashFlow))}.`
            }
          </p>
          <p className="text-[11px] text-slate-500">
            Kas masuk mencakup penjualan tunai kasir, penerimaan pelunasan piutang pelanggan, dan setoran modal. Kas keluar mencakup biaya operasional rutin toko dan beban non-kasir.
          </p>
        </div>
      </div>

      {/* Toggle Rincian Tabel Harian */}
      <div className="pt-1">
        <button
          id="btn-toggle-breakdown-harian"
          onClick={() => setShowDailyBreakdown(!showDailyBreakdown)}
          className="w-full py-2 px-3 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 text-xs font-bold transition flex items-center justify-between border border-slate-200"
        >
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Lihat Rincian Angka Arus Kas Per Hari (7 Hari)</span>
          </span>
          {showDailyBreakdown ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {showDailyBreakdown && (
          <div 
            id="tabel-rincian-harian"
            className="mt-3 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs"
          >
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Hari & Tanggal</th>
                  <th className="py-2.5 px-3 text-right">Kas Masuk</th>
                  <th className="py-2.5 px-3 text-right">Kas Keluar</th>
                  <th className="py-2.5 px-3 text-right">Arus Kas Bersih</th>
                  <th className="py-2.5 px-3 text-center">Nota Kasir</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {weeklyData.map(d => {
                  const isDayPositive = d.arusKasBersih >= 0;
                  return (
                    <tr key={d.dateStr} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                        {d.dayLabel}
                        {d.dateStr === todayStr && (
                          <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                            Hari Ini
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">
                        +{formatRupiah(d.kasMasuk)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600 font-bold">
                        -{formatRupiah(d.kasKeluar)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isDayPositive ? 'text-teal-700' : 'text-rose-700'}`}>
                        {isDayPositive ? '+' : ''}{formatRupiah(d.arusKasBersih)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-sans">
                        {d.txCount} nota
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isDayPositive 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {isDayPositive ? 'Surplus' : 'Defisit'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-bold font-mono border-t border-slate-200">
                <tr>
                  <td className="py-2.5 px-3 font-sans text-slate-900">Total 7 Hari</td>
                  <td className="py-2.5 px-3 text-right text-emerald-800">
                    +{formatRupiah(stats.totalCashIn)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-800">
                    -{formatRupiah(stats.totalCashOut)}
                  </td>
                  <td className={`py-2.5 px-3 text-right ${stats.isSurplus ? 'text-teal-800' : 'text-rose-800'}`}>
                    {stats.isSurplus ? '+' : ''}{formatRupiah(stats.netCashFlow)}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-800 font-sans">
                    {stats.totalTx} nota
                  </td>
                  <td className="py-2.5 px-3 text-center font-sans">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      stats.isSurplus 
                        ? 'bg-teal-100 text-teal-800 border border-teal-200' 
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {stats.isSurplus ? 'Surplus Total' : 'Defisit Total'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Pintasan Aksi Cepat Finansial */}
      {onNavigate && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              id="btn-shortcut-kasir"
              onClick={() => onNavigate('kasir')}
              className="py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition flex items-center gap-1"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Buka Kasir</span>
            </button>

            <button
              id="btn-shortcut-operasional"
              onClick={() => onNavigate('operasional')}
              className="py-1.5 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold border border-rose-200 transition flex items-center gap-1"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Catat Beban Operasional</span>
            </button>
          </div>

          <button
            id="btn-shortcut-laporan"
            onClick={() => onNavigate('operasional')}
            className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 transition"
          >
            <span>Audit Forensik A–Z</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
