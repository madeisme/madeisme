/**
 * OMAH SEMBAKO SEHATI — LAPORAN KEUANGAN & STOK (PROMPT 6)
 * 
 * Aturan Dasar:
 * - READ-ONLY: Tidak membuat, mengubah, atau membalik data apa pun.
 * - Resolusi saldo normal dari Account.type.
 * - Integer Rupiah (Long/Math.round), tanpa desimal.
 */

import {
  Account,
  AccountType,
  Journal,
  JournalLine,
  Product,
  InventoryLayer,
  Sale,
  SaleLine,
  SaleReturn,
  Purchase,
  PurchaseLine,
  PurchaseReceipt,
  PurchaseReturn,
  StockOpname,
  StockOpnameLine,
  StockTransfer,
  StockTransferLine
} from '../types/erp';

// ==========================================
// 1. SALDO NORMAL (NORMAL BALANCE) RESOLUTION
// ==========================================

export type NormalBalanceSide = 'DEBIT' | 'CREDIT';

export function getAccountNormalBalance(type: AccountType): NormalBalanceSide {
  switch (type) {
    case 'ASET':
    case 'BEBAN':
    case 'KONTRA-PENDAPATAN':
      return 'DEBIT';
    case 'LIABILITAS':
    case 'EKUITAS':
    case 'PENDAPATAN':
      return 'CREDIT';
    default:
      return 'DEBIT';
  }
}

/**
 * Menghitung saldo akun dari akumulasi debit dan kredit
 * berdasarkan aturan §2:
 * ASET, BEBAN, KONTRA-PENDAPATAN: debit - credit
 * LIABILITAS, EKUITAS, PENDAPATAN: credit - debit
 */
export function computeAccountBalance(type: AccountType, debit: number, credit: number): number {
  const normal = getAccountNormalBalance(type);
  return normal === 'DEBIT' ? (debit - credit) : (credit - debit);
}

// ==========================================
// 2. BUKU BESAR (GENERAL LEDGER) — §3
// ==========================================

export interface GeneralLedgerRow {
  journalLineId: string;
  journalId: string;
  businessDate: string;
  refType: string;
  refId: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  journal: Journal;
  counterpartLines: JournalLine[];
}

export interface GeneralLedgerReportData {
  account: Account;
  startDate: string;
  endDate: string;
  openingDebit: number;
  openingCredit: number;
  openingBalance: number;
  rows: GeneralLedgerRow[];
  totalPeriodDebit: number;
  totalPeriodCredit: number;
  closingBalance: number;
}

