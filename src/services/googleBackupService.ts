/**
 * Google Sheets & Drive Backup & Restore Service
 * Omah Sembako Sehati — Prompt 15
 * 
 * Fitur:
 * 1. Snapshot penuh seluruh tabel IndexedDB (Prompt 1–14).
 * 2. 1 file Google Sheets di Google Drive (drive.file scope): "Backup Omah Sembako Sehati — [Nama Toko]"
 * 3. Tab per entity + 1 tab '_metadata' (schemaVersion, exportedAt, storeName, totalRecordsPerTable).
 * 4. Restore: Validasi schemaVersion -> Pratinjau perbandingan -> Konfirmasi teks "RESTORE" -> Tulis atomik.
 */

import { AppDatabase } from '../database/appDatabase';
import { AppDatabaseRepository, getAppDatabaseRepository } from '../database/useAppDatabase';
import { BackupConfig, BackupMetadata, UserRole } from '../types/erp';

export type DatabaseProvider = AppDatabase | AppDatabaseRepository;

function resolveRepository(dbOrRepo?: DatabaseProvider): AppDatabaseRepository {
  if (!dbOrRepo) {
    return getAppDatabaseRepository();
  }
  if ('getStore' in dbOrRepo && typeof (dbOrRepo as any).getStore === 'function') {
    const rawDb = (dbOrRepo as any).getRawDatabase ? (dbOrRepo as any).getRawDatabase() : (dbOrRepo as any).data;
    return {
      db: dbOrRepo as AppDatabase,
      store: (dbOrRepo as AppDatabase).getStore(),
      currentUser: (dbOrRepo as AppDatabase).currentUser,
      users: (dbOrRepo as AppDatabase).getAllUsers(),
      products: (dbOrRepo as AppDatabase).getAllProducts(),
      customers: (dbOrRepo as AppDatabase).getAllCustomers(),
      suppliers: (dbOrRepo as AppDatabase).getAllSuppliers(),
      inventoryLayers: (dbOrRepo as AppDatabase).getAllInventoryLayers(),
      accounts: (dbOrRepo as AppDatabase).getAllAccounts(),
      sales: (dbOrRepo as AppDatabase).getAllSales(),
      saleLines: (dbOrRepo as AppDatabase).getAllSaleLines(),
      journals: (dbOrRepo as AppDatabase).getAllJournals(),
      journalLines: (dbOrRepo as AppDatabase).getAllJournalLines(),
      purchases: (dbOrRepo as AppDatabase).getAllPurchases(),
      purchaseLines: (dbOrRepo as AppDatabase).getAllPurchaseLines(),
      purchaseReceipts: (dbOrRepo as AppDatabase).getPurchaseReceipts(),
      arTransactions: (dbOrRepo as AppDatabase).getAllArTransactions(),
      saleReturns: (dbOrRepo as AppDatabase).getAllSaleReturns(),
      purchaseReturns: (dbOrRepo as AppDatabase).getAllPurchaseReturns(),
      cashSessions: (dbOrRepo as AppDatabase).getAllCashSessions(),
      stockOpnames: (dbOrRepo as AppDatabase).getAllStockOpnames(),
      stockOpnameLines: (dbOrRepo as AppDatabase).getAllStockOpnameLines(),
      stockTransfers: (dbOrRepo as AppDatabase).getAllStockTransfers(),
      stockTransferLines: (dbOrRepo as AppDatabase).getAllStockTransferLines(),
      googleAccountLink: (dbOrRepo as AppDatabase).getGoogleAccountLink(),
      backupConfig: (dbOrRepo as AppDatabase).getBackupConfig(),
      backupConfigs: (dbOrRepo as AppDatabase).getAllBackupConfigs(),
      operationalExpenses: (dbOrRepo as AppDatabase).getAllOperationalExpenses(),
      generalJournals: (dbOrRepo as AppDatabase).getAllGeneralJournals(),
      promotions: (dbOrRepo as AppDatabase).getAllPromotions(),
      taxInvoiceNumbers: (dbOrRepo as AppDatabase).getAllTaxInvoiceNumbers(),
      idempotencyKeys: (dbOrRepo as AppDatabase).getAllIdempotencyKeys(),
      isReady: (dbOrRepo as AppDatabase).isReady,
      getRawDatabase: () => (dbOrRepo as AppDatabase).getRawDatabase(),
      restoreFromSnapshot: (tablesData: any, actorRole: UserRole) => (dbOrRepo as AppDatabase).restoreFromSnapshot(tablesData, actorRole),
      saveBackupConfig: (config: BackupConfig) => (dbOrRepo as AppDatabase).saveBackupConfig(config),
      updateBackupTimestamp: (lastBackupAt: string, extra?: any) => (dbOrRepo as AppDatabase).updateBackupTimestamp(lastBackupAt, extra),
    } as unknown as AppDatabaseRepository;
  }
  return dbOrRepo as AppDatabaseRepository;
}

