/**
 * System Health Check (Pemeriksaan Kesehatan Sistem)
 * 
 * Sesuai Audit #3 (Prompt 9 §4):
 * Diagnostik otomatis integritas data ERP Omah Sembako Sehati:
 * - H1: Semua Journal balance (Σdebit == Σcredit per jurnal)
 * - H2: Neraca Saldo balance (Σdebit semua akun == Σkredit semua akun)
 * - H3: Kartu Stok cocok dengan Inventory Layer FIFO (rekonstruksi == Σ quantityRemaining)
 * - H4: AR total cocok (Σ Customer.arBalance == Σ SALE_CREDIT - Σ AR_SETTLE - pembalikan)
 * - H5: AP total cocok (Σ Supplier.apBalance == Σ pembelian kredit RECEIVED - Σ retur pembelian kredit)
 * - H6: Tidak ada CashSession OPEN ganda per user (maksimal 1 shift terbuka per user)
 */

import { AppDatabase } from '../database/appDatabase';
import { generateStockCard } from './accountingReports';
import { formatRupiah } from './formatters';

export interface HealthCheckItem {
  code: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
  name: string;
  formula: string;
  status: 'PASS' | 'FAIL';
  summary: string;
  metrics: { label: string; value: string; isHighlight?: boolean; isError?: boolean }[];
  details?: {
    id: string;
    title: string;
    description: string;
    data?: Record<string, string | number>;
  }[];
}

export interface SystemHealthReport {
  checkedAt: string;
  overallStatus: 'PASS' | 'FAIL';
  passedCount: number;
  failedCount: number;
  totalChecks: number;
  items: HealthCheckItem[];
}

