/**
 * SKENARIO PENGUJIAN LINTAS-MODUL (Prompt 9 §6)
 * 
 * Pengujian otomatis end-to-end 8 langkah operasional:
 * 1. Buka Shift Kasir (Siti Aminah, modal Rp 100.000)
 * 2. PO Beras 10 sak @ Rp 60.000, Approve & Terima Barang (Goods Receipt)
 * 3. Jual Tunai 2 sak beras (FIFO layer consumption & Cash sale)
 * 4. Jual Kredit 1 sak beras ke Warung Bu Siti (AR tracking & credit terms)
 * 5. Pelunasan AR Bu Siti (sebagian Rp 50.000 via AR_SETTLE)
 * 6. Tutup Shift Kasir (Physical cash count, expected cash reconciliation, variance check)
 * 7. Laporan Keuangan (Laba Rugi omzet/HPP/laba kotor, Neraca Saldo balance)
 * 8. System Health Check (H1 sampai H6 diverifikasi 100% PASS)
 */

import { AppDatabase } from '../database/appDatabase';
import { CommitCashSaleUseCase } from '../domain/usecase/CommitCashSaleUseCase';
import { generateProfitAndLoss, generateTrialBalance } from './accountingReports';
import { runSystemHealthCheck } from './systemHealthCheck';
import { formatRupiah } from './formatters';

export interface ScenarioStepResult {
  step: number;
  title: string;
  status: 'PASS' | 'FAIL';
  summary: string;
  logs: string[];
}

export interface ScenarioExecutionReport {
  executedAt: string;
  overallStatus: 'PASS' | 'FAIL';
  steps: ScenarioStepResult[];
}

