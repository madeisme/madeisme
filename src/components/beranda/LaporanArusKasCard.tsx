import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell
} from 'recharts';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah } from '../../utils/formatters';
import { 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  ArrowLeftRight, 
  Receipt, 
  ShoppingBag, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  Layers,
  ChevronRight,
  Scale,
  BookOpen
} from 'lucide-react';
import { TabDestination } from '../layout/BottomNav';

interface LaporanArusKasCardProps {
  onNavigate?: (tab: TabDestination) => void;
}

type PeriodFilter = 'hari_ini' | '7_hari' | 'bulan_ini' | 'semua';
type ChartViewMode = 'harian' | 'total';

export const LaporanArusKasCard: React.FC<LaporanArusKasCardProps> = ({ onNavigate }) => {
  const { sales, operationalExpenses, arTransactions, generalJournals } = useAppDatabase();

  const [period, setPeriod] = useState<PeriodFilter>('7_hari');
  const [viewMode, setViewMode] = useState<ChartViewMode>('harian');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter range start date based on period
  const filterDateRange = useMemo(() => {
    const today = new Date();
    if (period === 'hari_ini') {
      return { start: todayStr, end: todayStr };
    }
    if (period === '7_hari') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { start: d.toISOString().split('T')[0], end: todayStr };
    }
    if (period === 'bulan_ini') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      return { start: `${y}-${m}-01`, end: todayStr };
    }
    return { start: '1970-01-01', end: '2099-12-31' };
  }, [period, todayStr]);

  // 1. Hitung Pendapatan Kasir (Kas Masuk Kasir)
  // Termasuk penjualan tunai kasir + penerimaan kas dari pelunasan piutang kasir
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (s.status !== 'COMMITTED') return false;
      return s.businessDate >= filterDateRange.start && s.businessDate <= filterDateRange.end;
    });
  }, [sales, filterDateRange]);

  const filteredArSettlements = useMemo(() => {
    return arTransactions.filter(ar => {
      if (ar.type !== 'AR_SETTLE') return false;
      const txDate = ar.createdAt.split('T')[0];
      return txDate >= filterDateRange.start && txDate <= filterDateRange.end;
    });
  }, [arTransactions, filterDateRange]);

  // Total Kas Masuk dari Kasir (Penjualan Tunai + Pembayaran Piutang di Kasir)
  const totalKasirCashSales = useMemo(() => {
    return filteredSales.reduce((sum, s) => {
      if (s.paymentMethod === 'TUNAI') {
        return sum + s.grandTotal;
      }
      return sum;
    }, 0);
  }, [filteredSales]);

  const totalKasirArCollection = useMemo(() => {
    return filteredArSettlements.reduce((sum, ar) => sum + ar.amount, 0);
  }, [filteredArSettlements]);

  // Total Pendapatan Kas Masuk dari Kasir
  const totalPendapatanKasir = useMemo(() => {
    return totalKasirCashSales + totalKasirArCollection;
  }, [totalKasirCashSales, totalKasirArCollection]);

  // 2. Hitung Pengeluaran Operasional Langsung (Kas Keluar Kasir/Operasional)
  const filteredExpenses = useMemo(() => {
    return operationalExpenses.filter(e => {
      return e.businessDate >= filterDateRange.start && e.businessDate <= filterDateRange.end;
    });
  }, [operationalExpenses, filterDateRange]);

  const totalPengeluaranOperasional = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  // 3. Hitung Transaksi Kas Jurnal Umum Non-Kasir (Modal Masuk, Beban Listrik, Beban Sewa, dsb)
  const filteredGeneralJournals = useMemo(() => {
    return (generalJournals || []).filter(gj => {
      return gj.businessDate >= filterDateRange.start && gj.businessDate <= filterDateRange.end;
    });
  }, [generalJournals, filterDateRange]);

  // Kas Masuk Non-Kasir (baris Debit ke Akun 1110 KAS, misal: Modal Masuk Pemilik)
  const totalKasMasukNonKasir = useMemo(() => {
    return filteredGeneralJournals.reduce((sum, gj) => {
      const debitKasLines = gj.lines.filter(l => l.accountCode === '1110' && l.side === 'DEBIT');
      return sum + debitKasLines.reduce((s, l) => s + l.amount, 0);
    }, 0);
  }, [filteredGeneralJournals]);

  // Kas Keluar Non-Kasir (baris Kredit ke Akun 1110 KAS, misal: Beban Sewa, Beban Listrik)
  const totalKasKeluarNonKasir = useMemo(() => {
    return filteredGeneralJournals.reduce((sum, gj) => {
      const creditKasLines = gj.lines.filter(l => l.accountCode === '1110' && l.side === 'CREDIT');
      return sum + creditKasLines.reduce((s, l) => s + l.amount, 0);
    }, 0);
  }, [filteredGeneralJournals]);

  // TOTAL KESELURUHAN KAS MASUK & KAS KELUAR
  const totalSemuaKasMasuk = totalPendapatanKasir + totalKasMasukNonKasir;
  const totalSemuaKasKeluar = totalPengeluaranOperasional + totalKasKeluarNonKasir;

  // 4. Arus Kas Bersih (Net Cash Flow)
  const arusKasBersih = totalSemuaKasMasuk - totalSemuaKasKeluar;
  const isSurplus = arusKasBersih >= 0;

  // Rasio Efisiensi Pengeluaran terhadap Kas Masuk
  const expenseRatio = totalSemuaKasMasuk > 0 
    ? Math.round((totalSemuaKasKeluar / totalSemuaKasMasuk) * 100) 
    : (totalSemuaKasKeluar > 0 ? 100 : 0);

  // 4. Data Harian untuk Bar Chart (Daily Trend)
  const dailyChartData = useMemo(() => {
    const map = new Map<string, { tanggal: string; dateLabel: string; kasMasuk: number; kasKeluar: number }>();

    // Generate dates based on period
    if (period === '7_hari') {
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
        map.set(iso, { tanggal: iso, dateLabel: dayName, kasMasuk: 0, kasKeluar: 0 });
      }
    } else if (period === 'hari_ini') {
      const d = new Date();
      map.set(todayStr, {
        tanggal: todayStr,
        dateLabel: 'Hari Ini (' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ')',
        kasMasuk: 0,
        kasKeluar: 0
      });
    } else {
      // Bulan ini atau Semua: kumpulkan semua tanggal unik yang ada
      const allDates = new Set<string>();
      filteredSales.forEach(s => allDates.add(s.businessDate));
      filteredExpenses.forEach(e => allDates.add(e.businessDate));
      filteredGeneralJournals.forEach(gj => allDates.add(gj.businessDate));
      if (allDates.size === 0) allDates.add(todayStr);

      const sortedDates = Array.from(allDates).sort();
      sortedDates.forEach(iso => {
        const parts = iso.split('-');
        const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso;
        map.set(iso, { tanggal: iso, dateLabel, kasMasuk: 0, kasKeluar: 0 });
      });
    }

    // Isi kas masuk dari Kasir (Penjualan Tunai)
    filteredSales.forEach(s => {
      if (s.paymentMethod === 'TUNAI') {
        const item = map.get(s.businessDate);
        if (item) {
          item.kasMasuk += s.grandTotal;
        } else if (period === 'semua' || period === 'bulan_ini') {
          const parts = s.businessDate.split('-');
          map.set(s.businessDate, {
            tanggal: s.businessDate,
            dateLabel: `${parts[2]}/${parts[1]}`,
            kasMasuk: s.grandTotal,
            kasKeluar: 0
          });
        }
      }
    });

    // Isi kas masuk dari Kasir (Pelunasan Piutang Kasir)
    filteredArSettlements.forEach(ar => {
      const txDate = ar.createdAt.split('T')[0];
      const item = map.get(txDate);
      if (item) {
        item.kasMasuk += ar.amount;
      }
    });

    // Isi kas masuk dari Jurnal Umum Non-Kasir (Debit Kas 1110, e.g. Modal Masuk)
    filteredGeneralJournals.forEach(gj => {
      const debitKasLines = gj.lines.filter(l => l.accountCode === '1110' && l.side === 'DEBIT');
      const amt = debitKasLines.reduce((s, l) => s + l.amount, 0);
      if (amt > 0) {
        const item = map.get(gj.businessDate);
        if (item) {
          item.kasMasuk += amt;
        } else {
          const parts = gj.businessDate.split('-');
          map.set(gj.businessDate, {
            tanggal: gj.businessDate,
            dateLabel: `${parts[2]}/${parts[1]}`,
            kasMasuk: amt,
            kasKeluar: 0
          });
        }
      }
    });

    // Isi kas keluar dari Beban Operasional Langsung
    filteredExpenses.forEach(e => {
      const item = map.get(e.businessDate);
      if (item) {
        item.kasKeluar += e.amount;
      } else if (period === 'semua' || period === 'bulan_ini') {
        const parts = e.businessDate.split('-');
        map.set(e.businessDate, {
          tanggal: e.businessDate,
          dateLabel: `${parts[2]}/${parts[1]}`,
          kasMasuk: 0,
          kasKeluar: e.amount
        });
      }
    });

    // Isi kas keluar dari Jurnal Umum Non-Kasir (Kredit Kas 1110, e.g. Beban Listrik, Sewa)
    filteredGeneralJournals.forEach(gj => {
      const creditKasLines = gj.lines.filter(l => l.accountCode === '1110' && l.side === 'CREDIT');
      const amt = creditKasLines.reduce((s, l) => s + l.amount, 0);
      if (amt > 0) {
        const item = map.get(gj.businessDate);
        if (item) {
          item.kasKeluar += amt;
        } else {
          const parts = gj.businessDate.split('-');
          map.set(gj.businessDate, {
            tanggal: gj.businessDate,
            dateLabel: `${parts[2]}/${parts[1]}`,
            kasMasuk: 0,
            kasKeluar: amt
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [period, todayStr, filteredSales, filteredArSettlements, filteredExpenses, filteredGeneralJournals]);

  // 5. Data Total Perbandingan untuk Bar Chart Total
  const totalChartData = useMemo(() => {
    return [
      {
        kategori: 'Total Kas Masuk',
        nominal: totalSemuaKasMasuk,
        color: '#059669', // Emerald 600
        desc: `Kasir: ${formatRupiah(totalPendapatanKasir)} | Non-Kasir: ${formatRupiah(totalKasMasukNonKasir)}`
      },
      {
        kategori: 'Total Kas Keluar',
        nominal: totalSemuaKasKeluar,
        color: '#e11d48', // Rose 600
        desc: `Beban: ${formatRupiah(totalPengeluaranOperasional)} | Non-Kasir: ${formatRupiah(totalKasKeluarNonKasir)}`
      },
      {
        kategori: 'Arus Kas Bersih',
        nominal: Math.abs(arusKasBersih),
        color: isSurplus ? '#0d9488' : '#e11d48', // Teal 600 or Rose 600
        desc: isSurplus ? 'Surplus Arus Kas' : 'Defisit Arus Kas'
      }
    ];
  }, [totalSemuaKasMasuk, totalSemuaKasKeluar, totalPendapatanKasir, totalKasMasukNonKasir, totalPengeluaranOperasional, totalKasKeluarNonKasir, arusKasBersih, isSurplus]);

  // Breakdown kategori pengeluaran operasional
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  // Custom Tooltip Formatter
  const CustomHarianTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const masuk = payload.find((p: any) => p.dataKey === 'kasMasuk')?.value || 0;
      const keluar = payload.find((p: any) => p.dataKey === 'kasKeluar')?.value || 0;
      const selisih = masuk - keluar;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800 font-sans z-50">
          <p className="font-bold text-slate-300 border-b border-slate-700/80 pb-1">{label}</p>
          <div className="flex items-center justify-between gap-4">
            <span className="text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Kas Masuk (Kasir):
            </span>
            <span className="font-mono font-bold text-white">{formatRupiah(masuk)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-rose-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              Kas Keluar (Operasional):
            </span>
            <span className="font-mono font-bold text-white">{formatRupiah(keluar)}</span>
          </div>
          <div className="pt-1 border-t border-slate-700/80 flex items-center justify-between gap-4">
            <span className="text-slate-300 font-semibold">Arus Kas Bersih:</span>
            <span className={`font-mono font-bold ${selisih >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {selisih >= 0 ? '+' : ''}{formatRupiah(selisih)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomTotalTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs space-y-1 border border-slate-800 font-sans">
          <p className="font-bold text-slate-200">{data.kategori}</p>
          <p className="font-mono font-bold text-emerald-300 text-sm">{formatRupiah(data.nominal)}</p>
          <p className="text-[10px] text-slate-400">{data.desc}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Laporan Arus Kas Sederhana
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Riil Kas Masuk vs Kas Keluar
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Merangkum pendapatan transaksi Kasir dan pengeluaran beban dari layar Operasional
              </p>
            </div>
          </div>

          {/* Period Filter Buttons */}
          <div className="flex items-center p-1 bg-slate-800/90 rounded-xl border border-slate-700/80 gap-1 self-start sm:self-center">
            <button
              onClick={() => setPeriod('hari_ini')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                period === 'hari_ini'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setPeriod('7_hari')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                period === '7_hari'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setPeriod('bulan_ini')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                period === 'bulan_ini'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setPeriod('semua')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                period === 'semua'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Semua
            </button>
          </div>
        </div>

        {/* 3 Main Highlights (Cards inside banner) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-slate-750">
          {/* 1. Total Kas Masuk (Kasir & Non-Kasir) */}
          <div className="bg-slate-800/80 backdrop-blur-xs p-3 rounded-xl border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Total Kas Masuk</span>
              <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-lg font-bold text-white font-mono mt-1">
              +{formatRupiah(totalSemuaKasMasuk)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Kasir: {formatRupiah(totalPendapatanKasir)}
              {totalKasMasukNonKasir > 0 && ` • Non-Kasir: +${formatRupiah(totalKasMasukNonKasir)}`}
            </p>
          </div>

          {/* 2. Total Kas Keluar (Beban & Non-Kasir) */}
          <div className="bg-slate-800/80 backdrop-blur-xs p-3 rounded-xl border border-rose-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Total Kas Keluar</span>
              <span className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-lg font-bold text-rose-300 font-mono mt-1">
              -{formatRupiah(totalSemuaKasKeluar)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Beban: {formatRupiah(totalPengeluaranOperasional)}
              {totalKasKeluarNonKasir > 0 && ` • Non-Kasir: -${formatRupiah(totalKasKeluarNonKasir)}`}
            </p>
          </div>

          {/* 3. Arus Kas Bersih (Net Cash Flow) */}
          <div className={`backdrop-blur-xs p-3 rounded-xl border ${
            isSurplus 
              ? 'bg-emerald-950/70 border-emerald-400/30' 
              : 'bg-rose-950/70 border-rose-400/30'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-200 font-semibold">Arus Kas Bersih</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isSurplus ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              }`}>
                {isSurplus ? 'SURPLUS' : 'DEFISIT'}
              </span>
            </div>
            <p className={`text-lg font-bold font-mono mt-1 ${isSurplus ? 'text-emerald-300' : 'text-rose-300'}`}>
              {isSurplus ? '+' : ''}{formatRupiah(arusKasBersih)}
            </p>
            <p className="text-[10px] text-slate-300 mt-0.5">
              Rasio Pengeluaran: <strong className="text-white">{expenseRatio}%</strong> dari kas masuk
            </p>
          </div>
        </div>
      </div>

      {/* Main Chart Body */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Chart View Toggle & Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-700" />
            <h4 className="text-xs font-bold text-slate-800">
              Visualisasi Grafik Batang Arus Kas
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">Tampilan:</span>
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('harian')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  viewMode === 'harian'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tren Per Tanggal
              </button>
              <button
                onClick={() => setViewMode('total')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  viewMode === 'total'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Komparasi Total
              </button>
            </div>
          </div>
        </div>

        {/* RECHARTS CONTAINER */}
        <div className="h-64 sm:h-72 w-full pt-2">
          {viewMode === 'harian' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailyChartData}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                barGap={4}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="dateLabel" 
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
                    if (val >= 1000) return `${Math.round(val / 1000)}rb`;
                    return String(val);
                  }}
                />
                <Tooltip content={<CustomHarianTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                  formatter={(value) => {
                    if (value === 'kasMasuk') return <span className="text-slate-700 font-semibold">Kas Masuk (Kasir)</span>;
                    if (value === 'kasKeluar') return <span className="text-slate-700 font-semibold">Kas Keluar (Operasional)</span>;
                    return value;
                  }}
                />
                <Bar 
                  dataKey="kasMasuk" 
                  name="kasMasuk" 
                  fill="#059669" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={40}
                />
                <Bar 
                  dataKey="kasKeluar" 
                  name="kasKeluar" 
                  fill="#e11d48" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={totalChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis 
                  type="number"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
                    if (val >= 1000) return `${Math.round(val / 1000)}rb`;
                    return String(val);
                  }}
                />
                <YAxis 
                  type="category"
                  dataKey="kategori" 
                  tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip content={<CustomTotalTooltip />} />
                <Bar dataKey="nominal" radius={[0, 6, 6, 0]} barSize={28}>
                  {totalChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bottom Section: Category Breakdown & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          {/* Top 3 Operational Expenses Breakdown */}
          <div className="lg:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-rose-600" />
                <span>Rincian Pos Beban Operasional ({filteredExpenses.length})</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Total: {formatRupiah(totalPengeluaranOperasional)}
              </span>
            </div>

            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-1">
                Tidak ada pengeluaran operasional yang tercatat pada rentang waktu ini.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {categoryBreakdown.slice(0, 4).map(cat => {
                  const pct = totalPengeluaranOperasional > 0 
                    ? Math.round((cat.amount / totalPengeluaranOperasional) * 100) 
                    : 0;
                  return (
                    <div 
                      key={cat.name}
                      className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 truncate">{cat.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{pct}% dari total biaya</p>
                      </div>
                      <span className="font-mono font-bold text-rose-600 shrink-0">
                        -{formatRupiah(cat.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between gap-2.5">
            <div>
              <p className="text-xs font-bold text-slate-800">Aksi Cepat Transaksi</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tambah arus kas masuk atau catat pengeluaran baru
              </p>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={() => onNavigate?.('kasir')}
                className="w-full py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-between shadow-2xs"
              >
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Buka Kasir (Kas Masuk)</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigate?.('operasional')}
                className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center justify-between shadow-2xs"
              >
                <span className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-rose-600" />
                  <span>Catat Beban Operasional</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigate?.('operasional')}
                className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center justify-between shadow-2xs"
              >
                <span className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Jurnal Umum (Modal/Sewa)</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