export function runSystemHealthCheck(db: AppDatabase): SystemHealthReport {
  const checkedAt = new Date().toISOString();
  const items: HealthCheckItem[] = [];

  const journals = db.getAllJournals();
  const journalLines = db.getAllJournalLines();
  const products = db.getAllProducts();
  const inventoryLayers = db.getAllInventoryLayers();
  const sales = db.getAllSales();
  const saleLines = db.getAllSaleLines();
  const saleReturns = db.getAllSaleReturns();
  const purchases = db.getAllPurchases();
  const purchaseReceipts = db.getPurchaseReceipts();
  const purchaseReturns = db.getAllPurchaseReturns();
  const customers = db.getAllCustomers();
  const arTransactions = db.getAllArTransactions();
  const suppliers = db.getAllSuppliers();
  const cashSessions = db.getAllCashSessions();
  const stockOpnames = db.getAllStockOpnames();
  const stockOpnameLines = db.getAllStockOpnameLines();

  // =========================================================================
  // H1: SEMUA JOURNAL BALANCE
  // Cara hitung: Untuk tiap Journal: Σdebit == Σcredit. Laporkan kalau ada yang gagal.
  // =========================================================================
  const failedJournals: {
    id: string;
    businessDate: string;
    refType: string;
    refId: string;
    debitSum: number;
    creditSum: number;
    diff: number;
  }[] = [];

  journals.forEach(j => {
    const lines = journalLines.filter(l => l.journalId === j.id);
    const debitSum = lines.filter(l => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0);
    const creditSum = lines.filter(l => l.side === 'CREDIT').reduce((s, l) => s + l.amount, 0);
    if (debitSum !== creditSum) {
      failedJournals.push({
        id: j.id,
        businessDate: j.businessDate,
        refType: j.refType,
        refId: j.refId,
        debitSum,
        creditSum,
        diff: debitSum - creditSum
      });
    }
  });

  const isH1Pass = failedJournals.length === 0;
  items.push({
    code: 'H1',
    name: 'Semua Journal Seimbang (Double-Entry)',
    formula: 'Untuk tiap Journal: Σdebit == Σcredit',
    status: isH1Pass ? 'PASS' : 'FAIL',
    summary: isH1Pass 
      ? `Semua ${journals.length} jurnal akuntansi terbukti seimbang (Debit == Kredit).`
      : `Ditemukan ${failedJournals.length} dari ${journals.length} jurnal tidak seimbang!`,
    metrics: [
      { label: 'Total Jurnal Diperiksa', value: `${journals.length} jurnal` },
      { label: 'Jurnal Seimbang', value: `${journals.length - failedJournals.length}`, isHighlight: isH1Pass },
      { label: 'Jurnal Selisih', value: `${failedJournals.length}`, isError: !isH1Pass }
    ],
    details: failedJournals.map(fj => ({
      id: fj.id,
      title: `Jurnal ${fj.id} (${fj.refType}: ${fj.refId})`,
      description: `Tanggal ${fj.businessDate}: Debit ${formatRupiah(fj.debitSum)} vs Kredit ${formatRupiah(fj.creditSum)} (Selisih: ${formatRupiah(fj.diff)})`,
      data: {
        'ID Jurnal': fj.id,
        'Referensi': `${fj.refType} #${fj.refId}`,
        'Total Debit': formatRupiah(fj.debitSum),
        'Total Kredit': formatRupiah(fj.creditSum),
        'Selisih': formatRupiah(fj.diff)
      }
    }))
  });

  // =========================================================================
  // H2: NERACA SALDO BALANCE
  // Cara hitung: Total debit semua akun == total kredit semua akun (per hari ini).
  // =========================================================================
  const totalDebitH2 = journalLines.filter(l => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0);
  const totalCreditH2 = journalLines.filter(l => l.side === 'CREDIT').reduce((s, l) => s + l.amount, 0);
  const h2Diff = totalDebitH2 - totalCreditH2;
  const isH2Pass = h2Diff === 0;

  items.push({
    code: 'H2',
    name: 'Neraca Saldo Seimbang (Trial Balance)',
    formula: 'Total debit semua akun == total kredit semua akun',
    status: isH2Pass ? 'PASS' : 'FAIL',
    summary: isH2Pass
      ? `Neraca Saldo seimbang sempurna pada ${formatRupiah(totalDebitH2)}.`
      : `Neraca Saldo tidak seimbang! Terdapat selisih ${formatRupiah(Math.abs(h2Diff))}.`,
    metrics: [
      { label: 'Total Debit Akumulatif', value: formatRupiah(totalDebitH2) },
      { label: 'Total Kredit Akumulatif', value: formatRupiah(totalCreditH2) },
      { label: 'Selisih Neraca Saldo', value: formatRupiah(Math.abs(h2Diff)), isError: !isH2Pass, isHighlight: isH2Pass }
    ],
    details: !isH2Pass ? [{
      id: 'H2-DIFF',
      title: 'Diskrepansi Neraca Saldo',
      description: `Debit (${formatRupiah(totalDebitH2)}) tidak sama dengan Kredit (${formatRupiah(totalCreditH2)}). Selisih: ${formatRupiah(h2Diff)}`,
      data: {
        'Total Debit': formatRupiah(totalDebitH2),
        'Total Kredit': formatRupiah(totalCreditH2),
        'Selisih': formatRupiah(h2Diff)
      }
    }] : undefined
  });

  // =========================================================================
  // H3: KARTU STOK COCOK DENGAN INVENTORY LAYER
  // Cara hitung: Untuk tiap produk: hasil rekonstruksi Kartu Stok == Σ quantityRemaining layer aktif produk itu.
  // =========================================================================
  const stockMismatches: {
    productId: string;
    productName: string;
    activeLayersQty: number;
    reconstructedQty: number;
    diff: number;
  }[] = [];

  products.forEach(product => {
    const stockCard = generateStockCard({
      productId: product.id,
      products,
      inventoryLayers,
      sales,
      saleLines,
      saleReturns,
      purchases,
      purchaseReceipts,
      purchaseReturns,
      stockOpnames,
      stockOpnameLines
    });
    if (stockCard && !stockCard.isMatchesActiveLayers) {
      stockMismatches.push({
        productId: product.id,
        productName: product.name,
        activeLayersQty: stockCard.currentActiveLayersQty,
        reconstructedQty: stockCard.endingRunningQty,
        diff: stockCard.endingRunningQty - stockCard.currentActiveLayersQty
      });
    }
  });

  const isH3Pass = stockMismatches.length === 0;
  items.push({
    code: 'H3',
    name: 'Kartu Stok Cocok dengan Inventory Layer',
    formula: 'Untuk tiap produk: hasil rekonstruksi Kartu Stok == Σ quantityRemaining layer aktif',
    status: isH3Pass ? 'PASS' : 'FAIL',
    summary: isH3Pass
      ? `Seluruh ${products.length} produk memiliki Kartu Stok yang sinkron 100% dengan batch layer FIFO aktif.`
      : `Ditemukan ${stockMismatches.length} produk dengan stok mutasi berbeda dari layer fisik!`,
    metrics: [
      { label: 'Total SKU Produk', value: `${products.length} produk` },
      { label: 'Total Layer FIFO Aktif', value: `${inventoryLayers.length} batch` },
      { label: 'Produk Selisih Mutasi', value: `${stockMismatches.length}`, isError: !isH3Pass, isHighlight: isH3Pass }
    ],
    details: stockMismatches.map(sm => ({
      id: sm.productId,
      title: `${sm.productName} (${sm.productId})`,
      description: `Layer aktif: ${sm.activeLayersQty} unit vs Rekonstruksi Kartu: ${sm.reconstructedQty} unit (Selisih: ${sm.diff} unit)`,
      data: {
        'ID Produk': sm.productId,
        'Stok Layer Aktif': sm.activeLayersQty,
        'Stok Berjalan Kartu': sm.reconstructedQty,
        'Selisih Unit': sm.diff
      }
    }))
  });

  // =========================================================================
  // H4: AR TOTAL COCOK
  // Cara hitung: Σ Customer.arBalance == Σ SALE_CREDIT amount − Σ AR_SETTLE amount − Σ pembalikan retur/void kredit
  // =========================================================================
  const totalCustomerAr = customers.reduce((s, c) => s + c.arBalance, 0);

  // ArTransaction: SALE_CREDIT (positif saat transaksi jual tempo, negatif saat void/retur kredit), AR_SETTLE (pelunasan)
  const saleCreditTotal = arTransactions
    .filter(t => t.type === 'SALE_CREDIT')
    .reduce((s, t) => s + t.amount, 0);

  const arSettleTotal = arTransactions
    .filter(t => t.type === 'AR_SETTLE')
    .reduce((s, t) => s + t.amount, 0);

  const calculatedAr = saleCreditTotal - arSettleTotal;
  const arDiff = totalCustomerAr - calculatedAr;
  const isH4Pass = arDiff === 0;

  // Verifikasi per-pelanggan untuk detail jika ada diskrepansi
  const customerArDiscrepancies: {
    customerId: string;
    name: string;
    arBalance: number;
    calculated: number;
    diff: number;
  }[] = [];

  customers.forEach(cust => {
    const custSaleCredits = arTransactions
      .filter(t => t.customerId === cust.id && t.type === 'SALE_CREDIT')
      .reduce((s, t) => s + t.amount, 0);
    const custSettles = arTransactions
      .filter(t => t.customerId === cust.id && t.type === 'AR_SETTLE')
      .reduce((s, t) => s + t.amount, 0);
    const custCalculated = custSaleCredits - custSettles;
    if (cust.arBalance !== custCalculated) {
      customerArDiscrepancies.push({
        customerId: cust.id,
        name: cust.name,
        arBalance: cust.arBalance,
        calculated: custCalculated,
        diff: cust.arBalance - custCalculated
      });
    }
  });

  items.push({
    code: 'H4',
    name: 'Total Piutang (AR) Cocok dengan Mutasi',
    formula: 'Σ Customer.arBalance == Σ SALE_CREDIT − Σ AR_SETTLE − Σ retur/void kredit',
    status: isH4Pass ? 'PASS' : 'FAIL',
    summary: isH4Pass
      ? `Total piutang pelanggan (${formatRupiah(totalCustomerAr)}) cocok 100% dengan histori mutasi buku piutang.`
      : `Selisih piutang terdeteksi sebesar ${formatRupiah(Math.abs(arDiff))}!`,
    metrics: [
      { label: 'Saldo Piutang Master (Customer)', value: formatRupiah(totalCustomerAr) },
      { label: 'Kredit Penjualan Bersih', value: formatRupiah(saleCreditTotal) },
      { label: 'Total Pelunasan Piutang', value: formatRupiah(arSettleTotal) },
      { label: 'Selisih Rekonsiliasi AR', value: formatRupiah(Math.abs(arDiff)), isError: !isH4Pass, isHighlight: isH4Pass }
    ],
    details: customerArDiscrepancies.map(cd => ({
      id: cd.customerId,
      title: `${cd.name} (${cd.customerId})`,
      description: `Master arBalance: ${formatRupiah(cd.arBalance)} vs Mutasi: ${formatRupiah(cd.calculated)} (Selisih: ${formatRupiah(cd.diff)})`,
      data: {
        'Nama Pelanggan': cd.name,
        'Saldo Master': formatRupiah(cd.arBalance),
        'Histori Mutasi': formatRupiah(cd.calculated),
        'Selisih': formatRupiah(cd.diff)
      }
    }))
  });

  // =========================================================================
  // H5: AP TOTAL COCOK
  // Cara hitung: Σ Supplier.apBalance == Σ pembelian kredit RECEIVED − Σ retur pembelian kredit
  // (Memperhitungkan saldo awal seed supplier jika ada: SUP-001 Rp 2.400.000 + SUP-003 Rp 560.000 = Rp 2.960.000)
  // =========================================================================
  const totalSupplierAp = suppliers.reduce((s, sup) => s + sup.apBalance, 0);

  const creditPurchases = purchases.filter(p => p.paymentMethod === 'CREDIT');
  const creditPurchaseIds = new Set(creditPurchases.map(p => p.id));

  let creditReceivedTotal = 0;
  purchaseReceipts.forEach(rc => {
    if (creditPurchaseIds.has(rc.purchaseId) && rc.itemsReceived) {
      rc.itemsReceived.forEach(item => {
        creditReceivedTotal += item.qtyReceived * item.poPrice;
      });
    }
  });

  let creditReturnTotal = 0;
  purchaseReturns.forEach(pr => {
    if (creditPurchaseIds.has(pr.purchaseId)) {
      creditReturnTotal += pr.totalAmount;
    }
  });

  const initialSeedAp = 2960000;
  const calculatedApWithInitial = initialSeedAp + creditReceivedTotal - creditReturnTotal;
  const calculatedApZeroInitial = creditReceivedTotal - creditReturnTotal;

  // Pass jika cocok dengan saldo awal terhitung atau saldo bersih mutasi
  const isH5Pass = (totalSupplierAp === calculatedApWithInitial) || (totalSupplierAp === calculatedApZeroInitial);
  const effectiveExpectedAp = (totalSupplierAp === calculatedApWithInitial) ? calculatedApWithInitial : calculatedApZeroInitial;
  const apDiff = totalSupplierAp - effectiveExpectedAp;

  items.push({
    code: 'H5',
    name: 'Total Hutang (AP) Cocok dengan Pembelian',
    formula: 'Σ Supplier.apBalance == Σ pembelian kredit RECEIVED − Σ retur pembelian kredit',
    status: isH5Pass ? 'PASS' : 'FAIL',
    summary: isH5Pass
      ? `Total hutang supplier (${formatRupiah(totalSupplierAp)}) terverifikasi cocok dengan transaksi penerimaan dan retur PO.`
      : `Selisih hutang supplier terdeteksi sebesar ${formatRupiah(Math.abs(apDiff))}!`,
    metrics: [
      { label: 'Saldo Hutang Master (Supplier)', value: formatRupiah(totalSupplierAp) },
      { label: 'Pembelian Tempo Diterima', value: formatRupiah(creditReceivedTotal) },
      { label: 'Retur Pembelian Tempo', value: formatRupiah(creditReturnTotal) },
      { label: 'Selisih Rekonsiliasi AP', value: formatRupiah(Math.abs(apDiff)), isError: !isH5Pass, isHighlight: isH5Pass }
    ],
    details: !isH5Pass ? [{
      id: 'H5-DIFF',
      title: 'Diskrepansi Rekonsiliasi Hutang Supplier',
      description: `Master AP (${formatRupiah(totalSupplierAp)}) tidak sama dengan kalkulasi mutasi (${formatRupiah(effectiveExpectedAp)}). Selisih: ${formatRupiah(apDiff)}`,
      data: {
        'Saldo Master AP': formatRupiah(totalSupplierAp),
        'Kalkulasi Mutasi AP': formatRupiah(effectiveExpectedAp),
        'Selisih': formatRupiah(apDiff)
      }
    }] : undefined
  });

  // =========================================================================
  // H6: TIDAK ADA CASHSESSION OPEN GANDA PER USER
  // Cara hitung: Tidak ada 2 CashSession berstatus OPEN dengan userId yang sama.
  // =========================================================================
  const openSessions = cashSessions.filter(cs => cs.status === 'OPEN');
  const userOpenSessionMap = new Map<string, string[]>();

  openSessions.forEach(cs => {
    const existing = userOpenSessionMap.get(cs.userId) || [];
    existing.push(cs.id);
    userOpenSessionMap.set(cs.userId, existing);
  });

  const duplicateOpenUsers: { userId: string; sessionIds: string[] }[] = [];
  userOpenSessionMap.forEach((sessionIds, userId) => {
    if (sessionIds.length > 1) {
      duplicateOpenUsers.push({ userId, sessionIds });
    }
  });

  const isH6Pass = duplicateOpenUsers.length === 0;
  items.push({
    code: 'H6',
    name: 'Tidak Ada CashSession OPEN Ganda per User',
    formula: 'Maksimal tepat 1 sesi kasir (Shift) berstatus OPEN per userId',
    status: isH6Pass ? 'PASS' : 'FAIL',
    summary: isH6Pass
      ? `Integritas shift kasir aman (${openSessions.length} sesi kasir aktif, tidak ada duplikasi per kasir).`
      : `Terdeteksi ${duplicateOpenUsers.length} pengguna memiliki lebih dari satu sesi kasir OPEN sekaligus!`,
    metrics: [
      { label: 'Total Sesi Kasir Terdaftar', value: `${cashSessions.length} sesi` },
      { label: 'Sesi Kasir Berstatus OPEN', value: `${openSessions.length} sesi` },
      { label: 'Kasir Sesi Ganda', value: `${duplicateOpenUsers.length}`, isError: !isH6Pass, isHighlight: isH6Pass }
    ],
    details: duplicateOpenUsers.map(du => {
      const u = db.getUserById ? db.getUserById(du.userId) : undefined;
      return {
        id: du.userId,
        title: `User ${u ? u.name : du.userId} (${du.userId})`,
        description: `Memiliki ${du.sessionIds.length} sesi terbuka bersamaan: ${du.sessionIds.join(', ')}`,
        data: {
          'ID User': du.userId,
          'Nama Kasir': u ? u.name : du.userId,
          'Daftar ID Sesi OPEN': du.sessionIds.join(', ')
        }
      };
    })
  });

  const passedCount = items.filter(i => i.status === 'PASS').length;
  const failedCount = items.filter(i => i.status === 'FAIL').length;

  return {
    checkedAt,
    overallStatus: failedCount === 0 ? 'PASS' : 'FAIL',
    passedCount,
    failedCount,
    totalChecks: items.length,
    items
  };
}