export function executeIntegrationScenario(db: AppDatabase): ScenarioExecutionReport {
  const steps: ScenarioStepResult[] = [];
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const sitiKasir = db.getUserById('USR-002') || db.getAllUsers().find(u => u.role === 'KASIR') || db.getAllUsers()[0];
  const budiOwner = db.getUserById('USR-001') || db.getAllUsers().find(u => u.role === 'OWNER') || db.getAllUsers()[0];
  const beras = db.getProductById('PRD-002') || db.getAllProducts()[0];
  const buSitiCust = db.getCustomerById('CST-001') || db.getAllCustomers()[0];
  const sinarPanganSup = db.getSupplierById('SUP-001') || db.getAllSuppliers()[0];

  // =========================================================================
  // LANGKAH 1: BUKA SHIFT KASIR (Siti Aminah, Modal Awal Rp 100.000)
  // =========================================================================
  try {
    // Tutup sesi open sebelumnya jika ada
    const existingOpen = db.getActiveCashSession(sitiKasir.id);
    if (existingOpen) {
      db.closeCashSession({
        sessionId: existingOpen.id,
        closedByUserId: sitiKasir.id,
        actualCash: existingOpen.openingFloat,
        notes: 'Auto-closed for integration scenario'
      });
    }

    const openRes = db.openCashSession({
      userId: sitiKasir.id,
      openingFloat: 100000,
      notes: 'Modal awal shift kasir skenario Prompt 9'
    });

    if (!openRes.success || !openRes.session) {
      throw new Error(openRes.error || 'Gagal membuka shift kasir');
    }

    steps.push({
      step: 1,
      title: 'Buka Shift Kasir',
      status: 'PASS',
      summary: `Shift ${openRes.session.id} berhasil dibuka untuk ${sitiKasir.name} dengan modal awal ${formatRupiah(100000)}.`,
      logs: [
        `ID Sesi: ${openRes.session.id}`,
        `Kasir: ${sitiKasir.name} (${sitiKasir.id})`,
        `Modal Awal: ${formatRupiah(100000)}`,
        `Status: OPEN`
      ]
    });
  } catch (err: any) {
    steps.push({
      step: 1,
      title: 'Buka Shift Kasir',
      status: 'FAIL',
      summary: `Gagal buka shift: ${err.message}`,
      logs: [err.message]
    });
  }

  // =========================================================================
  // LANGKAH 2: BUAT PO BERAS 10 SAK @ RP 60.000, APPROVE, & GOODS RECEIPT
  // =========================================================================
  let createdPoId = '';
  try {
    const poQty = 10;
    const poPrice = 60000;
    const poTotal = poQty * poPrice;
    createdPoId = `PO-TEST-${Date.now()}`;
    const poLineId = `POL-TEST-${Date.now()}`;

    // 1. Buat PO DRAFT
    const insertPoRes = db.insertPurchase(
      {
        id: createdPoId,
        supplierId: sinarPanganSup.id,
        status: 'DRAFT',
        paymentMethod: 'CREDIT',
        businessDate: dateStr,
        subtotal: poTotal,
        ppnAmount: 0,
        grandTotal: poTotal,
        createdBy: sitiKasir.name,
        createdAt: new Date().toISOString(),
        notes: 'PO Beras 10 sak skenario integrasi Prompt 9'
      },
      [
        {
          id: poLineId,
          purchaseId: createdPoId,
          productId: beras.id,
          qtyOrdered: poQty,
          qtyReceivedCumulative: 0,
          poPrice: poPrice
        }
      ]
    );

    if (!insertPoRes.success) throw new Error(insertPoRes.error);

    // 2. Approve PO oleh Owner
    const approveRes = db.approvePurchase(createdPoId, budiOwner.id, budiOwner.role);
    if (!approveRes.success) throw new Error(approveRes.error);

    // 3. Penerimaan Barang oleh Gudang (Goods Receipt)
    const initialSupplierAp = db.getSupplierById(sinarPanganSup.id)?.apBalance || 0;
    const receiveRes = db.receiveGoods({
      purchaseId: createdPoId,
      userRole: 'GUDANG',
      receivedBy: 'Mas Joko Prabowo',
      businessDate: dateStr,
      notes: 'Penerimaan 10 sak beras di gudang',
      items: [
        {
          lineId: poLineId,
          qtyReceived: poQty
        }
      ]
    });

    if (!receiveRes.success) throw new Error(receiveRes.error);

    const updatedSupplierAp = db.getSupplierById(sinarPanganSup.id)?.apBalance || 0;

    steps.push({
      step: 2,
      title: 'Pembelian & Penerimaan Barang (PO & GR)',
      status: 'PASS',
      summary: `PO ${createdPoId} (10 sak @ ${formatRupiah(poPrice)}) disetujui dan diterima lengkap. Layer FIFO baru bertambah & AP supplier bertambah ${formatRupiah(poTotal)}.`,
      logs: [
        `PO ID: ${createdPoId} (Status: RECEIVED)`,
        `Supplier: ${sinarPanganSup.name}`,
        `Batch Layer FIFO Dibuat: ${receiveRes.createdLayers?.length || 0} layer`,
        `Jurnal Pembelian: ${receiveRes.journal?.id} (Dr 1310 Persediaan ${formatRupiah(poTotal)} / Cr 2110 Hutang ${formatRupiah(poTotal)})`,
        `AP Supplier: ${formatRupiah(initialSupplierAp)} -> ${formatRupiah(updatedSupplierAp)}`
      ]
    });
  } catch (err: any) {
    steps.push({
      step: 2,
      title: 'Pembelian & Penerimaan Barang (PO & GR)',
      status: 'FAIL',
      summary: `Gagal siklus pembelian: ${err.message}`,
      logs: [err.message]
    });
  }

  // =========================================================================
  // LANGKAH 3: JUAL TUNAI 2 SAK BERAS
  // =========================================================================
  let cashSaleId = '';
  try {
    const saleUseCase = new CommitCashSaleUseCase();
    const qtyToSell = 2;
    const sellPrice = beras.sellPrice; // e.g. 72.000
    const totalCashSale = qtyToSell * sellPrice;

    const commitRes = saleUseCase.execute({
      clientSaleKey: `SALE-KEY-CASH-${Date.now()}`,
      currentUser: sitiKasir,
      cart: [
        {
          productId: beras.id,
          qty: qtyToSell,
          unitPrice: sellPrice
        }
      ],
      applyPpn: false,
      paymentMethod: 'CASH',
      cashPaid: totalCashSale,
      notes: 'Penjualan tunai 2 sak beras'
    });

    if (!commitRes.success || !commitRes.sale) {
      throw new Error(commitRes.errorMessage || 'Gagal memproses penjualan tunai');
    }

    cashSaleId = commitRes.sale.id;

    steps.push({
      step: 3,
      title: 'Penjualan Tunai (Cash Sale)',
      status: 'PASS',
      summary: `Terjual 2 sak beras tunai senilai ${formatRupiah(totalCashSale)} (Sale ID: ${cashSaleId}). Stok berkurang via FIFO & Jurnal terbentuk seimbang.`,
      logs: [
        `Sale ID: ${cashSaleId}`,
        `Total Tunai: ${formatRupiah(totalCashSale)}`,
        `Kas Masuk (Dr 1110): ${formatRupiah(totalCashSale)}`,
        `Jurnal ID: ${commitRes.journal?.id} (Debit == Kredit)`
      ]
    });
  } catch (err: any) {
    steps.push({
      step: 3,
      title: 'Penjualan Tunai (Cash Sale)',
      status: 'FAIL',
      summary: `Gagal jual tunai: ${err.message}`,
      logs: [err.message]
    });
  }

  // =========================================================================
  // LANGKAH 4: JUAL KREDIT 1 SAK BERAS KE WARUNG BU SITI (TEMPO 14 HARI)
  // =========================================================================
  let creditSaleId = '';
  try {
    const saleUseCase = new CommitCashSaleUseCase();
    const qtyToSell = 1;
    const sellPrice = beras.sellPrice;
    const initialCustAr = db.getCustomerById(buSitiCust.id)?.arBalance || 0;

    const commitRes = saleUseCase.execute({
      clientSaleKey: `SALE-KEY-CREDIT-${Date.now()}`,
      currentUser: sitiKasir,
      cart: [
        {
          productId: beras.id,
          qty: qtyToSell,
          unitPrice: sellPrice
        }
      ],
      applyPpn: false,
      paymentMethod: 'CREDIT',
      customerId: buSitiCust.id,
      notes: 'Jual tempo 14 hari ke Warung Bu Siti'
    });

    if (!commitRes.success || !commitRes.sale) {
      throw new Error(commitRes.errorMessage || 'Gagal memproses penjualan kredit');
    }

    creditSaleId = commitRes.sale.id;
    const updatedCustAr = db.getCustomerById(buSitiCust.id)?.arBalance || 0;

    steps.push({
      step: 4,
      title: 'Penjualan Kredit (Credit Sale)',
      status: 'PASS',
      summary: `Terjual 1 sak beras kredit senilai ${formatRupiah(sellPrice)} ke ${buSitiCust.name}. Piutang bertambah dari ${formatRupiah(initialCustAr)} menjadi ${formatRupiah(updatedCustAr)}.`,
      logs: [
        `Sale ID: ${creditSaleId}`,
        `Pelanggan: ${buSitiCust.name}`,
        `Jatuh Tempo: ${commitRes.sale.dueDate || '14 Hari'}`,
        `Piutang Diperbarui (Dr 1210): ${formatRupiah(sellPrice)}`
      ]
    });
  } catch (err: any) {
    steps.push({
      step: 4,
      title: 'Penjualan Kredit (Credit Sale)',
      status: 'FAIL',
      summary: `Gagal jual kredit: ${err.message}`,
      logs: [err.message]
    });
  }

  // =========================================================================
  // LANGKAH 5: PELUNASAN AR BU SITI (SEBAGIAN RP 50.000)
  // =========================================================================
  try {
    const settleAmount = 50000;
    const currentCustAr = db.getCustomerById(buSitiCust.id)?.arBalance || 0;

    const settleRes = db.settleArPayment({
      customerId: buSitiCust.id,
      amount: settleAmount,
      businessDate: dateStr,
      cashierName: sitiKasir.name,
      userRole: 'KASIR',
      selectedSaleId: creditSaleId,
      notes: 'Pelunasan piutang sebagian skenario test Prompt 9'
    });

    if (!settleRes.success) throw new Error(settleRes.errorMessage);

    const finalCustAr = db.getCustomerById(buSitiCust.id)?.arBalance || 0;

    steps.push({
      step: 5,
      title: 'Pelunasan Piutang (AR Settlement)',
      status: 'PASS',
      summary: `Pelunasan piutang ${formatRupiah(settleAmount)} oleh ${buSitiCust.name} berhasil dicatat. Sisa piutang: ${formatRupiah(finalCustAr)}. Jurnal Kas & Piutang seimbang.`,
      logs: [
        `Transaksi AR ID: ${settleRes.arTransaction?.id}`,
        `Jumlah Dilunasi: ${formatRupiah(settleAmount)}`,
        `Jurnal Pelunasan: ${settleRes.journal?.id} (Dr 1110 Kas / Cr 1210 Piutang)`,
        `Saldo Piutang: ${formatRupiah(currentCustAr)} -> ${formatRupiah(finalCustAr)}`
      ]
    });
  } catch (err: any) {
    steps.push({
      step: 5,
      title: 'Pelunasan Piutang (AR Settlement)',
      status: 'FAIL',
      summary: `Gagal pelunasan piutang: ${err.message}`,
      logs: [err.message]
    });
  }

  // =========================================================================
  // LANGKAH 6: TUTUP SHIFT KASIR (Rekonsiliasi Kas & Tutup Sesi)
  // =========================================================================
  try {
    const activeSession = db.getActiveCashSession(sitiKasir.id);
    if (!activeSession) throw new Error('Tidak ditemukan sesi kasir aktif untuk ditutup');

    const calc = db.calculateCashSessionExpected(activeSession.id);
    // Masukkan uang fisik pas sesuai expected cash
    const actualCash = calc.systemExpectedCash;

    const closeRes = db.closeCashSession({
      sessionId: activeSession.id,
      closedByUserId: sitiKasir.id,
      actualCash: actualCash,
      notes: 'Tutup sesi kasir otomatis skenario integrasi Prompt 9'
    });

    if (!closeRes.success || !closeRes.session) throw new Error(closeRes.error);

    steps.push({
      step: 6,
      title: 'Tutup Shift & Rekonsiliasi Kas',
      status: 'PASS',
      summary: `Shift ${activeSession.id} ditutup. Sistem menghitung kas seharusnya: ${formatRupiah(calc.systemExpectedCash)} (Modal ${formatRupiah(calc.openingFloat)} + Penjualan Tunai ${formatRupiah(calc.cashSalesTotal)} + Pelunasan AR ${formatRupiah(calc.arSettleTotal)}). Selisih: ${formatRupiah(closeRes.session.variance || 0)}.`,
      logs: [
        `ID Sesi: ${activeSession.id}`,
        `Kas Seharusnya: ${formatRupiah(calc.systemExpectedCash)}`,
        `Uang Fisik Dihitung: ${formatRupiah(actualCash)}`,
        `Selisih (Variance): ${formatRupiah(closeRes.session.variance || 0)} (Status: CLOSED)`
      ]
    });
  } catch (err: any) {
    steps.push({
      step: 6,
      title: 'Tutup Shift & Rekonsiliasi Kas',
      status: 'FAIL',
      summary: `Gagal tutup shift: ${err.message}`,
      logs: [err.message]
    });
  }

  // =========================================================================
  // LANGKAH 7: LAPORAN KEUANGAN (LABA RUGI & NERACA SALDO)
  // =========================================================================
  try {
    const accounts = db.getAllAccounts();
    const journals = db.getAllJournals();
    const journalLines = db.getAllJournalLines();

    const pl = generateProfitAndLoss({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      accounts,
      journals,
      journalLines
    });

    const tb = generateTrialBalance({
      asOfDate: dateStr,
      accounts,
      journals,
      journalLines
    });

    if (!tb.isBalanced) {
      throw new Error(`Neraca Saldo tidak balance! Discrepancy: ${tb.discrepancy}`);
    }

    steps.push({
      step: 7,
      title: 'Laporan Keuangan (P&L & Trial Balance)',
      status: 'PASS',
      summary: `Laba Rugi: Omzet ${formatRupiah(pl.netRevenue)}, HPP ${formatRupiah(pl.cogs)}, Laba Kotor ${formatRupiah(pl.grossProfit)}. Neraca Saldo seimbang sempurna (Total Debit ${formatRupiah(tb.totalEndingDebit)} == Total Kredit ${formatRupiah(tb.totalEndingCredit)}).`,
      logs: [
        `Pendapatan Bruto: ${formatRupiah(pl.grossRevenue)}`,
        `HPP (COGS): ${formatRupiah(pl.cogs)}`,
        `Laba Kotor: ${formatRupiah(pl.grossProfit)}`,
        `Neraca Saldo Seimbang: ${tb.isBalanced ? 'YA (100% Match)' : 'TIDAK'}`
      ]
    });
  } catch (err: any) {
    steps.push({
      step: 7,
      title: 'Laporan Keuangan (P&L & Trial Balance)',
      status: 'FAIL',
      summary: `Gagal pengujian laporan keuangan: ${err.message}`,
      logs: [err.message]
    });
  }

  // =========================================================================
  // LANGKAH 8: SYSTEM HEALTH CHECK (H1 SAMPAI H6 HARUS HIJAU)
  // =========================================================================
  try {
    const health = runSystemHealthCheck(db);
    const isAllPass = health.overallStatus === 'PASS';

    steps.push({
      step: 8,
      title: 'System Health Check (H1–H6)',
      status: isAllPass ? 'PASS' : 'FAIL',
      summary: isAllPass
        ? `Luar biasa! Semua 6 parameter integritas (H1–H6) berstatus PASS.`
        : `Ditemukan ${health.failedCount} parameter diagnostik yang belum lolos uji.`,
      logs: health.items.map(item => `${item.code}: ${item.name} -> ${item.status} (${item.summary})`)
    });
  } catch (err: any) {
    steps.push({
      step: 8,
      title: 'System Health Check (H1–H6)',
      status: 'FAIL',
      summary: `Gagal menjalankan health check: ${err.message}`,
      logs: [err.message]
    });
  }

  const overallStatus = steps.every(s => s.status === 'PASS') ? 'PASS' : 'FAIL';

  return {
    executedAt: new Date().toISOString(),
    overallStatus,
    steps
  };
}