export function generateGeneralLedger(params: {
  accountCode: string;
  startDate: string;
  endDate: string;
  accounts: Account[];
  journals: Journal[];
  journalLines: JournalLine[];
  sales?: Sale[];
  purchases?: Purchase[];
}): GeneralLedgerReportData | null {
  const { accountCode, startDate, endDate, accounts, journals, journalLines, sales = [], purchases = [] } = params;
  const account = accounts.find(a => a.code === accountCode);
  if (!account) return null;

  const normalSide = getAccountNormalBalance(account.type);

  // Peta Journal lookup by id
  const journalMap = new Map<string, Journal>();
  journals.forEach(j => journalMap.set(j.id, j));

  // Peta all lines grouped by journalId
  const linesByJournal = new Map<string, JournalLine[]>();
  journalLines.forEach(jl => {
    const list = linesByJournal.get(jl.journalId) || [];
    list.push(jl);
    linesByJournal.set(jl.journalId, list);
  });

  // Saldo Awal (sebelum startDate)
  let openingDebit = 0;
  let openingCredit = 0;

  journalLines.forEach(line => {
    if (line.accountCode !== accountCode) return;
    const journal = journalMap.get(line.journalId);
    if (!journal) return;

    if (journal.businessDate < startDate) {
      if (line.side === 'DEBIT') {
        openingDebit += line.amount;
      } else {
        openingCredit += line.amount;
      }
    }
  });

  const openingBalance = computeAccountBalance(account.type, openingDebit, openingCredit);

  // Baris dalam rentang tanggal
  const periodLines: { line: JournalLine; journal: Journal }[] = [];
  journalLines.forEach(line => {
    if (line.accountCode !== accountCode) return;
    const journal = journalMap.get(line.journalId);
    if (!journal) return;

    if (journal.businessDate >= startDate && journal.businessDate <= endDate) {
      periodLines.push({ line, journal });
    }
  });

  // Urutkan berdasarkan businessDate ASC, lalu journalId
  periodLines.sort((a, b) => {
    if (a.journal.businessDate !== b.journal.businessDate) {
      return a.journal.businessDate.localeCompare(b.journal.businessDate);
    }
    return a.journal.id.localeCompare(b.journal.id);
  });

  let currentBalance = openingBalance;
  let totalPeriodDebit = 0;
  let totalPeriodCredit = 0;

  const rows: GeneralLedgerRow[] = periodLines.map(({ line, journal }) => {
    const isDebit = line.side === 'DEBIT';
    const debit = isDebit ? line.amount : 0;
    const credit = !isDebit ? line.amount : 0;

    totalPeriodDebit += debit;
    totalPeriodCredit += credit;

    if (normalSide === 'DEBIT') {
      currentBalance += (debit - credit);
    } else {
      currentBalance += (credit - debit);
    }

    // Deskripsi informatif berdasarkan refType
    let description = `${journal.refType} #${journal.refId}`;
    if (journal.refType === 'SALE') {
      const sale = sales.find(s => s.id === journal.refId);
      description = sale 
        ? `Penjualan Kasir (${sale.paymentMethod === 'CASH' ? 'Tunai' : 'Kredit/Tempo'})`
        : 'Penjualan Kasir';
    } else if (journal.refType === 'PURCHASE') {
      const po = purchases.find(p => p.id === journal.refId);
      description = po
        ? `Penerimaan Pembelian (${po.paymentMethod === 'CASH' ? 'Tunai' : 'Hutang AP'})`
        : 'Penerimaan Pembelian PO';
    } else if (journal.refType === 'RETURN_SALE') {
      description = 'Retur Penjualan Barang Pelanggan';
    } else if (journal.refType === 'RETURN_PURCHASE') {
      description = 'Retur Pembelian Barang ke Supplier';
    } else if (journal.refType === 'VOID_SALE') {
      description = 'Void / Pembatalan Nota Penjualan';
    } else if (journal.refType === 'AR_SETTLE') {
      description = 'Penerimaan Pelunasan Piutang Pelanggan';
    }

    const allLinesForJournal = linesByJournal.get(journal.id) || [];
    const counterpartLines = allLinesForJournal.filter(l => l.id !== line.id);

    return {
      journalLineId: line.id,
      journalId: journal.id,
      businessDate: journal.businessDate,
      refType: journal.refType,
      refId: journal.refId,
      description,
      debit,
      credit,
      runningBalance: currentBalance,
      journal,
      counterpartLines
    };
  });

  return {
    account,
    startDate,
    endDate,
    openingDebit,
    openingCredit,
    openingBalance,
    rows,
    totalPeriodDebit,
    totalPeriodCredit,
    closingBalance: currentBalance
  };
}

// ==========================================
// 3. NERACA SALDO (TRIAL BALANCE) — §4
// ==========================================

export interface TrialBalanceItem {
  account: Account;
  cumulativeDebit: number;
  cumulativeCredit: number;
  endingDebit: number;
  endingCredit: number;
  netBalance: number;
}

export interface TrialBalanceReportData {
  asOfDate: string;
  items: TrialBalanceItem[];
  totalCumulativeDebit: number;
  totalCumulativeCredit: number;
  totalEndingDebit: number;
  totalEndingCredit: number;
  isBalanced: boolean;
  discrepancy: number;
}

