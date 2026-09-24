import React, { useState, useMemo, useEffect } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { 
  calculateStatisticalForecast, 
  InventoryForecastSummary, 
  ProductInventoryForecast 
} from '../../utils/inventoryForecastEngine';
import { formatRupiah } from '../../utils/formatters';
import { TabDestination } from '../layout/BottomNav';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  ShoppingBag, 
  ArrowRight, 
  Search, 
  Filter, 
  Calendar, 
  Boxes, 
  DollarSign, 
  Layers, 
  Zap, 
  AlertOctagon, 
  BarChart3,
  ChevronRight,
  Info
} from 'lucide-react';
import { CreatePurchaseModal } from '../beli/CreatePurchaseModal';

interface AIInventoryForecastTabProps {
  onNavigate?: (tab: TabDestination) => void;
}

export const AIInventoryForecastTab: React.FC<AIInventoryForecastTabProps> = ({ onNavigate }) => {
  const { 
    products, 
    inventoryLayers, 
    sales, 
    saleLines, 
    suppliers, 
    purchases, 
    purchaseLines, 
    db 
  } = useAppDatabase();

  const [windowDays, setWindowDays] = useState<number>(30);
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'HEALTHY' | 'STAGNANT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // AI State
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
  const [aiExecutiveSummary, setAiExecutiveSummary] = useState<string | null>(null);
  const [aiUrgentAdvice, setAiUrgentAdvice] = useState<string | null>(null);
  const [aiEnhancedMap, setAiEnhancedMap] = useState<Map<string, {
    risk?: 'CRITICAL' | 'WARNING' | 'HEALTHY' | 'STAGNANT';
    daysUntilStockout?: number;
    suggestedReorderQty?: number;
    insight?: string;
  }>>(new Map());

  // Quick PO Creation State
  const [poTarget, setPoTarget] = useState<{
    isOpen: boolean;
    supplierId?: string;
    lines?: Array<{ productId: string; qtyOrdered: number; poPrice: number }>;
  }>({
    isOpen: false
  });
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Compute base statistical forecast (offline-first & always instant)
  const baseForecast = useMemo(() => {
    return calculateStatisticalForecast({
      products,
      inventoryLayers,
      sales,
      saleLines,
      suppliers,
      purchases,
      purchaseLines,
      windowDays
    });
  }, [products, inventoryLayers, sales, saleLines, suppliers, purchases, purchaseLines, windowDays]);

  // Combine base forecast with Gemini AI enhanced predictions if available
  const mergedForecasts: ProductInventoryForecast[] = useMemo(() => {
    return baseForecast.forecasts.map(item => {
      const aiData = aiEnhancedMap.get(item.productId);
      if (!aiData) return item;

      return {
        ...item,
        stockoutRisk: aiData.risk || item.stockoutRisk,
        daysUntilStockout: aiData.daysUntilStockout !== undefined ? aiData.daysUntilStockout : item.daysUntilStockout,
        suggestedReorderQty: aiData.suggestedReorderQty !== undefined ? aiData.suggestedReorderQty : item.suggestedReorderQty,
        aiInsight: aiData.insight || item.aiInsight
      };
    });
  }, [baseForecast, aiEnhancedMap]);

  // Trigger Gemini AI Analysis via server endpoint
  const handleRunAiAnalysis = async () => {
    setIsLoadingAI(true);
    setActionSuccessMsg(null);

    try {
      const productsDataPayload = baseForecast.forecasts.map(f => ({
        id: f.productId,
        name: f.productName,
        category: f.category,
        currentStock: f.currentStock,
        minStockAlert: f.minStockAlert,
        unit: f.unit,
        totalSoldPeriod: f.totalSoldPeriod,
        averageDailySales: f.averageDailySales,
        daysWithSales: f.daysWithSales
      }));

      const response = await fetch('/api/ai/forecast-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daysAnalyzed: windowDays,
          salesSummary: {
            totalSkus: baseForecast.totalSkus,
            criticalCount: baseForecast.criticalCount,
            warningCount: baseForecast.warningCount
          },
          productsData: productsDataPayload
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const resJson = await response.json();

      if (resJson.success && resJson.data) {
        const { executiveSummary, urgentActionAdvice, predictions } = resJson.data;
        setAiExecutiveSummary(executiveSummary);
        setAiUrgentAdvice(urgentActionAdvice);

        const newMap = new Map();
        if (Array.isArray(predictions)) {
          predictions.forEach((p: any) => {
            newMap.set(p.productId, {
              risk: p.stockoutRisk,
              daysUntilStockout: p.daysUntilStockout,
              suggestedReorderQty: p.suggestedReorderQty,
              insight: p.aiInsight
            });
          });
        }
        setAiEnhancedMap(newMap);
        setActionSuccessMsg('Analisis kecerdasan buatan Gemini AI berhasil disinkronkan!');
      } else {
        // Fallback message
        setActionSuccessMsg(resJson.message || 'Menggunakan kalkulasi mesin statistik presisi (offline-ready).');
      }
    } catch (err: any) {
      console.warn('AI call error, fallback to statistical engine:', err);
      setActionSuccessMsg('Prediksi berbasis histori penjualan aktif (mesin kalkulasi lokal).');
    } finally {
      setIsLoadingAI(false);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    }
  };

  // Run automatically on first mount if not yet run
  useEffect(() => {
    // Optionally trigger AI forecast once
    handleRunAiAnalysis();
  }, [windowDays]);

  // Filtered list
  const displayItems = useMemo(() => {
    return mergedForecasts.filter(item => {
      const matchRisk = riskFilter === 'ALL' || item.stockoutRisk === riskFilter;
      const matchQuery = 
        item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRisk && matchQuery;
    });
  }, [mergedForecasts, riskFilter, searchQuery]);

  // Action: Open Pre-filled Reorder PO Modal
  const handleQuickReorder = (item: ProductInventoryForecast) => {
    const qty = item.suggestedReorderQty > 0 ? item.suggestedReorderQty : (item.minStockAlert * 2);
    const estPrice = Math.round(item.sellPrice * 0.85);

    setPoTarget({
      isOpen: true,
      supplierId: item.recommendedSupplierId || suppliers[0]?.id,
      lines: [
        {
          productId: item.productId,
          qtyOrdered: qty,
          poPrice: estPrice
        }
      ]
    });
  };

  // Bulk Reorder: All Critical Items
  const handleBulkReorderCritical = () => {
    const criticals = mergedForecasts.filter(f => f.stockoutRisk === 'CRITICAL' || f.stockoutRisk === 'WARNING');
    if (criticals.length === 0) return;

    const lines = criticals.map(c => ({
      productId: c.productId,
      qtyOrdered: c.suggestedReorderQty > 0 ? c.suggestedReorderQty : c.minStockAlert * 2,
      poPrice: Math.round(c.sellPrice * 0.85)
    }));

    setPoTarget({
      isOpen: true,
      supplierId: suppliers[0]?.id,
      lines
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & AI Engine Controls */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                AI-Powered Inventory Intelligence
              </span>
              <span className="text-[11px] text-emerald-200/80">
                Model: Gemini 3.8 Flash & Analitik Laju Penjualan Kasir
              </span>
            </div>
            
            <h3 className="text-base sm:text-lg font-bold text-white mt-1.5 flex items-center gap-2">
              Prediksi Stok Habis & Rekomendasi Restock Optimal
            </h3>
            
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Menganalisis kecepatan penjualan per item (*run-rate velocity*), memproyeksikan estimasi hari hingga stok habis (*stockout date*), dan menghitung kuantitas pemesanan ulang (*reorder quantity*) dengan cadangan aman 14 hari.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {/* Window selector */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-1 flex items-center border border-white/10 text-xs">
              <button
                onClick={() => setWindowDays(14)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  windowDays === 14 ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                14 Hari
              </button>
              <button
                onClick={() => setWindowDays(30)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  windowDays === 30 ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                30 Hari
              </button>
              <button
                onClick={() => setWindowDays(60)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  windowDays === 60 ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                60 Hari
              </button>
            </div>

            {/* AI Re-analyze Button */}
            <button
              onClick={handleRunAiAnalysis}
              disabled={isLoadingAI}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAI ? 'animate-spin' : ''}`} />
              <span>{isLoadingAI ? 'Menganalisis AI...' : 'Jalankan Analisis AI'}</span>
            </button>
          </div>
        </div>

        {/* AI Insight Box (If Available) */}
        {(aiExecutiveSummary || aiUrgentAdvice) && (
          <div className="mt-4 pt-3.5 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                Executive Summary
              </span>
              <p className="text-slate-200 leading-relaxed">
                {aiExecutiveSummary}
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-1">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-300" />
                Rekomendasi Tindakan Mendesak
              </span>
              <p className="text-slate-200 leading-relaxed">
                {aiUrgentAdvice}
              </p>
            </div>
          </div>
        )}

        {actionSuccessMsg && (
          <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* KPI Cards: Critical, Warning, Healthy, Stagnant */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* 1. Critical */}
        <div 
          onClick={() => setRiskFilter(riskFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            riskFilter === 'CRITICAL'
              ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/30'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wide flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-rose-600" />
              Kritis (&le; 3 Hari)
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
              {baseForecast.criticalCount} SKU
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-1">
            {baseForecast.criticalCount > 0 ? `${baseForecast.criticalCount} Produk Darurat` : 'Semua Aman'}
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Stok habis atau akan habis dalam 1-3 hari
          </span>
        </div>

        {/* 2. Warning */}
        <div 
          onClick={() => setRiskFilter(riskFilter === 'WARNING' ? 'ALL' : 'WARNING')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            riskFilter === 'WARNING'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Peringatan (&le; 7 Hari)
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {baseForecast.warningCount} SKU
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-1">
            {baseForecast.warningCount} Perlu Restock
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Mendekati batas buffer stok minimum
          </span>
        </div>

        {/* 3. Healthy */}
        <div 
          onClick={() => setRiskFilter(riskFilter === 'HEALTHY' ? 'ALL' : 'HEALTHY')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            riskFilter === 'HEALTHY'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Stok Sehat (&gt; 7 Hari)
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {baseForecast.healthyCount} SKU
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-1">
            {baseForecast.healthyCount} SKU Optimal
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Perputaran lancar & cadangan aman
          </span>
        </div>

        {/* 4. Stagnant */}
        <div 
          onClick={() => setRiskFilter(riskFilter === 'STAGNANT' ? 'ALL' : 'STAGNANT')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            riskFilter === 'STAGNANT'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              Slow Moving / Pasif
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {baseForecast.stagnantCount} SKU
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-1">
            {baseForecast.stagnantCount} SKU Pasif
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            0 transaksi dalam {windowDays} hari terakhir
          </span>
        </div>
      </div>

      {/* Action Bar & Quick Restock All Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama produk, SKU, atau kategori..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setRiskFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                riskFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({mergedForecasts.length})
            </button>
            <button
              onClick={() => setRiskFilter('CRITICAL')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                riskFilter === 'CRITICAL' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              Kritis ({baseForecast.criticalCount})
            </button>
            <button
              onClick={() => setRiskFilter('WARNING')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                riskFilter === 'WARNING' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-700 hover:text-amber-900'
              }`}
            >
              Warning ({baseForecast.warningCount})
            </button>
          </div>

          {(baseForecast.criticalCount > 0 || baseForecast.warningCount > 0) && (
            <button
              onClick={handleBulkReorderCritical}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer flex-shrink-0"
              title="Buat Draft PO gabungan untuk seluruh produk kritis/warning"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Pesan Semua Kritis ({baseForecast.criticalCount + baseForecast.warningCount} SKU)</span>
            </button>
          )}
        </div>
      </div>

      {/* Forecasting Product Cards */}
      <div className="space-y-3">
        {displayItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
            <Boxes className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold">Tidak ada produk yang cocok dengan kriteria pencarian / filter.</p>
          </div>
        ) : (
          displayItems.map((item) => {
            const isCritical = item.stockoutRisk === 'CRITICAL';
            const isWarning = item.stockoutRisk === 'WARNING';
            const isHealthy = item.stockoutRisk === 'HEALTHY';
            const isStagnant = item.stockoutRisk === 'STAGNANT';

            return (
              <div
                key={item.productId}
                className={`bg-white rounded-xl border transition shadow-2xs p-3.5 sm:p-4 space-y-3 ${
                  isCritical 
                    ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/20' 
                    : isWarning 
                    ? 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/20' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header Row: Product Info & Risk Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.productId}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">
                        {item.category}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                        Harga Jual: {formatRupiah(item.sellPrice)} / {item.unit}
                      </span>
                      {item.seasonalityOrTrend === 'RISING' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-600" />
                          Permintaan Naik (+25%)
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-1">
                      {item.productName}
                    </h4>
                  </div>

                  {/* Stockout Timeline Badge */}
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
                    {isCritical && (
                      <div className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold flex items-center gap-1.5">
                        <AlertOctagon className="w-4 h-4 text-rose-600 flex-shrink-0 animate-bounce" />
                        <div>
                          <span>Habis Dalam ~{item.daysUntilStockout === 0 ? 'HARI INI (0 Hari)' : `${item.daysUntilStockout} Hari`}</span>
                          {item.estimatedStockoutDate && (
                            <span className="block text-[10px] font-normal text-rose-800 font-mono">
                              Est: {item.estimatedStockoutDate}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {isWarning && (
                      <div className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <div>
                          <span>Habis Dalam ~{item.daysUntilStockout} Hari</span>
                          {item.estimatedStockoutDate && (
                            <span className="block text-[10px] font-normal text-amber-800 font-mono">
                              Est: {item.estimatedStockoutDate}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {isHealthy && (
                      <div className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Aman (~{item.daysUntilStockout > 90 ? '> 90 Hari' : `${item.daysUntilStockout} Hari`})</span>
                      </div>
                    )}

                    {isStagnant && (
                      <div className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Slow Moving</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics 4 Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block">Stok Fisik Saat Ini</span>
                    <p className={`text-sm font-bold font-mono mt-0.5 ${
                      item.currentStock <= item.minStockAlert ? 'text-rose-600' : 'text-slate-900'
                    }`}>
                      {item.currentStock} {item.unit}
                    </p>
                    <span className="text-[10px] text-slate-400">Min. Alert: {item.minStockAlert} {item.unit}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block">Laju Terjual (Run-Rate)</span>
                    <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                      {item.averageDailySales} {item.unit}/hari
                    </p>
                    <span className="text-[10px] text-slate-400">Total {item.totalSoldPeriod} {item.unit} ({windowDays} hari)</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block">Saran Order Ulang (EOQ)</span>
                    <p className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
                      {item.suggestedReorderQty > 0 ? `+${item.suggestedReorderQty} ${item.unit}` : 'Belum Perlu Order'}
                    </p>
                    <span className="text-[10px] text-slate-400">Buffer aman: {item.suggestedReorderTargetDays} hari</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block">Estimasi Modal Beli</span>
                    <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                      {item.suggestedReorderQty > 0 ? formatRupiah(item.estimatedReorderCost) : '-'}
                    </p>
                    <span className="text-[10px] text-slate-400 truncate block">Ke: {item.recommendedSupplierName}</span>
                  </div>
                </div>

                {/* AI / Statistical Insight Pill */}
                <div className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  isCritical 
                    ? 'bg-rose-100/70 border border-rose-200 text-rose-900' 
                    : isWarning 
                    ? 'bg-amber-100/70 border border-amber-200 text-amber-900' 
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-950'
                }`}>
                  <Sparkles className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                    isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'
                  }`} />
                  <div className="flex-1">
                    <strong className="font-semibold mr-1">Rekomendasi Cerdas:</strong>
                    <span>{item.aiInsight}</span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 text-[11px]">
                    Frekuensi Transaksi: <strong>{item.salesFrequency}% hari aktif</strong> penjualan
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuickReorder(item)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer ${
                        isCritical
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : isWarning
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-slate-800 hover:bg-slate-900 text-white'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Buat PO ({item.suggestedReorderQty > 0 ? `${item.suggestedReorderQty} ${item.unit}` : `${item.minStockAlert * 2} ${item.unit}`})</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PO Creation Modal Integration */}
      {poTarget.isOpen && (
        <CreatePurchaseModal
          isOpen={poTarget.isOpen}
          initialSupplierId={poTarget.supplierId}
          initialLines={poTarget.lines}
          onClose={() => setPoTarget({ isOpen: false })}
          onSuccess={(poNumber) => {
            setPoTarget({ isOpen: false });
            setActionSuccessMsg(`Pesanan Pembelian baru (${poNumber}) berhasil dibuat dalam status DRAFT!`);
            setTimeout(() => setActionSuccessMsg(null), 5000);
            if (onNavigate) {
              onNavigate('beli');
            }
          }}
        />
      )}
    </div>
  );
};
