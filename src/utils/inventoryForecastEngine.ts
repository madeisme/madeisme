import { formatRupiah } from './formatters';

export interface ProductInventoryForecast {
  productId: string;
  productName: string;
  category: string;
  unit: string;
  sellPrice: number;
  currentStock: number;
  minStockAlert: number;
  
  // Historical velocity
  totalSoldPeriod: number; // total units sold in analyzed window (e.g. 30/60 days or all time)
  activeDaysWindow: number; // number of days in window
  averageDailySales: number; // daily run rate (units/day)
  daysWithSales: number; // days where at least 1 sale occurred
  salesFrequency: number; // percentage of days with sales
  
  // Predictions
  daysUntilStockout: number; // Infinity if sales = 0, or calculated number of days
  estimatedStockoutDate: string | null; // YYYY-MM-DD
  stockoutRisk: 'CRITICAL' | 'WARNING' | 'HEALTHY' | 'STAGNANT';
  // CRITICAL: <= 3 days or already 0
  // WARNING: <= 7 days or <= minStockAlert
  // HEALTHY: > 7 days with normal velocity
  // STAGNANT: 0 sales velocity with high stock
  
  // Suggested Reorder
  suggestedReorderQty: number; // Optimal reorder quantity (EOQ / safety stock buffered)
  suggestedReorderTargetDays: number; // e.g., 14 days or 30 days buffer
  estimatedReorderCost: number; // approximate cost based on latest layer or 85% sellPrice
  recommendedSupplierId?: string;
  recommendedSupplierName?: string;
  
  // Reasoning
  aiInsight?: string;
  seasonalityOrTrend?: 'RISING' | 'STABLE' | 'DECLINING';
}

export interface InventoryForecastSummary {
  totalSkus: number;
  criticalCount: number;
  warningCount: number;
  healthyCount: number;
  stagnantCount: number;
  forecasts: ProductInventoryForecast[];
  analyzedStartDate: string;
  analyzedEndDate: string;
  totalEstimatedReorderBudget: number;
}

/**
 * Calculates statistical run-rate and reorder projections from raw ERP data.
 * Works offline-first with immediate mathematical precision, and provides data for Gemini AI enhancement.
 */