export function generateTrialBalance(params: {
  asOfDate: string;
  accounts: Account[];
  journals: Journal[];
  journalLines: JournalLine[];
}): TrialBalanceReportData {
  const { asOfDate, accounts, journals, journalLines } = params;

  // Filter jurnal <= asOfDate
  const validJournalIds = new Set<string>();
  journals.forEach(j => {
    if (j.businessDate <= asOfDate) {
      validJournalIds.add(j.id);
    }
  });

  const debitMap = new Map<string, number>();
  const creditMap = new Map<string, number>();

  journalLines.forEach(line => {
    if (!validJournalIds.has(line.journalId)) return;
    if (line.side === 'DEBIT') {
      debitMap.set(line.accountCode, (debitMap.get(line.accountCode) || 0) + line.amount);
    } else {
      creditMap.set(line.accountCode, (creditMap.get(line.accountCode) || 0) + line.amount);
    }
  });

  let totalCumulativeDebit = 0;
  let totalCumulativeCredit = 0;
  let totalEndingDebit = 0;
  let totalEndingCredit = 0;

  const items: TrialBalanceItem[] = accounts.map(account => {
    const cumulativeDebit = debitMap.get(account.code) || 0;
    const cumulativeCredit = creditMap.get(account.code) || 0;
    totalCumulativeDebit += cumulativeDebit;
    totalCumulativeCredit += cumulativeCredit;

    const normal = getAccountNormalBalance(account.type);
    let endingDebit = 0;
    let endingCredit = 0;
    let netBalance = 0;

    if (normal === 'DEBIT') {
      netBalance = cumulativeDebit - cumulativeCredit;
      if (netBalance >= 0) {
        endingDebit = netBalance;
      } else {
        endingCredit = Math.abs(netBalance);
      }
    } else {
      netBalance = cumulativeCredit - cumulativeDebit;
      if (netBalance >= 0) {
        endingCredit = netBalance;
      } else {
        endingDebit = Math.abs(netBalance);
      }
    }

    totalEndingDebit += endingDebit;
    totalEndingCredit += endingCredit;

    return {
      account,
      cumulativeDebit,
      cumulativeCredit,
      endingDebit,
      endingCredit,
      netBalance
    };
  });

  const isBalanced = totalCumulativeDebit === totalCumulativeCredit && totalEndingDebit === totalEndingCredit;
  const discrepancy = Math.abs(totalCumulativeDebit - totalCumulativeCredit);

  return {
    asOfDate,
    items,
    totalCumulativeDebit,
    totalCumulativeCredit,
    totalEndingDebit,
    totalEndingCredit,
    isBalanced,
    discrepancy
  };
}

// ==========================================
// 4. LABA RUGI (PROFIT & LOSS) — §5
// ==========================================

export interface ProfitLossAccountRow {
  account: Account;
  amount: number; // Saldo normal pada periode tersebut
}

export interface ProfitLossReportData {
  startDate: string;
  endDate: string;
  grossRevenueRows: ProfitLossAccountRow[];
  grossRevenue: number;
  salesDiscountRows: ProfitLossAccountRow[];
  salesDiscounts: number;
  netRevenue: number;
  cogsRows: ProfitLossAccountRow[];
  cogs: number;
  grossProfit: number;
  otherExpenseRows: ProfitLossAccountRow[];
  otherExpenses: number;
  netProfit: number;
}

export function generateProfitAndLoss(params: {
  startDate: string;
  endDate: string;
  accounts: Account[];
  journals: Journal[];
  journalLines: JournalLine[];
}): ProfitLossReportData {
  const { startDate, endDate, accounts, journals, journalLines } = params;

  // Filter journals in period [startDate, endDate]
  const periodJournalIds = new Set<string>();
  journals.forEach(j => {
    if (j.businessDate >= startDate && j.businessDate <= endDate) {
      periodJournalIds.add(j.id);
    }
  });

  // Calculate debit and credit per account in period
  const debitMap = new Map<string, number>();
  const creditMap = new Map<string, number>();

  journalLines.forEach(line => {
    if (!periodJournalIds.has(line.journalId)) return;
    if (line.side === 'DEBIT') {
      debitMap.set(line.accountCode, (debitMap.get(line.accountCode) || 0) + line.amount);
    } else {
      creditMap.set(line.accountCode, (creditMap.get(line.accountCode) || 0) + line.amount);
    }
  });

  const grossRevenueRows: ProfitLossAccountRow[] = [];
  let grossRevenue = 0;

  const salesDiscountRows: ProfitLossAccountRow[] = [];
  let salesDiscounts = 0;

  const cogsRows: ProfitLossAccountRow[] = [];
  let cogs = 0;

  const otherExpenseRows: ProfitLossAccountRow[] = [];
  let otherExpenses = 0;

  accounts.forEach(account => {
    const dr = debitMap.get(account.code) || 0;
    const cr = creditMap.get(account.code) || 0;
    const balance = computeAccountBalance(account.type, dr, cr);

    if (account.type === 'PENDAPATAN') {
      grossRevenueRows.push({ account, amount: balance });
      grossRevenue += balance;
    } else if (account.type === 'KONTRA-PENDAPATAN') {
      salesDiscountRows.push({ account, amount: balance });
      salesDiscounts += balance;
    } else if (account.type === 'BEBAN') {
      // 5110 = HPP (Harga Pokok Penjualan)
      if (account.code === '5110') {
        cogsRows.push({ account, amount: balance });
        cogs += balance;
      } else {
        // 5910 (SELISIH_KAS) atau beban operasional lainnya
        otherExpenseRows.push({ account, amount: balance });
        otherExpenses += balance;
      }
    }
  });

  const netRevenue = grossRevenue - salesDiscounts;
  const grossProfit = netRevenue - cogs;
  const netProfit = grossProfit - otherExpenses;

  return {
    startDate,
    endDate,
    grossRevenueRows,
    grossRevenue,
    salesDiscountRows,
    salesDiscounts,
    netRevenue,
    cogsRows,
    cogs,
    grossProfit,
    otherExpenseRows,
    otherExpenses,
    netProfit
  };
}