export const CURRENT_SCHEMA_VERSION = 1;

export interface TableDiff {
  tableName: string;
  label: string;
  backupCount: number;
  currentCount: number;
  diff: number; // backupCount - currentCount
}

export interface BackupPreviewData {
  metadata: BackupMetadata;
  tablesData: Record<string, any[]>;
  diffs: TableDiff[];
  fileId: string;
  fileName: string;
}

// Daftar tabel yang dibackup secara komprehensif (Prompt 15b §2.3)
// Seluruh 26 entity bisnis masuk ke Google Sheets.
// PENTING: google_account_links, backup_configs, dan idempotency_keys TIDAK dibackup (lokal teknis)
export const BACKUP_TABLES = [
  { key: 'stores', label: 'Toko (Store)' },
  { key: 'users', label: 'Pengguna (Users)' },
  { key: 'products', label: 'Produk & Master Barang' },
  { key: 'customers', label: 'Pelanggan (Customers)' },
  { key: 'suppliers', label: 'Supplier (Pemasok)' },
  { key: 'inventoryLayers', label: 'Batch FIFO Persediaan (Inventory Layers)' },
  { key: 'sales', label: 'Penjualan (Sales Header)' },
  { key: 'saleLines', label: 'Rincian Penjualan (Sale Lines)' },
  { key: 'journals', label: 'Jurnal Umum (Journals Header)' },
  { key: 'journalLines', label: 'Baris Buku Besar (Journal Lines)' },
  { key: 'accounts', label: 'Bagan Akun (Chart of Accounts)' },
  { key: 'purchases', label: 'Pesanan Pembelian (Purchases)' },
  { key: 'purchaseLines', label: 'Rincian PO (Purchase Lines)' },
  { key: 'purchaseReceipts', label: 'Penerimaan Barang (Purchase Receipts)' },
  { key: 'arTransactions', label: 'Buku Piutang Pelanggan (AR Transactions)' },
  { key: 'saleReturns', label: 'Retur Penjualan (Sale Returns)' },
  { key: 'purchaseReturns', label: 'Retur Pembelian (Purchase Returns)' },
  { key: 'cashSessions', label: 'Sesi Kasir (Cash Sessions)' },
  { key: 'stockOpnames', label: 'Stock Opname Fisik' },
  { key: 'stockOpnameLines', label: 'Rincian Stock Opname' },
  { key: 'stockTransfers', label: 'Transfer Stok Antar-Lokasi' },
  { key: 'stockTransferLines', label: 'Rincian Transfer Stok' },
  { key: 'operationalExpenses', label: 'Beban Operasional Toko' },
  { key: 'generalJournals', label: 'Jurnal Memorial / Umum' },
  { key: 'promotions', label: 'Program Promosi & Diskon' },
  { key: 'taxInvoiceNumbers', label: 'Nomor Faktur Pajak' }
] as const;

/**
 * Cek koneksi internet
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Helper fetch ke Google REST APIs dengan error handling terpusat
 */