export function calculateStatisticalForecast(params: {
  products: any[];
  inventoryLayers: any[];
  sales: any[];
  saleLines: any[];
  suppliers: any[];
  purchases: any[];
  purchaseLines: any[];
  windowDays?: number;
}): InventoryForecastSummary {
  const {
    products,
    inventoryLayers,
    sales,
    saleLines,
    suppliers,
    purchases,
    purchaseLines,
    windowDays = 30
  } = params;

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - windowDays);

  const windowStartStr = windowStart.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  // Map committed sales within timeframe
  const committedSales = sales.filter(s => s.status === 'COMMITTED');
  const validSaleIds = new Set(committedSales.map(s => s.id));

  // Build sale date map
  const saleDateMap = new Map<string, string>();
  committedSales.forEach(s => {
    saleDateMap.set(s.id, s.businessDate || s.createdAt.split('T')[0]);
  });

  // Calculate product units sold per day
  const productSalesMap = new Map<string, { totalQty: number; dates: Set<string>; recentWeekQty: number; priorWeekQty: number }>();
  
  // Recent 7 days vs prior 7 days for trend calculation
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  (saleLines || []).forEach(line => {
    if (!validSaleIds.has(line.saleId)) return;
    const saleDateStr = saleDateMap.get(line.saleId) || '';
    if (!saleDateStr) return;

    if (!productSalesMap.has(line.productId)) {
      productSalesMap.set(line.productId, { totalQty: 0, dates: new Set(), recentWeekQty: 0, priorWeekQty: 0 });
    }
    const entry = productSalesMap.get(line.productId)!;
    entry.totalQty += line.qty;
    entry.dates.add(saleDateStr);

    const sDate = new Date(saleDateStr);
    if (sDate >= sevenDaysAgo) {
      entry.recentWeekQty += line.qty;
    } else if (sDate >= fourteenDaysAgo) {
      entry.priorWeekQty += line.qty;
    }
  });

  // Map latest purchase costs and suppliers
  const productSupplierMap = new Map<string, { supplierId: string; supplierName: string; latestPoPrice: number }>();
  (purchases || []).forEach(p => {
    const lines = (purchaseLines || []).filter(pl => pl.purchaseId === p.id);
    const supp = suppliers.find(s => s.id === p.supplierId);
    lines.forEach(l => {
      if (!productSupplierMap.has(l.productId)) {
        productSupplierMap.set(l.productId, {
          supplierId: p.supplierId,
          supplierName: supp?.name || 'Supplier Utama',
          latestPoPrice: l.poPrice
        });
      }
    });
  });

  // Calculate current available stock per product
  const productStockMap = new Map<string, number>();
  (inventoryLayers || []).forEach(layer => {
    productStockMap.set(
      layer.productId,
      (productStockMap.get(layer.productId) || 0) + (layer.quantityRemaining || 0)
    );
  });

  let criticalCount = 0;
  let warningCount = 0;
  let healthyCount = 0;
  let stagnantCount = 0;
  let totalEstimatedReorderBudget = 0;

  const forecasts: ProductInventoryForecast[] = products.map(product => {
    const currentStock = productStockMap.get(product.id) || 0;
    const minAlert = product.minStockAlert || 5;
    const salesInfo = productSalesMap.get(product.id) || { totalQty: 0, dates: new Set(), recentWeekQty: 0, priorWeekQty: 0 };
    
    // Effective velocity (unit per day)
    // If window has elapsed, divide by windowDays. Guard minimum 1.
    const averageDailySales = Number((salesInfo.totalQty / Math.max(windowDays, 1)).toFixed(2));
    const daysWithSales = salesInfo.dates.size;
    const salesFrequency = Number(((daysWithSales / Math.max(windowDays, 1)) * 100).toFixed(0));

    // Calculate days until stockout
    let daysUntilStockout: number;
    let estimatedStockoutDate: string | null = null;
    let risk: 'CRITICAL' | 'WARNING' | 'HEALTHY' | 'STAGNANT';

    if (currentStock <= 0) {
      daysUntilStockout = 0;
      estimatedStockoutDate = todayStr;
      risk = 'CRITICAL';
    } else if (averageDailySales > 0) {
      daysUntilStockout = Math.round((currentStock / averageDailySales) * 10) / 10;
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + Math.ceil(daysUntilStockout));
      estimatedStockoutDate = targetDate.toISOString().split('T')[0];

      if (daysUntilStockout <= 3 || currentStock <= Math.ceil(minAlert * 0.5)) {
        risk = 'CRITICAL';
      } else if (daysUntilStockout <= 7 || currentStock <= minAlert) {
        risk = 'WARNING';
      } else {
        risk = 'HEALTHY';
      }
    } else {
      // 0 sales in window
      daysUntilStockout = 999; // effectively high
      estimatedStockoutDate = null;
      if (currentStock <= minAlert) {
        risk = 'WARNING';
      } else {
        risk = 'STAGNANT';
      }
    }

    if (risk === 'CRITICAL') criticalCount++;
    else if (risk === 'WARNING') warningCount++;
    else if (risk === 'HEALTHY') healthyCount++;
    else stagnantCount++;

    // Trend assessment
    let seasonalityOrTrend: 'RISING' | 'STABLE' | 'DECLINING' = 'STABLE';
    if (salesInfo.recentWeekQty > salesInfo.priorWeekQty * 1.25 && salesInfo.recentWeekQty >= 3) {
      seasonalityOrTrend = 'RISING';
    } else if (salesInfo.recentWeekQty < salesInfo.priorWeekQty * 0.75 && salesInfo.priorWeekQty >= 3) {
      seasonalityOrTrend = 'DECLINING';
    }

    // Optimal Reorder Qty Calculation:
    // Lead time default: 3 days. Target safety buffer: 14 days of average sales, minimum minAlert * 1.5.
    const targetBufferDays = 14;
    let targetCoverageQty = Math.ceil(averageDailySales * targetBufferDays);
    if (targetCoverageQty < minAlert * 2) {
      targetCoverageQty = minAlert * 2;
    }

    let suggestedReorderQty = 0;
    if (risk === 'CRITICAL' || risk === 'WARNING') {
      suggestedReorderQty = Math.max(0, targetCoverageQty - currentStock);
      // Round up to clean commercial lot (multiples of 5 or 10 if large)
      if (suggestedReorderQty > 10) {
        suggestedReorderQty = Math.ceil(suggestedReorderQty / 5) * 5;
      }
    }

    // Cost estimation
    const suppInfo = productSupplierMap.get(product.id);
    const unitCost = suppInfo?.latestPoPrice || Math.round(product.sellPrice * 0.85);
    const estimatedCost = suggestedReorderQty * unitCost;
    if (suggestedReorderQty > 0) {
      totalEstimatedReorderBudget += estimatedCost;
    }

    // Automated statistical insight
    let insight = '';
    if (risk === 'CRITICAL') {
      if (currentStock <= 0) {
        insight = `Stok telah HABIS! Segera buat PO ke supplier untuk ${targetCoverageQty} ${product.unit} agar kasir tidak kehilangan omzet.`;
      } else {
        insight = `Stok kritis tersisa ${currentStock} ${product.unit}. Pada laju ${averageDailySales} ${product.unit}/hari, barang akan habis dalam ~${daysUntilStockout} hari (${estimatedStockoutDate}).`;
      }
    } else if (risk === 'WARNING') {
      insight = `Stok mendekati batas aman (sisa ${currentStock} ${product.unit}). Disarankan reorder ${suggestedReorderQty} ${product.unit} dalam 3 hari ke depan.`;
    } else if (risk === 'STAGNANT') {
      insight = `Tidak ada transaksi tercatat dalam ${windowDays} hari terakhir. Periksa lokasi pajang atau pertimbangkan promo diskon kasir.`;
    } else {
      insight = `Kapasitas stok aman untuk ~${daysUntilStockout} hari ke depan dengan perputaran stabil (${averageDailySales} ${product.unit}/hari).`;
    }

    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      unit: product.unit,
      sellPrice: product.sellPrice,
      currentStock,
      minStockAlert: minAlert,
      totalSoldPeriod: salesInfo.totalQty,
      activeDaysWindow: windowDays,
      averageDailySales,
      daysWithSales,
      salesFrequency,
      daysUntilStockout,
      estimatedStockoutDate,
      stockoutRisk: risk,
      suggestedReorderQty,
      suggestedReorderTargetDays: targetBufferDays,
      estimatedReorderCost: estimatedCost,
      recommendedSupplierId: suppInfo?.supplierId || suppliers[0]?.id,
      recommendedSupplierName: suppInfo?.supplierName || suppliers[0]?.name || 'Supplier Terdaftar',
      aiInsight: insight,
      seasonalityOrTrend
    };
  });

  // Sort: CRITICAL first, then WARNING, then by daysUntilStockout ascending
  forecasts.sort((a, b) => {
    const riskPriority = { CRITICAL: 0, WARNING: 1, HEALTHY: 2, STAGNANT: 3 };
    if (riskPriority[a.stockoutRisk] !== riskPriority[b.stockoutRisk]) {
      return riskPriority[a.stockoutRisk] - riskPriority[b.stockoutRisk];
    }
    return a.daysUntilStockout - b.daysUntilStockout;
  });

  return {
    totalSkus: products.length,
    criticalCount,
    warningCount,
    healthyCount,
    stagnantCount,
    forecasts,
    analyzedStartDate: windowStartStr,
    analyzedEndDate: todayStr,
    totalEstimatedReorderBudget
  };
}