// ==========================================
// 5. NERACA (BALANCE SHEET) — §6
// ==========================================

export interface BalanceSheetAccountRow {
  account: Account;
  balance: number;
}

export interface BalanceSheetReportData {
  asOfDate: string;
  assetRows: BalanceSheetAccountRow[];
  totalAssets: number;
  liabilityRows: BalanceSheetAccountRow[];
  totalLiabilities: number;
  equityBalancingFigure: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export function generateBalanceSheet(params: {
  asOfDate: string;
  accounts: Account[];
  journals: Journal[];
  journalLines: JournalLine[];
}): BalanceSheetReportData {
  const { asOfDate, accounts, journals, journalLines } = params;

  // Filter journals <= asOfDate
  const validJournalIds = new Set<string>();
  journals.forEach(j => {
    if (j.businessDate <= asOfDate) {
      validJournalIds.add(j.id);
    }
  });

  const debitMap = new Map<string, number>();
  const creditMap = new Map<string, number>();

  journalLines.forEach(line => {
    if (!validJournalIds.has(line.journalId)) return;
    if (line.side === 'DEBIT') {
      debitMap.set(line.accountCode, (debitMap.get(line.accountCode) || 0) + line.amount);
    } else {
      creditMap.set(line.accountCode, (creditMap.get(line.accountCode) || 0) + line.amount);
    }
  });

  const assetRows: BalanceSheetAccountRow[] = [];
  let totalAssets = 0;

  const liabilityRows: BalanceSheetAccountRow[] = [];
  let totalLiabilities = 0;

  accounts.forEach(account => {
    const dr = debitMap.get(account.code) || 0;
    const cr = creditMap.get(account.code) || 0;
    const balance = computeAccountBalance(account.type, dr, cr);

    if (account.type === 'ASET') {
      assetRows.push({ account, balance });
      totalAssets += balance;
    } else if (account.type === 'LIABILITAS') {
      liabilityRows.push({ account, balance });
      totalLiabilities += balance;
    }
  });

  // §6: EKUITAS = ASET - LIABILITAS (angka pengimbang matematis untuk MVP)
  const equityBalancingFigure = totalAssets - totalLiabilities;
  const totalLiabilitiesAndEquity = totalLiabilities + equityBalancingFigure;
  const isBalanced = totalAssets === totalLiabilitiesAndEquity;

  return {
    asOfDate,
    assetRows,
    totalAssets,
    liabilityRows,
    totalLiabilities,
    equityBalancingFigure,
    totalLiabilitiesAndEquity,
    isBalanced
  };
}

// ==========================================
// 6. KARTU STOK (STOCK CARD) — §7
// ==========================================

export interface StockCardMovement {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  refNumber: string;
  description: string;
  location?: string;
  qtyIn: number;
  qtyOut: number;
  unitCost: number;
  totalCost: number;
  runningQty: number;
}

export interface StockCardReportData {
  product: Product;
  movements: StockCardMovement[];
  totalQtyIn: number;
  totalQtyOut: number;
  endingRunningQty: number;
  currentActiveLayersQty: number;
  isMatchesActiveLayers: boolean;
}

export function generateStockCard(params: {
  productId: string;
  products: Product[];
  inventoryLayers: InventoryLayer[];
  sales: Sale[];
  saleLines: SaleLine[];
  saleReturns: SaleReturn[];
  purchases: Purchase[];
  purchaseReceipts: PurchaseReceipt[];
  purchaseReturns: PurchaseReturn[];
  stockOpnames?: StockOpname[];
  stockOpnameLines?: StockOpnameLine[];
  stockTransfers?: StockTransfer[];
  stockTransferLines?: StockTransferLine[];
}): StockCardReportData | null {
  const {
    productId,
    products,
    inventoryLayers,
    sales,
    saleLines,
    saleReturns,
    purchases,
    purchaseReceipts,
    purchaseReturns,
    stockOpnames = [],
    stockOpnameLines = []
  } = params;

  const product = products.find(p => p.id === productId);
  if (!product) return null;

  // Active layers for this product
  const activeLayersForProduct = inventoryLayers.filter(l => l.productId === productId);
  const currentActiveLayersQty = activeLayersForProduct.reduce((sum, l) => sum + l.quantityRemaining, 0);

  // Reconstruct stock movements
  interface RawMovement {
    id: string;
    date: string;
    type: 'IN' | 'OUT';
    refNumber: string;
    description: string;
    location?: string;
    qty: number;
    unitCost: number;
  }

  const rawList: RawMovement[] = [];

  // 1. Purchase Receipts (IN)
  purchaseReceipts.forEach(receipt => {
    if (!receipt.itemsReceived) return;
    receipt.itemsReceived.forEach(item => {
      if (item.productId === productId && item.qtyReceived > 0) {
        rawList.push({
          id: `RC-${receipt.id}-${item.lineId}`,
          date: receipt.receivedAt || receipt.businessDate,
          type: 'IN',
          refNumber: `${receipt.id} (${receipt.purchaseId})`,
          description: `Penerimaan Barang PO (${receipt.receivedBy || 'Gudang'})`,
          location: 'GUDANG',
          qty: item.qtyReceived,
          unitCost: item.poPrice
        });
      }
    });
  });

  // 2. Sale Returns (IN)
  saleReturns.forEach(sr => {
    sr.items.forEach(item => {
      if (item.productId === productId && item.qtyReturned > 0) {
        const unitHpp = Math.round(item.returnHpp / item.qtyReturned);
        rawList.push({
          id: `SR-${sr.id}-${item.lineId}`,
          date: sr.createdAt,
          type: 'IN',
          refNumber: `${sr.id} (${sr.saleId})`,
          description: `Retur Pelanggan (${sr.reason || 'Barang Kembali'})`,
          location: 'TOKO',
          qty: item.qtyReturned,
          unitCost: unitHpp
        });
      }
    });
  });

  // 3. Sales committed (OUT)
  // Perhatikan: Sale REVERSED (void) dicatat OUT saat sale dan IN saat void, atau diabaikan keduanya jika void
  // Untuk transparansi penuh: Catat Sale OUT, dan jika REVERSED catat Void Restore IN!
  const saleMap = new Map<string, Sale>();
  sales.forEach(s => saleMap.set(s.id, s));

  saleLines.forEach(line => {
    if (line.productId !== productId) return;
    const sale = saleMap.get(line.saleId);
    if (!sale) return;

    // Catat penjualan
    const avgCost = line.qty > 0 ? Math.round(line.hppLine / line.qty) : 0;
    rawList.push({
      id: `SL-${line.id}`,
      date: sale.createdAt || `${sale.businessDate}T08:00:00Z`,
      type: 'OUT',
      refNumber: sale.id,
      description: `Penjualan Kasir (${sale.status === 'REVERSED' ? 'Dibatalkan/Void' : (sale.paymentMethod === 'CASH' ? 'Tunai' : 'Kredit')})`,
      location: 'TOKO',
      qty: line.qty,
      unitCost: avgCost
    });

    // Jika sale di-void (REVERSED), ada void restore (IN)
    if (sale.status === 'REVERSED') {
      rawList.push({
        id: `VOID-${sale.id}-${line.id}`,
        date: sale.createdAt || `${sale.businessDate}T08:05:00Z`,
        type: 'IN',
        refNumber: `VOID-${sale.id}`,
        description: 'Restorasi Stok dari Void Penjualan',
        location: 'TOKO',
        qty: line.qty,
        unitCost: avgCost
      });
    }
  });

  // 4. Purchase Returns to Supplier (OUT)
  purchaseReturns.forEach(pr => {
    pr.items.forEach(item => {
      if (item.productId === productId && item.qtyReturned > 0) {
        rawList.push({
          id: `PR-${pr.id}-${item.lineId}`,
          date: pr.createdAt,
          type: 'OUT',
          refNumber: `${pr.id} (${pr.purchaseId})`,
          description: `Retur Barang ke Supplier (${pr.reason || 'Cacat/Rusak'})`,
          location: 'GUDANG',
          qty: item.qtyReturned,
          unitCost: item.poPrice
        });
      }
    });
  });

  // 5. Stock Opnames Committed (Prompt 10: IN jika lebih, OUT jika kurang)
  stockOpnames.forEach(opn => {
    if (opn.status !== 'COMMITTED') return;
    const lines = stockOpnameLines.filter(l => l.opnameId === opn.id && l.productId === productId);
    lines.forEach(line => {
      const variance = line.varianceQty ?? (line.physicalQty - (line.systemQtyLive ?? 0));
      if (variance > 0) {
        rawList.push({
          id: `OPN-${opn.id}-${line.id}`,
          date: opn.committedAt || opn.createdAt,
          type: 'IN',
          refNumber: opn.id,
          description: `Stock Opname (Fisik Lebih) [${opn.location}]`,
          location: opn.location,
          qty: variance,
          unitCost: line.unitCostAvg || 0
        });
      } else if (variance < 0) {
        rawList.push({
          id: `OPN-${opn.id}-${line.id}`,
          date: opn.committedAt || opn.createdAt,
          type: 'OUT',
          refNumber: opn.id,
          description: `Stock Opname (Fisik Kurang) [${opn.location}]`,
          location: opn.location,
          qty: Math.abs(variance),
          unitCost: line.unitCostAvg || 0
        });
      }
    });
  });

  // 5. Initial Batch / Saldo Awal (IN)
  // Hitung initial seed layers untuk produk ini
  // Mathematical balance: ending running qty must equal currentActiveLayersQty
  const totalSubsequentIn = rawList.filter(r => r.type === 'IN').reduce((sum, r) => sum + r.qty, 0);
  const totalSubsequentOut = rawList.filter(r => r.type === 'OUT').reduce((sum, r) => sum + r.qty, 0);

  // Initial stock = currentActiveLayersQty + totalSubsequentOut - totalSubsequentIn
  const initialStockQty = currentActiveLayersQty + totalSubsequentOut - totalSubsequentIn;
  if (initialStockQty > 0) {
    // Cari cost dari layer paling awal
    const firstLayer = activeLayersForProduct[0];
    const initialCost = firstLayer ? firstLayer.unitCost : 0;
    const initialDate = firstLayer ? firstLayer.receivedAt : '2026-09-01T00:00:00Z';

    rawList.unshift({
      id: `INIT-${productId}`,
      date: initialDate,
      type: 'IN',
      refNumber: 'SALDO-AWAL',
      description: 'Saldo Awal Persediaan Toko',
      qty: initialStockQty,
      unitCost: initialCost
    });
  }

  // Sort chronological: date ASC
  rawList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningQty = 0;
  let totalQtyIn = 0;
  let totalQtyOut = 0;

  const movements: StockCardMovement[] = rawList.map(raw => {
    const isIncome = raw.type === 'IN';
    const qtyIn = isIncome ? raw.qty : 0;
    const qtyOut = !isIncome ? raw.qty : 0;

    totalQtyIn += qtyIn;
    totalQtyOut += qtyOut;
    runningQty = runningQty + qtyIn - qtyOut;

    return {
      id: raw.id,
      date: raw.date,
      type: raw.type,
      refNumber: raw.refNumber,
      description: raw.description,
      location: raw.location || 'GUDANG',
      qtyIn,
      qtyOut,
      unitCost: raw.unitCost,
      totalCost: raw.qty * raw.unitCost,
      runningQty
    };
  });

  const endingRunningQty = runningQty;
  const isMatchesActiveLayers = endingRunningQty === currentActiveLayersQty;

  return {
    product,
    movements,
    totalQtyIn,
    totalQtyOut,
    endingRunningQty,
    currentActiveLayersQty,
    isMatchesActiveLayers
  };
}