async function callGoogleApi(url: string, accessToken: string, options: RequestInit = {}) {
  if (!isOnline()) {
    throw new Error('Tidak ada koneksi internet — coba lagi nanti');
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorText = await response.text();
    let parsedMsg = errorText;
    try {
      const errJson = JSON.parse(errorText);
      parsedMsg = errJson.error?.message || errorText;
    } catch {
      // ignore
    }
    throw new Error(`Google API Error (${response.status}): ${parsedMsg}`);
  }

  return response.json();
}

/**
 * Serialisasi data tabel menjadi baris 2D string untuk Google Sheets
 */
export function serializeTableToSheetRows(records: any[]): (string | number)[][] {
  if (!records || records.length === 0) {
    return [['(Kosong)']];
  }

  // Ambil semua keys unik dari seluruh record
  const keySet = new Set<string>();
  records.forEach(r => {
    if (r && typeof r === 'object') {
      Object.keys(r).forEach(k => keySet.add(k));
    }
  });
  const headers = Array.from(keySet);

  const rows: (string | number)[][] = [headers];

  records.forEach(rec => {
    const row = headers.map(header => {
      const val = rec[header];
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    });
    rows.push(row);
  });

  return rows;
}

/**
 * Deserialisasi baris 2D string dari Google Sheets kembali ke object Array
 */
export function deserializeSheetRowsToTable(rows: any[][]): any[] {
  if (!rows || rows.length <= 1) {
    return [];
  }

  const headers = rows[0].map(h => String(h).trim());
  if (headers.length === 1 && headers[0] === '(Kosong)') {
    return [];
  }

  const records: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const item: Record<string, any> = {};
    headers.forEach((header, colIdx) => {
      let cell = row[colIdx];
      if (cell === undefined || cell === null) {
        cell = '';
      }
      // Coba parse JSON jika cell tampak seperti objek/array
      if (typeof cell === 'string' && (cell.startsWith('{') || cell.startsWith('['))) {
        try {
          cell = JSON.parse(cell);
        } catch {
          // Tetap string
        }
      }
      // Coba parse boolean jika string true/false
      if (cell === 'true' || cell === 'TRUE') {
        cell = true;
      } else if (cell === 'false' || cell === 'FALSE') {
        cell = false;
      } else if (cell === '0') {
        cell = 0;
      } else if (typeof cell === 'string' && cell !== '' && !isNaN(Number(cell)) && !cell.startsWith('0') && !cell.includes('-')) {
        // jika murni numeric dan bukan leading zero seperti nomor HP/kode
        const num = Number(cell);
        if (Number.isSafeInteger(num) && cell === num.toString()) {
          cell = num;
        }
      }
      item[header] = cell;
    });
    records.push(item);
  }

  return records;
}

/**
 * Jalankan Backup Penuh ke Google Sheets (Prompt 15 §3)
 */
