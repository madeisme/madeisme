import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah } from '../../utils/formatters';
import { TabDestination } from '../layout/BottomNav';
import { exportMonthlySalesToPdf } from '../../utils/monthlySalesPdfExport';
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Receipt,
  Sparkles,
  BarChart3,
  Calendar,
  Layers,
  ArrowRight,
  Percent,
  CheckCircle2,
  ChevronRight,
  Filter,
  Printer,
  Download,
  FileSpreadsheet
} from 'lucide-react';

interface MonthlySalesTrendCardProps {
  onNavigate?: (tab: TabDestination) => void;
}

type MonthlyChartType = 'bar' | 'area' | 'line';
type RangeOption = 6 | 12; // 6 bulan terakhir atau 12 bulan terakhir

export const MonthlySalesTrendCard: React.FC<MonthlySalesTrendCardProps> = ({ onNavigate }) => {
  const { sales, saleLines, store, currentUser } = useAppDatabase();
  const [chartType, setChartType] = useState<MonthlyChartType>('bar');
  const [rangeMonths, setRangeMonths] = useState<RangeOption>(6);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Pre-calculate HPP/COGS per saleId
  const saleHppMap = useMemo(() => {
    const map = new Map<string, number>();
    (saleLines || []).forEach(sl => {
      map.set(sl.saleId, (map.get(sl.saleId) || 0) + (sl.hppLine || 0));
    });
    return map;
  }, [saleLines]);

  // Aggregate monthly data for last N months
  const monthlyData = useMemo(() => {
    const committed = (sales || []).filter(s => s.status === 'COMMITTED');
    const result: {
      monthKey: string; // YYYY-MM
      monthLabel: string; // e.g. "Apr 2026"
      monthFullName: string; // e.g. "April 2026"
      totalSales: number;
      cashSales: number;
      creditSales: number;
      cogs: number;
      grossProfit: number;
      profitMargin: number;
      txCount: number;
      avgTicket: number;
    }[] = [];

    const now = new Date();
    for (let i = rangeMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${yyyy}-${mm}`;
      const monthLabel = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      const monthFullName = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

      // Filter sales committed in this month (businessDate starts with YYYY-MM)
      const monthSales = committed.filter(s => s.businessDate && s.businessDate.startsWith(monthKey));
      const totalSales = monthSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
      const cashSales = monthSales
        .filter(s => s.paymentMethod === 'CASH')
        .reduce((sum, s) => sum + (s.grandTotal || 0), 0);
      const creditSales = monthSales
        .filter(s => s.paymentMethod === 'CREDIT')
        .reduce((sum, s) => sum + (s.grandTotal || 0), 0);

      const cogs = monthSales.reduce((sum, s) => sum + (saleHppMap.get(s.id) || 0), 0);
      const grossProfit = Math.max(0, totalSales - cogs);
      const profitMargin = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;
      const txCount = monthSales.length;
      const avgTicket = txCount > 0 ? Math.round(totalSales / txCount) : 0;

      result.push({
        monthKey,
        monthLabel,
        monthFullName,
        totalSales,
        cashSales,
        creditSales,
        cogs,
        grossProfit,
        profitMargin,
        txCount,
        avgTicket
      });
    }

    return result;
  }, [sales, saleHppMap, rangeMonths]);

  // Aggregate KPI stats over the period
  const stats = useMemo(() => {
    const totalSalesPeriod = monthlyData.reduce((sum, m) => sum + m.totalSales, 0);
    const totalProfitPeriod = monthlyData.reduce((sum, m) => sum + m.grossProfit, 0);
    const totalTxPeriod = monthlyData.reduce((sum, m) => sum + m.txCount, 0);
    const avgMonthlySales = Math.round(totalSalesPeriod / monthlyData.length);
    const overallMargin = totalSalesPeriod > 0 ? Math.round((totalProfitPeriod / totalSalesPeriod) * 100) : 0;

    // Highest revenue month
    let peakMonth = monthlyData[0];
    monthlyData.forEach(m => {
      if (m.totalSales > (peakMonth?.totalSales || 0)) {
        peakMonth = m;
      }
    });

    // Month-over-Month (MoM) Growth: current month vs previous month
    const len = monthlyData.length;
    const currentMonth = monthlyData[len - 1];
    const prevMonth = len >= 2 ? monthlyData[len - 2] : null;
    let momGrowthPercent = 0;
    if (prevMonth && prevMonth.totalSales > 0) {
      momGrowthPercent = Math.round(((currentMonth.totalSales - prevMonth.totalSales) / prevMonth.totalSales) * 100);
    } else if (currentMonth.totalSales > 0) {
      momGrowthPercent = 100;
    }

    return {
      totalSalesPeriod,
      totalProfitPeriod,
      totalTxPeriod,
      avgMonthlySales,
      overallMargin,
      peakMonth,
      currentMonth,
      prevMonth,
      momGrowthPercent,
      isGrowing: momGrowthPercent >= 0
    };
  }, [monthlyData]);

  // Current selected month details (or default to current month)
  const activeMonthDetail = useMemo(() => {
    if (selectedMonthKey) {
      const found = monthlyData.find(m => m.monthKey === selectedMonthKey);
      if (found) return found;
    }
    return monthlyData[monthlyData.length - 1];
  }, [selectedMonthKey, monthlyData]);

  // Handler for Exporting Monthly Sales to PDF
  const handleExportPdf = () => {
    setIsExporting(true);
    try {
      exportMonthlySalesToPdf({
        storeName: store?.name || 'OMAH SEMBAKO SEHATI',
        storeAddress: store?.address || 'Pusat Distribusi & Grosir Sembako Sehati',
        storePhone: store?.phone || 'Telp/WA: 0812-3456-7890',
        rangeMonths,
        printedBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Owner',
        monthlyData,
        stats
      });
    } finally {
      setTimeout(() => setIsExporting(false), 500);
    }
  };

  // Custom Tooltip for Recharts
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-xs text-white p-3.5 rounded-xl text-xs shadow-xl border border-slate-700 min-w-[230px] space-y-2 font-sans">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
            <span className="font-bold text-slate-100 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              {data.monthFullName}
            </span>
            <span className="text-[10px] bg-teal-950 text-teal-300 font-mono px-1.5 py-0.5 rounded border border-teal-800">
              {data.txCount} Transaksi
            </span>
          </div>

          <div className="space-y-1 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-sans">Omzet Penjualan:</span>
              <span className="font-bold text-emerald-400 text-sm">{formatRupiah(data.totalSales)}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="text-slate-400 font-sans">• Tunai (Kas):</span>
              <span>{formatRupiah(data.cashSales)}</span>
            </div>

            {data.creditSales > 0 && (
              <div className="flex items-center justify-between text-[11px] text-purple-300">
                <span className="text-slate-400 font-sans">• Tempo (Piutang):</span>
                <span>{formatRupiah(data.creditSales)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-amber-300">
              <span className="text-slate-400 font-sans">Modal Pokok (HPP):</span>
              <span>{formatRupiah(data.cogs)}</span>
            </div>

            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-teal-300 font-sans">Untung Bersih (Laba):</span>
              <span className="font-bold text-teal-300">
                {formatRupiah(data.grossProfit)} ({data.profitMargin}%)
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <CalendarDays className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              Laporan Penjualan Bulanan
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                Tren Jangka Panjang
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Analisis performa omzet toko, margin laba kotor, dan komparasi bulanan
            </p>
          </div>
        </div>

        {/* Action Controls: Rentang Bulan (6/12) & Tipe Chart */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Rentang Bulan */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setRangeMonths(6)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                rangeMonths === 6
                  ? 'bg-white text-teal-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              6 Bulan
            </button>
            <button
              onClick={() => setRangeMonths(12)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                rangeMonths === 12
                  ? 'bg-white text-teal-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              12 Bulan
            </button>
          </div>

          {/* Tipe Grafik */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setChartType('bar')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                chartType === 'bar'
                  ? 'bg-white text-teal-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Grafik Batang Komparatif"
            >
              Batang
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                chartType === 'area'
                  ? 'bg-white text-teal-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Grafik Area Berkelanjutan"
            >
              Area
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                chartType === 'line'
                  ? 'bg-white text-teal-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Grafik Garis Tren"
            >
              Garis
            </button>
          </div>

          {/* Tombol Ekspor PDF / Cetak Laporan */}
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Cetak atau simpan Laporan Penjualan Bulanan ke format PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Menyiapkan...' : 'Cetak / Ekspor PDF'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Ringkasan Periode Bulanan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">
            Total Omzet ({rangeMonths} Bulan)
          </span>
          <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5">
            {formatRupiah(stats.totalSalesPeriod)}
          </p>
          <span className="text-[10px] text-slate-500">
            {stats.totalTxPeriod} transaksi dicatat
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">Rata-rata Penjualan / Bulan</span>
          <p className="text-base sm:text-lg font-bold text-teal-700 font-mono mt-0.5">
            {formatRupiah(stats.avgMonthlySales)}
          </p>
          <span className="text-[10px] text-slate-500">
            Tolok ukur target bulanan
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">Bulan Puncak (Tertinggi)</span>
          <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5">
            {formatRupiah(stats.peakMonth?.totalSales || 0)}
          </p>
          <span className="text-[10px] text-teal-700 font-semibold truncate block">
            {stats.peakMonth?.monthFullName || '-'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">MoM (Bulan Ini vs Lalu)</span>
          <div className="flex items-center gap-1 mt-0.5">
            {stats.isGrowing ? (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 font-mono">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                +{stats.momGrowthPercent}%
              </span>
            ) : (
              <span className="text-xs font-bold text-rose-600 flex items-center gap-1 font-mono">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                {stats.momGrowthPercent}%
              </span>
            )}
            <span className="text-[10px] text-slate-500 ml-1">
              ({stats.overallMargin}% margin laba)
            </span>
          </div>
          <span className="text-[10px] text-slate-500 truncate block">
            {stats.isGrowing ? 'Pertumbuhan omzet positif' : 'Perlu evaluasi strategi penjualan'}
          </span>
        </div>
      </div>

      {/* Main Recharts Visualization for Monthly Trend */}
      <div className="pt-2">
        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart
                data={monthlyData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    setSelectedMonthKey(e.activePayload[0].payload.monthKey);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `${val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : `${Math.round(val / 1000)}rb`}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={renderCustomTooltip} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(val) => (
                    <span className="text-xs font-semibold text-slate-700">
                      {val === 'cashSales'
                        ? 'Tunai Kasir'
                        : val === 'creditSales'
                        ? 'Tempo / Piutang'
                        : 'Untung Bersih (Laba)'}
                    </span>
                  )}
                />
                <Bar dataKey="cashSales" name="cashSales" stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]} />
                <Bar dataKey="creditSales" name="creditSales" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="grossProfit" name="grossProfit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chartType === 'area' ? (
              <AreaChart
                data={monthlyData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="colorMonthSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorMonthProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `${val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : `${Math.round(val / 1000)}rb`}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={renderCustomTooltip} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(val) => (
                    <span className="text-xs font-semibold text-slate-700">
                      {val === 'totalSales' ? 'Total Penjualan Bulanan' : 'Untung Bersih (Laba)'}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="totalSales"
                  name="totalSales"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorMonthSales)"
                  activeDot={{ r: 6, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="grossProfit"
                  name="grossProfit"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#colorMonthProfit)"
                />
              </AreaChart>
            ) : (
              <LineChart
                data={monthlyData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `${val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : `${Math.round(val / 1000)}rb`}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={renderCustomTooltip} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(val) => (
                    <span className="text-xs font-semibold text-slate-700">
                      {val === 'totalSales' ? 'Total Penjualan Bulanan' : 'Untung Bersih (Laba)'}
                    </span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="totalSales"
                  name="totalSales"
                  stroke="#0d9488"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0d9488' }}
                  activeDot={{ r: 7, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="grossProfit"
                  name="grossProfit"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#10b981' }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rincian Komparasi Per Bulan (Tabel Mini Interaktif) */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            Rincian Kinerja Per Bulan
          </span>
          <span className="text-[11px] text-slate-500">
            Klik kolom grafik atau baris tabel untuk meninjau detail
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 font-semibold">Periode Bulan</th>
                <th className="py-2 px-3 font-semibold text-right">Omzet Total</th>
                <th className="py-2 px-3 font-semibold text-right">Tunai Kasir</th>
                <th className="py-2 px-3 font-semibold text-right">Tempo / Piutang</th>
                <th className="py-2 px-3 font-semibold text-right">Untung Laba Kotor</th>
                <th className="py-2 px-3 font-semibold text-right">Margin (%)</th>
                <th className="py-2 px-3 font-semibold text-center">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyData.map((m) => {
                const isSelected = activeMonthDetail?.monthKey === m.monthKey;
                return (
                  <tr
                    key={m.monthKey}
                    onClick={() => setSelectedMonthKey(m.monthKey)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? 'bg-teal-50/70 font-semibold text-teal-950'
                        : 'hover:bg-slate-50/70 text-slate-700'
                    }`}
                  >
                    <td className="py-2 px-3 flex items-center gap-1.5 font-medium">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>}
                      {m.monthFullName}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(m.totalSales)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">
                      {formatRupiah(m.cashSales)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-purple-700">
                      {formatRupiah(m.creditSales)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-teal-800">
                      {formatRupiah(m.grossProfit)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                        {m.profitMargin}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-500">
                      {m.txCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer & Navigasi ke Pusat Laporan Keuangan */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className="text-slate-500 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          Data otomatis diagregasikan dari seluruh transaksi penjualan yang telah committed.
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-teal-50 transition border border-teal-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor PDF ({rangeMonths} Bulan)</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('operasional')}
              className="text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1 transition"
            >
              <span>Buka Laporan Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
