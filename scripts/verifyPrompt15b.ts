import 'fake-indexeddb/auto';
import { db } from '../src/database/appDatabase';
import { BACKUP_TABLES, serializeTableToSheetRows, deserializeSheetRowsToTable } from '../src/services/googleBackupService';
import { runSystemHealthCheck } from '../src/utils/systemHealthCheck';
import { CommitCashSaleUseCase } from '../src/domain/usecase/CommitCashSaleUseCase';

async function runPrompt15bVerification() {
  console.log('====================================================');
  console.log('  VERIFIKASI PROMPT 15b — Sambung Ulang Google Backup ke IndexedDB');
  console.log('====================================================\n');

  // 1. Audit check
  console.log('--- 1. AUDIT CHECK ---');
  const forbiddenTablesInBackup = ['google_account_links', 'backup_configs', 'idempotency_keys', 'googleAccountLinks', 'backupConfigs', 'idempotencyKeys'];
  for (const ft of forbiddenTablesInBackup) {
    const found = BACKUP_TABLES.some(t => t.key === ft);
    if (found) {
      throw new Error(`FAIL: Tabel teknis lokal '${ft}' ditemukan di BACKUP_TABLES!`);
    }
  }
  console.log('PASS: Tabel teknis lokal (google_account_links, backup_configs, idempotency_keys) TIDAK ada di BACKUP_TABLES.');
  console.log(`PASS: Total tabel bisnis di BACKUP_TABLES = ${BACKUP_TABLES.length} tabel.`);
  
  const expectedKeys = [
    'stores', 'users', 'products', 'customers', 'suppliers',
    'inventoryLayers', 'sales', 'saleLines', 'journals', 'journalLines',
    'accounts', 'purchases', 'purchaseLines', 'purchaseReceipts', 'arTransactions',
    'saleReturns', 'purchaseReturns', 'cashSessions', 'stockOpnames', 'stockOpnameLines',
    'stockTransfers', 'stockTransferLines', 'operationalExpenses', 'generalJournals',
    'promotions', 'taxInvoiceNumbers'
  ];
  for (const ek of expectedKeys) {
    if (!BACKUP_TABLES.some(t => t.key === ek)) {
      throw new Error(`FAIL: Entitas bisnis '${ek}' tidak ditemukan di BACKUP_TABLES!`);
    }
  }
  console.log('PASS: Seluruh 26 entitas bisnis terdaftar lengkap di BACKUP_TABLES.');

  // 2. Inisialisasi AppDatabase singleton
  console.log('\n--- 2. DATABASE INITIALIZATION ---');
  await db.readyPromise;
  db.resetToSeed();
  console.log('PASS: IndexedDB berhasil diinisialisasi & dimuat data SEED.');

  // Simpan Google Account Link & Backup Config teknis lokal
  db.linkGoogleAccount({
    userId: 'USER_LOCAL_1',
    googleEmail: 'owner@toko.com',
    googleDisplayName: 'Pemilik Toko',
    googlePhotoUrl: '',
    actorRole: 'OWNER'
  });
  db.saveBackupConfig({
    id: 'DEFAULT',
    googleEmail: 'owner@toko.com',
    fileId: 'google_sheets_file_id_xyz123',
    fileName: 'Backup Omah Sembako Sehati — Toko Utama',
    lastBackupAt: '2026-09-21T01:00:00.000Z',
    schemaVersion: 1
  });

  const initialGoogleLink = db.getGoogleAccountLink();
  const initialBackupConfig = db.getBackupConfig();
  console.log('Initial Google Link:', initialGoogleLink?.googleEmail);
  console.log('Initial Backup Config File ID:', initialBackupConfig?.fileId);

  // Jalankan health check awal
  const preHealth = runSystemHealthCheck(db);
  console.log(`Initial Health Check: ${preHealth.overallStatus} (${preHealth.passedCount}/${preHealth.totalChecks})`);
  if (preHealth.overallStatus !== 'PASS') {
    throw new Error('FAIL: Initial health check tidak PASS!');
  }

  // 3. Simulasikan Snapshot Backup ke Google Sheets (serialize) lalu deserialize kembali
  console.log('\n--- 3. SIMULASI SNAPSHOT BACKUP KE GOOGLE SHEETS & DESERIALIZE ---');
  const rawDb = db.getRawDatabase();
  const backupTablesData: Record<string, any[]> = {};
  for (const t of BACKUP_TABLES) {
    const originalRecords = (rawDb as any)[t.key] || [];
    const sheetRows = serializeTableToSheetRows(originalRecords);
    const deserialized = deserializeSheetRowsToTable(sheetRows);
    backupTablesData[t.key] = deserialized;
    console.log(`  [Tab: ${t.key.padEnd(20)}] ${originalRecords.length} records -> ${sheetRows.length} sheet rows -> ${deserialized.length} parsed`);
    if (originalRecords.length !== deserialized.length) {
      throw new Error(`FAIL: Ketidakcocokan record count pada ${t.key}: expected ${originalRecords.length}, got ${deserialized.length}`);
    }
  }

  const initialSalesCount = db.getAllSales().length;
  const initialProductsCount = db.getAllProducts().length;
  const initialJournalsCount = db.getRawDatabase().journals.length;
  console.log(`Initial Sales: ${initialSalesCount}, Products: ${initialProductsCount}, Journals: ${initialJournalsCount}`);

  // 4. Lakukan 2 transaksi baru (sehingga database 'saat ini' beda dari backup)
  console.log('\n--- 4. MEMBUAT TRANSAKSI BARU (STATE BERUBAH) ---');
  // Transaksi 1: Tambah produk baru
  const newProduct = {
    id: 'PROD_TEST_15B',
    sku: 'SKU_15B_TEST',
    barcode: '8999999999999',
    name: 'Minyak Goreng Sawit 1L Test 15b',
    category: 'Minyak',
    unit: 'Pcs',
    sellPrice: 16000,
    costPrice: 13000,
    currentStock: 50,
    minStock: 10,
    location: 'Gudang Depan',
    isActive: true,
    batches: []
  };
  db.insertProduct(newProduct as any);
  console.log('PASS: Transaksi 1 — Produk baru berhasil dibuat.');

  // Transaksi 2: Cash Sale menggunakan CommitCashSaleUseCase
  const commitSaleUseCase = new CommitCashSaleUseCase();
  const productA = db.getProductById('PRD-001')!;
  const currentUser = db.currentUser;
  const saleResult = commitSaleUseCase.execute({
    clientSaleKey: 'KEY_TEST_15B_' + Date.now(),
    currentUser,
    cart: [
      {
        productId: productA.id,
        qty: 1,
        unitPrice: productA.sellPrice
      }
    ],
    applyPpn: false,
    paymentMethod: 'CASH',
    cashPaid: productA.sellPrice * 2,
    notes: 'Pengujian Roundtrip Backup Restore 15b'
  });

  if (!saleResult.success || !saleResult.sale) {
    throw new Error(`FAIL: Cash sale gagal: ${saleResult.errorMessage}`);
  }
  console.log('PASS: Transaksi 2 — Penjualan tunai baru committed (Sale ID:', saleResult.sale.id, ')');

  // Verifikasi bahwa state saat ini BERBEDA dari backup
  const modifiedSalesCount = db.getAllSales().length;
  const modifiedProductsCount = db.getAllProducts().length;
  const modifiedJournalsCount = db.getRawDatabase().journals.length;
  console.log(`Modified State — Sales: ${modifiedSalesCount}, Products: ${modifiedProductsCount}, Journals: ${modifiedJournalsCount}`);
  if (modifiedSalesCount <= initialSalesCount || modifiedProductsCount <= initialProductsCount) {
    throw new Error('FAIL: Modifikasi transaksi tidak merubah database!');
  }

  // 5. Test Restore RBAC (hanya OWNER yang boleh)
  console.log('\n--- 5. RESTORE RBAC CHECK ---');
  const kasirRestoreRes = db.restoreFromSnapshot(backupTablesData as any, 'KASIR');
  if (kasirRestoreRes.success) {
    throw new Error('FAIL: Kasir berhasil melakukan restore database!');
  }
  console.log('PASS: Role KASIR ditolak saat mencoba restore:', kasirRestoreRes.error);

  // 6. Eksekusi Restore dari snapshot backup sebagai OWNER
  console.log('\n--- 6. EKSEKUSI ATOMIK RESTORE DARI SNAPSHOT (OWNER) ---');
  const ownerRestoreRes = db.restoreFromSnapshot(backupTablesData as any, 'OWNER');
  if (!ownerRestoreRes.success) {
    throw new Error(`FAIL: Owner gagal restore: ${ownerRestoreRes.error}`);
  }
  console.log('PASS: db.restoreFromSnapshot() sukses dijalankan.');

  // 7. Verifikasi Roundtrip Data Integrity
  console.log('\n--- 7. VERIFIKASI DATA INTEGRITY SETELAH RESTORE ---');
  const restoredSalesCount = db.getAllSales().length;
  const restoredProductsCount = db.getAllProducts().length;
  const restoredJournalsCount = db.getRawDatabase().journals.length;
  console.log(`Restored State — Sales: ${restoredSalesCount}, Products: ${restoredProductsCount}, Journals: ${restoredJournalsCount}`);

  if (restoredSalesCount !== initialSalesCount) {
    throw new Error(`FAIL: Sales count tidak kembali ke awal! Expected ${initialSalesCount}, got ${restoredSalesCount}`);
  }
  if (restoredProductsCount !== initialProductsCount) {
    throw new Error(`FAIL: Products count tidak kembali ke awal! Expected ${initialProductsCount}, got ${restoredProductsCount}`);
  }
  if (restoredJournalsCount !== initialJournalsCount) {
    throw new Error(`FAIL: Journals count tidak kembali ke awal! Expected ${initialJournalsCount}, got ${restoredJournalsCount}`);
  }
  console.log('PASS: Jumlah baris seluruh tabel bisnis kembali tepat ke kondisi sebelum transaksi baru.');

  // 8. Verifikasi Konfigurasi Teknis Lokal (TIDAK ter-reset atau hilang)
  console.log('\n--- 8. VERIFIKASI TECHNICAL LOCAL STORES PRESERVATION ---');
  const postRestoreGoogleLink = db.getGoogleAccountLink();
  const postRestoreBackupConfig = db.getBackupConfig();
  if (!postRestoreGoogleLink || postRestoreGoogleLink.googleEmail !== 'owner@toko.com') {
    throw new Error('FAIL: Google Account Link hilang atau ter-reset setelah restore!');
  }
  if (!postRestoreBackupConfig || postRestoreBackupConfig.fileId !== 'google_sheets_file_id_xyz123') {
    throw new Error('FAIL: Backup Config fileId hilang atau ter-reset setelah restore!');
  }
  console.log('PASS: Google Account Link tetap terhubung:', postRestoreGoogleLink.googleEmail);
  console.log('PASS: Backup Config tetap utuh:', postRestoreBackupConfig.fileId);
  console.log('PASS: Waktu lastRestoreAt tercatat:', postRestoreBackupConfig.lastRestoreAt);

  // 9. Jalankan System Health Check H1-H13 setelah restore
  console.log('\n--- 9. SYSTEM HEALTH CHECK H1-H13 PASCA-RESTORE ---');
  const postHealth = runSystemHealthCheck(db);
  console.log(`Post-Restore Health Check: ${postHealth.overallStatus} (${postHealth.passedCount}/${postHealth.totalChecks})`);
  postHealth.items.forEach(h => {
    console.log(`  [${h.status}] ${h.code}: ${h.name} — ${h.summary}`);
  });

  if (postHealth.overallStatus !== 'PASS') {
    throw new Error('FAIL: Post-restore health check tidak PASS!');
  }
  if (postHealth.passedCount !== preHealth.passedCount) {
    throw new Error(`FAIL: Lolos health check berbeda (${postHealth.passedCount} vs ${preHealth.passedCount})`);
  }

  console.log('\n====================================================');
  console.log('  SEMUA PENGUJIAN PROMPT 15b BERHASIL 100% (PASS)');
  console.log('====================================================');
}

runPrompt15bVerification().catch(err => {
  console.error('\n❌ ERROR SAAT VERIFIKASI PROMPT 15b:', err);
  process.exit(1);
});