export async function executeBackupToGoogleSheets(
  db: AppDatabase,
  accessToken: string
): Promise<{ success: boolean; fileId: string; fileName: string; exportedAt: string }> {
  if (!isOnline()) {
    throw new Error('Tidak ada koneksi internet — periksa jaringan Anda lalu coba lagi');
  }

  const rawDb = db.getRawDatabase();
  const store = db.getStore();
  const storeName = store?.name || 'Omah Sembako Sehati';
  const expectedFileName = `Backup Omah Sembako Sehati — ${storeName}`;
  const exportedAt = new Date().toISOString();

  // Hitung jumlah record per tabel
  const totalRecordsPerTable: Record<string, number> = {};
  BACKUP_TABLES.forEach(({ key }) => {
    const arr = (rawDb as any)[key] || [];
    totalRecordsPerTable[key] = arr.length;
  });

  const metadata: BackupMetadata = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt,
    storeName,
    totalRecordsPerTable
  };

  // Cek apakah file backup sudah pernah dibuat sebelumnya
  let existingConfig = db.getBackupConfig();
  let targetFileId = existingConfig?.fileId;

  // Verifikasi apakah fileId yang tersimpan masih ada di Google Drive
  if (targetFileId) {
    try {
      const fileInfo = await callGoogleApi(
        `https://www.googleapis.com/drive/v3/files/${targetFileId}?fields=id,name,trashed`,
        accessToken
      );
      if (fileInfo.trashed) {
        targetFileId = undefined; // File ada di trash, buat file baru
      }
    } catch {
      // File mungkin sudah dihapus manual oleh user di Drive
      targetFileId = undefined;
    }
  }

  // Jika belum ada fileId sah, buat file Google Sheets baru di Drive
  if (!targetFileId) {
    const createRes = await callGoogleApi(
      'https://sheets.googleapis.com/v4/spreadsheets',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          properties: {
            title: expectedFileName
          },
          sheets: [
            { properties: { title: '_metadata' } },
            ...BACKUP_TABLES.map(t => ({ properties: { title: t.key } }))
          ]
        })
      }
    );

    targetFileId = createRes.spreadsheetId;
    if (!targetFileId) {
      throw new Error('Gagal mendapatkan Spreadsheet ID dari Google Sheets API.');
    }

    // Simpan fileId ke IndexedDB (BackupConfig — 1 row)
    const googleLink = db.getGoogleAccountLink();
    const newConfig: BackupConfig = {
      id: 'DEFAULT',
      googleEmail: googleLink?.googleEmail || existingConfig?.googleEmail || '',
      fileId: targetFileId,
      fileName: expectedFileName,
      lastBackupAt: exportedAt,
      schemaVersion: CURRENT_SCHEMA_VERSION
    };
    db.saveBackupConfig(newConfig);
  }

  // 1. Pastikan semua sheets / tabs yang dibutuhkan ada di spreadsheet
  const sheetMeta = await callGoogleApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${targetFileId}?fields=sheets.properties`,
    accessToken
  );
  const existingSheetTitles = new Set(
    (sheetMeta.sheets || []).map((s: any) => s.properties.title)
  );

  const missingSheets: string[] = [];
  if (!existingSheetTitles.has('_metadata')) missingSheets.push('_metadata');
  BACKUP_TABLES.forEach(t => {
    if (!existingSheetTitles.has(t.key)) missingSheets.push(t.key);
  });

  if (missingSheets.length > 0) {
    const addSheetRequests = missingSheets.map(title => ({
      addSheet: { properties: { title } }
    }));
    await callGoogleApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${targetFileId}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ requests: addSheetRequests })
      }
    );
  }

  // 2. Siapkan data baris untuk tab _metadata
  const metadataRows: (string | number)[][] = [
    ['property', 'value'],
    ['schemaVersion', String(metadata.schemaVersion)],
    ['exportedAt', metadata.exportedAt],
    ['storeName', metadata.storeName],
    ['totalRecordsPerTable', JSON.stringify(metadata.totalRecordsPerTable)]
  ];

  // 3. Siapkan batch update value untuk setiap tab
  const dataPayload = [
    {
      range: `_metadata!A1`,
      values: metadataRows
    }
  ];

  BACKUP_TABLES.forEach(t => {
    const tableRecords = (rawDb as any)[t.key] || [];
    const rows = serializeTableToSheetRows(tableRecords);
    dataPayload.push({
      range: `${t.key}!A1`,
      values: rows
    });
  });

  // Bersihkan data lama terlebih dahulu agar jika ada record yang berkurang, tidak ada sisa baris lama
  // (Snapshot penuh terbaru §3)
  for (const sheetTitle of ['_metadata', ...BACKUP_TABLES.map(t => t.key)]) {
    try {
      await callGoogleApi(
        `https://sheets.googleapis.com/v4/spreadsheets/${targetFileId}/values/${encodeURIComponent(sheetTitle)}:clear`,
        accessToken,
        { method: 'POST' }
      );
    } catch (e) {
      console.warn(`Gagal membersihkan tab ${sheetTitle}:`, e);
    }
  }

  // Tulis data baru secara batch
  await callGoogleApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${targetFileId}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: dataPayload
      })
    }
  );

  // Update lastBackupAt & sinkronisasi state
  const currentGoogleLink = db.getGoogleAccountLink();
  db.updateBackupTimestamp(exportedAt, {
    fileId: targetFileId,
    googleEmail: currentGoogleLink?.googleEmail || '',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    fileName: expectedFileName
  });

  return {
    success: true,
    fileId: targetFileId,
    fileName: expectedFileName,
    exportedAt
  };
}

