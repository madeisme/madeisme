/**
 * Local JSON Backup & Restore Service
 * Omah Sembako Sehati ERP
 * 
 * Fitur:
 * 1. Ekspor database lengkap (seluruh 26 tabel entitas bisnis) ke format JSON standar.
 * 2. Mengunduh file JSON secara offline langsung ke penyimpanan lokal (Downloads/Storage).
 * 3. Format nama file: `omah_sembako_backup_YYYYMMDD_HHmmss.json`.
 * 4. Menyertakan metadata verifikasi: schemaVersion, exportedAt, storeName, totalRecordsPerTable, checksum summary.
 * 5. Fitur impor/restore file JSON lokal dengan validasi skema dan pratinjau data.
 */

import { AppDatabase } from '../database/appDatabase';
import { AppDatabaseRepository, getAppDatabaseRepository } from '../database/useAppDatabase';
import { BackupMetadata, UserRole } from '../types/erp';
import { BACKUP_TABLES, CURRENT_SCHEMA_VERSION, TableDiff } from './googleBackupService';

export interface LocalBackupPayload {
  format: 'OMAH_SEMBAKO_SEHATI_BACKUP';
  schemaVersion: number;
  exportedAt: string;
  storeName: string;
  metadata: BackupMetadata;
  tables: Record<string, any[]>;
}

export interface LocalBackupResult {
  success: boolean;
  fileName: string;
  fileSizeFormatted: string;
  totalRecords: number;
  error?: string;
}

/**
 * Format bytes ke ukuran yang mudah dibaca (KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Menghasilkan snapshot JSON lengkap dari database dan memicu unduhan file ke penyimpanan lokal
 */
export function exportDatabaseToJsonFile(dbOrRepo?: AppDatabase | AppDatabaseRepository): LocalBackupResult {
  try {
    let rawDb: any;
    let storeName = 'Omah Sembako Sehati';

    if (dbOrRepo) {
      if ('getRawDatabase' in dbOrRepo && typeof (dbOrRepo as any).getRawDatabase === 'function') {
        rawDb = (dbOrRepo as any).getRawDatabase();
      } else if ('data' in (dbOrRepo as any)) {
        rawDb = (dbOrRepo as any).data;
      }
      if ('getStore' in dbOrRepo && typeof (dbOrRepo as any).getStore === 'function') {
        storeName = (dbOrRepo as any).getStore()?.name || storeName;
      } else if ('store' in (dbOrRepo as any)) {
        storeName = (dbOrRepo as any).store?.name || storeName;
      }
    }

    if (!rawDb) {
      const repo = getAppDatabaseRepository();
      rawDb = repo.getRawDatabase();
      storeName = repo.store?.name || storeName;
    }

    const exportedAt = new Date().toISOString();
    const tables: Record<string, any[]> = {};
    const totalRecordsPerTable: Record<string, number> = {};
    let grandTotalRecords = 0;

    for (const table of BACKUP_TABLES) {
      const rows = Array.isArray(rawDb[table.key]) ? rawDb[table.key] : [];
      tables[table.key] = rows;
      totalRecordsPerTable[table.key] = rows.length;
      grandTotalRecords += rows.length;
    }

    const metadata: BackupMetadata = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt,
      storeName,
      totalRecordsPerTable
    };

    const payload: LocalBackupPayload = {
      format: 'OMAH_SEMBAKO_SEHATI_BACKUP',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt,
      storeName,
      metadata,
      tables
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const fileSizeFormatted = formatFileSize(blob.size);

    // Format nama file: omah_sembako_backup_YYYYMMDD_HHmmss.json
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const safeStoreSlug = storeName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const fileName = `omah_sembako_backup_${safeStoreSlug}_${yyyy}${mm}${dd}_${hh}${min}${ss}.json`;

    // Trigger download di browser/web view
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return {
      success: true,
      fileName,
      fileSizeFormatted,
      totalRecords: grandTotalRecords
    };
  } catch (err: any) {
    console.error('Gagal mengekspor data ke file JSON lokal:', err);
    return {
      success: false,
      fileName: '',
      fileSizeFormatted: '0 B',
      totalRecords: 0,
      error: err.message || 'Gagal mengekspor data database ke JSON lokal'
    };
  }
}

/**
 * Validasi dan baca file JSON lokal yang diunggah pengguna untuk pratinjau pemulihan
 */
export async function parseLocalBackupFile(file: File, currentDbOrRepo?: AppDatabase | AppDatabaseRepository): Promise<{
  success: boolean;
  metadata?: BackupMetadata;
  tablesData?: Record<string, any[]>;
  diffs?: TableDiff[];
  fileName?: string;
  error?: string;
}> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    // Validasi format
    if (parsed.format !== 'OMAH_SEMBAKO_SEHATI_BACKUP' && !parsed.tables && !parsed.metadata) {
      return {
        success: false,
        error: 'Format berkas tidak valid. Berkas cadangan harus berformat JSON resmi Omah Sembako Sehati.'
      };
    }

    const schemaVersion = parsed.schemaVersion || parsed.metadata?.schemaVersion || 1;
    if (schemaVersion > CURRENT_SCHEMA_VERSION) {
      return {
        success: false,
        error: `Versi skema cadangan (${schemaVersion}) lebih baru dari aplikasi (v${CURRENT_SCHEMA_VERSION}). Harap perbarui aplikasi terlebih dahulu.`
      };
    }

    const tablesData: Record<string, any[]> = parsed.tables || {};
    const metadata: BackupMetadata = parsed.metadata || {
      schemaVersion,
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      storeName: parsed.storeName || 'Toko',
      totalRecordsPerTable: {}
    };

    // Ambil data lokal saat ini untuk menghitung diffs
    let currentRaw: any = {};
    if (currentDbOrRepo) {
      if ('getRawDatabase' in currentDbOrRepo && typeof (currentDbOrRepo as any).getRawDatabase === 'function') {
        currentRaw = (currentDbOrRepo as any).getRawDatabase();
      } else if ('data' in (currentDbOrRepo as any)) {
        currentRaw = (currentDbOrRepo as any).data;
      }
    } else {
      currentRaw = getAppDatabaseRepository().getRawDatabase();
    }

    const diffs: TableDiff[] = BACKUP_TABLES.map(t => {
      const backupRows = Array.isArray(tablesData[t.key]) ? tablesData[t.key] : [];
      const currentRows = Array.isArray(currentRaw[t.key]) ? currentRaw[t.key] : [];
      return {
        tableName: t.key,
        label: t.label,
        backupCount: backupRows.length,
        currentCount: currentRows.length,
        diff: backupRows.length - currentRows.length
      };
    });

    return {
      success: true,
      metadata,
      tablesData,
      diffs,
      fileName: file.name
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Gagal membaca berkas JSON: ${err.message || 'Format JSON rusak atau tidak terbaca'}`
    };
  }
}
