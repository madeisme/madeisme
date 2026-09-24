import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  ReceiptText,
  ShoppingBag,
  ArrowUpRight,
  Sparkles,
  BarChart2,
  LineChart as LineIcon
} from 'lucide-react';

interface DailySalesTrendCardProps {
  onNavigate?: (tab: TabDestination) => void;
}

type ChartType = 'area' | 'bar' | 'line';

export const DailySalesTrendCard: React.FC<DailySalesTrendCardProps> = ({ onNavigate }) => {
  const { sales, saleLines } = useAppDatabase();
  const [chartType, setChartType] = useState<ChartType>('area');

  // Pre-calculate HPP / COGS per saleId
  const saleHppMap = useMemo(() => {
    const map = new Map<string, number>();
    (saleLines || []).forEach(sl => {
      map.set(sl.saleId, (map.get(sl.saleId) || 0) + (sl.hppLine || 0));
    });
    return map;
  }, [saleLines]);

  // Generate 7 days series ending today
  const trendData = useMemo(() => {
    const committed = (sales || []).filter(s => s.status === 'COMMITTED');
    const result: {
      dateStr: string;
      dayLabel: string;
      dayFullDate: string;
      totalSales: number;
      cashSales: number;
      creditSales: number;
      cogs: number;
      grossProfit: number;
      txCount: number;
      itemsCount: number;
    }[] = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
      const dayFullDate = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      const daySales = committed.filter(s => s.businessDate === dateStr);
      const totalSales = daySales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
      const cashSales = daySales
        .filter(s => s.paymentMethod === 'CASH')
        .reduce((sum, s) => sum + (s.grandTotal || 0), 0);
      const creditSales = daySales
        .filter(s => s.paymentMethod === 'CREDIT')
        .reduce((sum, s) => sum + (s.grandTotal || 0), 0);
      
      const cogs = daySales.reduce((sum, s) => sum + (saleHppMap.get(s.id) || 0), 0);
      const grossProfit = Math.max(0, totalSales - cogs);
      const txCount = daySales.length;
      const itemsCount = (saleLines || [])
        .filter(sl => daySales.some(s => s.id === sl.saleId))
        .reduce((sum, sl) => sum + sl.qty, 0);

      result.push({
        dateStr,
        dayLabel,
        dayFullDate,
        totalSales,
        cashSales,
        creditSales,
        cogs,
        grossProfit,
        txCount,
        itemsCount
      });
    }

    return result;
  }, [sales, saleHppMap]);

  // Aggregate stats over the 7-day period
  const stats = useMemo(() => {
    const total7DaysSales = trendData.reduce((sum, d) => sum + d.totalSales, 0);
    const total7DaysProfit = trendData.reduce((sum, d) => sum + d.grossProfit, 0);
    const total7DaysTx = trendData.reduce((sum, d) => sum + d.txCount, 0);
    const avgDailySales = Math.round(total7DaysSales / 7);

    // Peak day
    let peakDay = trendData[0];
    trendData.forEach(d => {
      if (d.totalSales > (peakDay?.totalSales || 0)) {
        peakDay = d;
      }
    });

    // Trend comparison: compare first 3 days vs last 3 days
    const first3DaysAvg = (trendData[0].totalSales + trendData[1].totalSales + trendData[2].totalSales) / 3;
    const last3DaysAvg = (trendData[4].totalSales + trendData[5].totalSales + trendData[6].totalSales) / 3;
    const trendGrowthPercent = first3DaysAvg > 0 
      ? Math.round(((last3DaysAvg - first3DaysAvg) / first3DaysAvg) * 100)
      : (last3DaysAvg > 0 ? 100 : 0);

    return {
      total7DaysSales,
      total7DaysProfit,
      total7DaysTx,
      avgDailySales,
      peakDay,
      trendGrowthPercent,
      isGrowing: trendGrowthPercent >= 0
    };
  }, [trendData]);

  // Custom Tooltip for Recharts
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-xs text-white p-3.5 rounded-xl text-xs shadow-xl border border-slate-700 min-w-[210px] space-y-1.5 font-sans">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5 mb-1.5">
            <span className="font-bold text-slate-100">{data.dayFullDate}</span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 font-mono px-1.5 py-0.5 rounded border border-emerald-800">
              {data.txCount} Struk
            </span>
          </div>

          <div className="flex items-center justify-between font-mono">
            <span className="text-emerald-400 font-sans">Omzet Penjualan:</span>
            <span className="font-bold text-emerald-400 text-sm">{formatRupiah(data.totalSales)}</span>
          </div>

          <div className="flex items-center justify-between font-mono text-[11px] text-slate-300">
            <span className="text-slate-400 font-sans">• Penjualan Tunai:</span>
            <span>{formatRupiah(data.cashSales)}</span>
          </div>

          {data.creditSales > 0 && (
            <div className="flex items-center justify-between font-mono text-[11px] text-purple-300">
              <span className="text-slate-400 font-sans">• Tempo / Piutang:</span>
              <span>{formatRupiah(data.creditSales)}</span>
            </div>
          )}

          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between font-mono text-xs">
            <span className="text-teal-300 font-sans">Estimasi Untung:</span>
            <span className="font-bold text-teal-300">{formatRupiah(data.grossProfit)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pb-1 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              Tren Penjualan Harian (7 Hari Terakhir)
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Recharts Live
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Grafik performa omzet kasir dan penjualan harian untuk evaluasi kinerja toko
            </p>
          </div>
        </div>

        {/* Toggle Tipe Chart (Area / Bar / Line) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setChartType('area')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              chartType === 'area'
                ? 'bg-white text-emerald-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Tampilan Grafik Area Bergelombang"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Area</span>
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              chartType === 'bar'
                ? 'bg-white text-emerald-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Tampilan Grafik Batang Harian"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Batang</span>
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              chartType === 'line'
                ? 'bg-white text-emerald-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Tampilan Grafik Garis Tren"
          >
            <LineIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Garis</span>
          </button>
        </div>
      </div>

      {/* KPI Highlight 4 Kolom */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">Total Omzet 7 Hari</span>
          <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5">
            {formatRupiah(stats.total7DaysSales)}
          </p>
          <span className="text-[10px] text-slate-500">
            {stats.total7DaysTx} transaksi kasir
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">Rata-rata Penjualan / Hari</span>
          <p className="text-base sm:text-lg font-bold text-emerald-700 font-mono mt-0.5">
            {formatRupiah(stats.avgDailySales)}
          </p>
          <span className="text-[10px] text-slate-500">
            Kinerja konsisten per hari
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">Omzet Tertinggi (Peak)</span>
          <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5">
            {formatRupiah(stats.peakDay?.totalSales || 0)}
          </p>
          <span className="text-[10px] text-emerald-700 font-semibold truncate block">
            {stats.peakDay?.dayLabel || '-'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <span className="text-[11px] font-medium text-slate-500 block">Arah Momentum Tren</span>
          <div className="flex items-center gap-1 mt-0.5">
            {stats.isGrowing ? (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 font-mono">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                +{stats.trendGrowthPercent}%
              </span>
            ) : (
              <span className="text-xs font-bold text-rose-600 flex items-center gap-1 font-mono">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                {stats.trendGrowthPercent}%
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500">
            {stats.isGrowing ? 'Tren bergerak positif' : 'Evaluasi promo & stok'}
          </span>
        </div>
      </div>

      {/* Main Recharts Visualization */}
      <div className="pt-2">
        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart
                data={trendData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="colorSalesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorProfitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="dayLabel"
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
                      {val === 'totalSales' ? 'Total Penjualan (Omzet)' : 'Untung Penjualan (Laba)'}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="totalSales"
                  name="totalSales"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSalesGrad)"
                  activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="grossProfit"
                  name="grossProfit"
                  stroke="#0d9488"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#colorProfitGrad)"
                />
              </AreaChart>
            ) : chartType === 'bar' ? (
              <BarChart
                data={trendData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="dayLabel"
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
                      {val === 'cashSales' ? 'Tunai Kasir' : val === 'creditSales' ? 'Tempo / Piutang' : 'Untung Penjualan'}
                    </span>
                  )}
                />
                <Bar dataKey="cashSales" name="cashSales" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="creditSales" name="creditSales" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="grossProfit" name="grossProfit" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart
                data={trendData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="dayLabel"
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
                      {val === 'totalSales' ? 'Total Penjualan' : 'Untung Penjualan'}
                    </span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="totalSales"
                  name="totalSales"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981' }}
                  activeDot={{ r: 7, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="grossProfit"
                  name="grossProfit"
                  stroke="#0d9488"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#0d9488' }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer Ringkasan Hari Ini & Navigasi Cepat */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className="text-slate-500 flex items-center gap-1.5">
          <ReceiptText className="w-3.5 h-3.5 text-slate-400" />
          Data otomatis diperbarui setiap ada nota baru di Kasir.
        </span>

        {onNavigate && (
          <button
            onClick={() => onNavigate('kasir')}
            className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 transition"
          >
            <span>Buka Kasir Baru</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