/**
 * Baca dan siapkan Pratinjau Restore dari Google Sheets (Prompt 15 §4)
 */
export async function fetchRestorePreview(
  db: AppDatabase,
  accessToken: string
): Promise<BackupPreviewData> {
  if (!isOnline()) {
    throw new Error('Tidak ada koneksi internet — coba lagi nanti');
  }

  const config = db.getBackupConfig();
  if (!config || !config.fileId) {
    throw new Error('Belum ada berkas backup yang tertaut di akun Google Anda. Lakukan Backup terlebih dahulu.');
  }

  const fileId = config.fileId;
  const fileName = config.fileName || 'Backup Omah Sembako Sehati';

  // 1. Baca metadata tab
  let metadataRes: any;
  try {
    metadataRes = await callGoogleApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent('_metadata!A1:B10')}`,
      accessToken
    );
  } catch (err: any) {
    throw new Error(`Tidak dapat membaca tab _metadata dari berkas backup Google Sheets: ${err.message}`);
  }

  const metaRows: any[][] = metadataRes.values || [];
  if (metaRows.length === 0) {
    throw new Error('Tab _metadata kosong. Berkas backup ini tidak sah atau rusak.');
  }

  const metaObj: Record<string, string> = {};
  metaRows.forEach(row => {
    if (row[0]) metaObj[row[0]] = row[1] || '';
  });

  const schemaVersion = parseInt(metaObj.schemaVersion || '0', 10);

  // Validasi schemaVersion (Prompt 15 §4.2: tolak jika tidak cocok)
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Format backup tidak kompatibel dengan versi app ini (Versi backup: ${schemaVersion || 'Tidak Diketahui'}, Versi aplikasi: ${CURRENT_SCHEMA_VERSION}). Restore ditolak demi melindungi integritas data.`
    );
  }

  let totalRecordsPerTable: Record<string, number> = {};
  try {
    if (metaObj.totalRecordsPerTable) {
      totalRecordsPerTable = JSON.parse(metaObj.totalRecordsPerTable);
    }
  } catch {
    // fallback
  }

  const metadata: BackupMetadata = {
    schemaVersion,
    exportedAt: metaObj.exportedAt || '',
    storeName: metaObj.storeName || '',
    totalRecordsPerTable
  };

  // 2. Baca seluruh data tabel dari Sheets
  const ranges = BACKUP_TABLES.map(t => `${t.key}!A1:ZZ5000`);
  const rangeParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');

  const batchValuesRes = await callGoogleApi(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchGet?${rangeParams}`,
    accessToken
  );

  const valueRanges: any[] = batchValuesRes.valueRanges || [];
  const rawCurrentDb = db.getRawDatabase();
  const tablesData: Record<string, any[]> = {};
  const diffs: TableDiff[] = [];

  BACKUP_TABLES.forEach((t, idx) => {
    const vr = valueRanges[idx] || {};
    const rows = vr.values || [];
    const parsedRecords = deserializeSheetRowsToTable(rows);
    tablesData[t.key] = parsedRecords;

    const currentCount = ((rawCurrentDb as any)[t.key] || []).length;
    const backupCount = parsedRecords.length;

    diffs.push({
      tableName: t.key,
      label: t.label,
      backupCount,
      currentCount,
      diff: backupCount - currentCount
    });
  });

  return {
    metadata,
    tablesData,
    diffs,
    fileId,
    fileName
  };
}
