import React, { useState } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { formatRupiah } from '../../utils/formatters';
import { 
  TrendingUp, 
  PieChart as PieIcon, 
  BarChart3, 
  Coins, 
  Package, 
  CreditCard, 
  Wallet,
  ArrowUpRight,
  Info
} from 'lucide-react';

export interface FinancialInsightChartsProps {
  cashBalance: number;
  inventoryValue: number;
  arBalance: number;
  apBalance: number;
  cashSalesTotal: number;
  creditSalesTotal: number;
  weeklyTrend: {
    dayLabel: string;
    sales: number;
    cogs: number;
    profit: number;
  }[];
}

const ASSET_COLORS = ['#10b981', '#f59e0b', '#3b82f6']; // Kas (Emerald), Stok (Amber), Piutang (Blue)
const SALES_SPLIT_COLORS = ['#10b981', '#8b5cf6']; // Tunai (Emerald), Tempo (Purple)

export const FinancialInsightCharts: React.FC<FinancialInsightChartsProps> = ({
  cashBalance,
  inventoryValue,
  arBalance,
  apBalance,
  cashSalesTotal,
  creditSalesTotal,
  weeklyTrend
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'harta' | 'penjualan' | 'tren'>('harta');

  // 1. Data Komposisi Harta / Aset Toko
  const safeCash = Math.max(0, cashBalance);
  const safeInventory = Math.max(0, inventoryValue);
  const safeAr = Math.max(0, arBalance);
  const totalAssets = safeCash + safeInventory + safeAr;

  const assetData = [
    { name: 'Uang Kas Toko', value: safeCash, code: '1110', desc: 'Uang fisik di laci kasir & kas' },
    { name: 'Stok Barang Dagang', value: safeInventory, code: '1310', desc: 'Nilai modal persediaan di rak & gudang' },
    { name: 'Tagihan Piutang Pelanggan', value: safeAr, code: '1210', desc: 'Uang penjualan tempo yang belum lunas' }
  ].filter(d => d.value > 0);

  // 2. Data Komposisi Penjualan (Tunai vs Tempo)
  const safeCashSales = Math.max(0, cashSalesTotal);
  const safeCreditSales = Math.max(0, creditSalesTotal);
  const totalSalesMix = safeCashSales + safeCreditSales;

  const salesMixData = [
    { name: 'Penjualan Tunai (Kas Masuk)', value: safeCashSales, desc: 'Pembayaran langsung tunai di kasir' },
    { name: 'Penjualan Tempo / Kredit', value: safeCreditSales, desc: 'Pembayaran berjangka (piutang)' }
  ].filter(d => d.value > 0);

  // 3. Modal Bersih Sendiri = Harta Toko - Hutang ke Supplier
  const netWorth = totalAssets - apBalance;

  // Custom tooltip for Donut Charts
  const renderDonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percent = totalAssets > 0 ? ((data.value / totalAssets) * 100).toFixed(1) : '0.0';
      return (
        <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg border border-slate-700">
          <p className="font-bold text-slate-100">{data.name}</p>
          <p className="text-emerald-400 font-mono font-bold mt-0.5">{formatRupiah(data.value)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{percent}% dari total • {data.desc}</p>
        </div>
      );
    }
    return null;
  };

  const renderSalesMixTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percent = totalSalesMix > 0 ? ((data.value / totalSalesMix) * 100).toFixed(1) : '0.0';
      return (
        <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg border border-slate-700">
          <p className="font-bold text-slate-100">{data.name}</p>
          <p className="text-purple-300 font-mono font-bold mt-0.5">{formatRupiah(data.value)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{percent}% dari total omzet • {data.desc}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
      {/* Header with Title & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <PieIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Grafik Informasi Keuangan Toko
              </h3>
              <p className="text-[11px] text-slate-500">
                Visualisasi harta, hutang, dan perputaran kas dengan istilah pembukuan sederhana
              </p>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveChartTab('harta')}
            className={`px-3 py-1 rounded-md font-semibold transition ${
              activeChartTab === 'harta'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Harta Toko (Donut)
          </button>
          <button
            onClick={() => setActiveChartTab('penjualan')}
            className={`px-3 py-1 rounded-md font-semibold transition ${
              activeChartTab === 'penjualan'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Arus Penjualan (Pie)
          </button>
          <button
            onClick={() => setActiveChartTab('tren')}
            className={`px-3 py-1 rounded-md font-semibold transition ${
              activeChartTab === 'tren'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tren 7 Hari (Bar)
          </button>
        </div>
      </div>

      {/* 3 Ringkasan Blok Finansial Sederhana (Harta, Hutang, Modal) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. Harta Toko (Aset) */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-200/80">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              Total Harta Toko (Aset)
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono">
              Kas + Stok + Piutang
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold text-emerald-950 font-mono">
            {formatRupiah(totalAssets)}
          </p>
          <p className="text-[11px] text-emerald-700/80 mt-1">
            Seluruh sumber daya ekonomi milik usaha yang siap menghasilkan omzet.
          </p>
        </div>

        {/* 2. Hutang ke Supplier (Kewajiban) */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-50/70 to-indigo-50/40 border border-purple-200/80">
          <div className="flex items-center justify-between text-xs text-purple-800 font-semibold mb-1">
            <span className="flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-purple-600" />
              Hutang ke Supplier (Kewajiban)
            </span>
            <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono">
              Tagihan Supplier
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold text-purple-950 font-mono">
            {formatRupiah(apBalance)}
          </p>
          <p className="text-[11px] text-purple-700/80 mt-1">
            Kewajiban pembayaran barang belanjaan tempo yang wajib diselesaikan.
          </p>
        </div>

        {/* 3. Modal Bersih Sendiri (Ekuitas) */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-50/70 to-yellow-50/40 border border-amber-200/80">
          <div className="flex items-center justify-between text-xs text-amber-900 font-semibold mb-1">
            <span className="flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-700" />
              Modal Bersih Usaha (Ekuitas)
            </span>
            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono">
              Harta − Hutang
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold text-amber-950 font-mono">
            {formatRupiah(netWorth)}
          </p>
          <p className="text-[11px] text-amber-800/80 mt-1">
            Nilai kekayaan bersih murni toko milik pemilik setelah dikurangi hutang.
          </p>
        </div>
      </div>

      {/* CHART CONTENT TABS */}
      {activeChartTab === 'harta' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-2">
          {/* Donut Chart Visual */}
          <div className="lg:col-span-6 h-56 w-full flex items-center justify-center relative">
            {assetData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetData}
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {assetData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={renderDonutTooltip} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-xs">
                Belum ada data harta tercatat
              </div>
            )}
            {/* Center Label in Donut */}
            {assetData.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Harta</span>
                <span className="text-xs font-bold font-mono text-slate-800">{formatRupiah(totalAssets)}</span>
              </div>
            )}
          </div>

          {/* Detailed Donut Breakdown Cards */}
          <div className="lg:col-span-6 space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0"></span>
                <div>
                  <p className="font-bold text-slate-800">1. Uang Kas Toko</p>
                  <p className="text-[10px] text-slate-500">Uang fisik kasir & saldo kas siap pakai</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-emerald-800">{formatRupiah(safeCash)}</p>
                <p className="text-[10px] text-slate-500">
                  {totalAssets > 0 ? ((safeCash / totalAssets) * 100).toFixed(1) : 0}% porsi
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0"></span>
                <div>
                  <p className="font-bold text-slate-800">2. Stok Barang Dagangan</p>
                  <p className="text-[10px] text-slate-500">Nilai modal barang di rak & gudang (FIFO)</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-amber-900">{formatRupiah(safeInventory)}</p>
                <p className="text-[10px] text-slate-500">
                  {totalAssets > 0 ? ((safeInventory / totalAssets) * 100).toFixed(1) : 0}% porsi
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></span>
                <div>
                  <p className="font-bold text-slate-800">3. Tagihan Piutang Pelanggan</p>
                  <p className="text-[10px] text-slate-500">Penjualan tempo yang akan dilunasi pelanggan</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-blue-900">{formatRupiah(safeAr)}</p>
                <p className="text-[10px] text-slate-500">
                  {totalAssets > 0 ? ((safeAr / totalAssets) * 100).toFixed(1) : 0}% porsi
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeChartTab === 'penjualan' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-2">
          {/* Pie Chart Visual */}
          <div className="lg:col-span-6 h-56 w-full flex items-center justify-center relative">
            {salesMixData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesMixData}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {salesMixData.map((_, index) => (
                      <Cell key={`sales-cell-${index}`} fill={SALES_SPLIT_COLORS[index % SALES_SPLIT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={renderSalesMixTooltip} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-xs">
                Belum ada data penjualan tercatat
              </div>
            )}
            {salesMixData.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Omzet</span>
                <span className="text-xs font-bold font-mono text-slate-800">{formatRupiah(totalSalesMix)}</span>
              </div>
            )}
          </div>

          {/* Breakdown Cards */}
          <div className="lg:col-span-6 space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                <div>
                  <p className="font-bold text-slate-800">Penjualan Tunai (Kas Masuk)</p>
                  <p className="text-[11px] text-emerald-800">Langsung menambah uang di kasir</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-emerald-800 text-sm">{formatRupiah(safeCashSales)}</p>
                <p className="text-[10px] text-slate-500">
                  {totalSalesMix > 0 ? ((safeCashSales / totalSalesMix) * 100).toFixed(1) : 0}% perputaran
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-500 flex-shrink-0"></span>
                <div>
                  <p className="font-bold text-slate-800">Penjualan Tempo / Kredit</p>
                  <p className="text-[11px] text-purple-800">Menjadi tagihan piutang pelanggan</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-purple-900 text-sm">{formatRupiah(safeCreditSales)}</p>
                <p className="text-[10px] text-slate-500">
                  {totalSalesMix > 0 ? ((safeCreditSales / totalSalesMix) * 100).toFixed(1) : 0}% perputaran
                </p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span>
                Mayoritas penjualan tunai menjaga ketersediaan uang kas toko tetap sehat untuk belanja stok baru ke supplier.
              </span>
            </div>
          </div>
        </div>
      )}

      {activeChartTab === 'tren' && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              Grafik Penjualan vs Modal Barang (HPP) & Untung Bersih (7 Hari Terakhir)
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Satuan: Rupiah
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyTrend}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="dayLabel" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `${val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : `${Math.round(val / 1000)}rb`}`}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip 
                  formatter={(val: number | string | undefined, name: string | undefined) => [
                    formatRupiah(Number(val || 0)), 
                    name === 'sales' ? 'Penjualan (Omzet)' : name === 'cogs' ? 'Modal Pokok (HPP)' : 'Untung Bersih'
                  ]}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  formatter={(value) => (
                    <span className="text-xs font-semibold text-slate-700">
                      {value === 'sales' ? 'Penjualan (Omzet)' : value === 'cogs' ? 'Modal Pokok (HPP)' : 'Untung Penjualan (Laba)'}
                    </span>
                  )}
                />
                <Bar dataKey="sales" name="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cogs" name="cogs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1 border-t border-slate-100">
            <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200">
              <span className="block text-slate-500 font-medium">Hijau: Penjualan</span>
              <span className="font-bold text-emerald-800">Total Uang Diterima dari Pembeli</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200">
              <span className="block text-slate-500 font-medium">Oranye: Modal Barang</span>
              <span className="font-bold text-amber-900">Biaya Pembelian Barang (HPP)</span>
            </div>
            <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200">
              <span className="block text-slate-500 font-medium">Biru: Untung Penjualan</span>
              <span className="font-bold text-blue-900">Selisih Penjualan − Modal Barang</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
