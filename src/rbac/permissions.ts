/**
 * RBAC (Role-Based Access Control) Terpusat — Omah Sembako Sehati ERP
 * 
 * Sesuai Prompt 7:
 * - Satu matrix terpusat (single source of truth)
 * - Fallback-deny (default tolak jika action tidak ada di matrix)
 * - 5 Role: OWNER | ADMIN | BOOKKEEPER | KASIR | GUDANG
 */

import { UserRole } from '../types/erp';

export type UserAction =
  | 'SALE_COMMIT'
  | 'SALE_VOID'
  | 'SALE_RETURN'
  | 'CREDIT_OVERRIDE'
  | 'AR_SETTLE'
  | 'PO_CREATE'
  | 'PO_APPROVE'
  | 'PO_RECEIVE'
  | 'PURCHASE_RETURN'
  | 'REPORT_VIEW'
  | 'USER_CREATE'
  | 'ROLE_ASSIGN'
  | 'SETTINGS_VIEW'
  | 'SETTINGS_UPDATE'
  // Prompt 8: Sesi Kasir
  | 'CASH_SESSION_OPEN'
  | 'CASH_SESSION_CLOSE'
  | 'CASH_SESSION_VIEW'
  // Prompt 10: Stock Opname & Transfer Lokasi
  | 'STOCK_OPNAME_CREATE'
  | 'STOCK_OPNAME_COMMIT'
  | 'STOCK_TRANSFER_CREATE'
  | 'STOCK_TRANSFER_APPROVE'
  | 'STOCK_TRANSFER_RECEIVE'
  // Prompt 15: Google Sign-In & Backup/Restore
  | 'GOOGLE_CONNECT'
  | 'BACKUP_RUN'
  | 'RESTORE_RUN'
  // UI & Legacy Aliases
  | 'VIEW_DASHBOARD'
  | 'VIEW_REPORTS'
  | 'CREATE_SALE'
  | 'VOID_SALE'
  | 'RETURN_SALE'
  | 'RETURN_PURCHASE'
  | 'VIEW_COST_HPP'
  | 'MANAGE_STOCK'
  | 'RECEIVE_PO'
  | 'VIEW_JOURNAL'
  | 'MANAGE_USERS'
  | 'MANAGE_ACCOUNTS'
  | 'SETTLE_AR';

export type RbacAction = UserAction;

/**
 * Matrix RBAC Terpusat (Prompt 7 §2)
 * Wajib: Setiap action yang tidak terdaftar di sini -> DEFAULT DENY
 */
export const RBAC_MATRIX: Record<UserAction, readonly UserRole[]> = {
  // 1. Kasir / Penjualan
  SALE_COMMIT: ['OWNER', 'ADMIN', 'KASIR'],
  SALE_VOID: ['OWNER', 'ADMIN'],
  SALE_RETURN: ['OWNER', 'ADMIN'],
  CREDIT_OVERRIDE: ['OWNER', 'ADMIN'], // Otorisasi penjualan melebihi limit kredit
  AR_SETTLE: ['OWNER', 'ADMIN', 'BOOKKEEPER'], // Pelunasan piutang pelanggan

  // 2. Pembelian / Pengadaan
  PO_CREATE: ['OWNER', 'ADMIN', 'GUDANG'],
  PO_APPROVE: ['OWNER', 'ADMIN'],
  PO_RECEIVE: ['OWNER', 'ADMIN', 'GUDANG'],
  PURCHASE_RETURN: ['OWNER', 'ADMIN'],

  // 3. Laporan Keuangan & Stok
  REPORT_VIEW: ['OWNER', 'ADMIN', 'BOOKKEEPER'],

  // 4. Manajemen Pengguna & Pengaturan
  USER_CREATE: ['OWNER', 'ADMIN'],
  ROLE_ASSIGN: ['OWNER'], // Hanya OWNER yang berhak mengangkat/mengubah role, terutama role OWNER
  SETTINGS_VIEW: ['OWNER', 'ADMIN'], // Role KASIR, GUDANG, BOOKKEEPER tidak punya akses ke menu Pengaturan
  SETTINGS_UPDATE: ['OWNER', 'ADMIN'],

  // 5. Prompt 8: Sesi Kasir & Rekonsiliasi Kas
  CASH_SESSION_OPEN: ['OWNER', 'ADMIN', 'KASIR'],
  CASH_SESSION_CLOSE: ['OWNER', 'ADMIN', 'KASIR'],
  CASH_SESSION_VIEW: ['OWNER', 'ADMIN', 'KASIR', 'BOOKKEEPER'],

  // 6. Prompt 10: Stock Opname & Transfer Lokasi
  STOCK_OPNAME_CREATE: ['OWNER', 'ADMIN', 'GUDANG'],
  STOCK_OPNAME_COMMIT: ['OWNER', 'ADMIN'],
  STOCK_TRANSFER_CREATE: ['OWNER', 'ADMIN', 'GUDANG'],
  STOCK_TRANSFER_APPROVE: ['OWNER', 'ADMIN'],
  STOCK_TRANSFER_RECEIVE: ['OWNER', 'ADMIN', 'GUDANG'],

  // 7. Prompt 15: Google Sign-In & Backup/Restore Google Sheets
  GOOGLE_CONNECT: ['OWNER', 'ADMIN'],
  BACKUP_RUN: ['OWNER', 'ADMIN'],
  RESTORE_RUN: ['OWNER'], // OWNER saja (§4)

  // Backward-compatibility Aliases mapped to canonical definitions
  CREATE_SALE: ['OWNER', 'ADMIN', 'KASIR'],
  VOID_SALE: ['OWNER', 'ADMIN'],
  RETURN_SALE: ['OWNER', 'ADMIN'],
  RETURN_PURCHASE: ['OWNER', 'ADMIN'],
  VIEW_REPORTS: ['OWNER', 'ADMIN', 'BOOKKEEPER'],
  SETTLE_AR: ['OWNER', 'ADMIN', 'BOOKKEEPER'],
  RECEIVE_PO: ['OWNER', 'ADMIN', 'GUDANG'],
  MANAGE_USERS: ['OWNER', 'ADMIN'],
  VIEW_DASHBOARD: ['OWNER', 'ADMIN', 'BOOKKEEPER', 'KASIR', 'GUDANG'],
  VIEW_COST_HPP: ['OWNER', 'ADMIN', 'BOOKKEEPER'],
  MANAGE_STOCK: ['OWNER', 'ADMIN', 'GUDANG'],
  VIEW_JOURNAL: ['OWNER', 'ADMIN', 'BOOKKEEPER'],
  MANAGE_ACCOUNTS: ['OWNER', 'ADMIN', 'BOOKKEEPER']
};

/**
 * Fungsi pengecekan otorisasi terpusat.
 * Aturan Wajib: DEFAULT DENY jika action tidak terdaftar di matrix.
 */
export function hasPermission(role: UserRole | string | undefined, action: UserAction | string): boolean {
  if (!role || !action) {
    return false;
  }

  const allowedRoles = RBAC_MATRIX[action as UserAction];
  if (!allowedRoles || !Array.isArray(allowedRoles)) {
    // Action tidak ada di matrix -> DEFAULT DENY (fallback-deny)
    return false;
  }

  return allowedRoles.includes(role as UserRole);
}

/**
 * Metadata Aksi untuk Visualisasi Matrix di UI Pengaturan & Operasional
 */
export interface ActionMetadata {
  action: UserAction;
  label: string;
  description: string;
  allowedRoles: readonly UserRole[];
}

export const CANONICAL_ACTIONS_LIST: ActionMetadata[] = [
  {
    action: 'SALE_COMMIT',
    label: 'Proses Penjualan (Sale Commit)',
    description: 'Memproses transaksi kasir tunai & kredit serta mencatat jurnal penjualan',
    allowedRoles: RBAC_MATRIX.SALE_COMMIT
  },
  {
    action: 'SALE_VOID',
    label: 'Void Transaksi Penjualan',
    description: 'Membatalkan struk penjualan yang telah commit dan memulihkan layer stok FIFO',
    allowedRoles: RBAC_MATRIX.SALE_VOID
  },
  {
    action: 'SALE_RETURN',
    label: 'Retur Penjualan Pelanggan',
    description: 'Menerima pengembalian sembako dari pembeli tunai / piutang',
    allowedRoles: RBAC_MATRIX.SALE_RETURN
  },
  {
    action: 'CREDIT_OVERRIDE',
    label: 'Otorisasi Limit Kredit (Override)',
    description: 'Menyetujui penjualan tempo jika total piutang melebihi plafon limit kredit',
    allowedRoles: RBAC_MATRIX.CREDIT_OVERRIDE
  },
  {
    action: 'AR_SETTLE',
    label: 'Pelunasan Piutang (AR Settle)',
    description: 'Menerima pembayaran tagihan piutang dan memperbarui saldo debit/kredit kasir',
    allowedRoles: RBAC_MATRIX.AR_SETTLE
  },
  {
    action: 'PO_CREATE',
    label: 'Buat Purchase Order (PO)',
    description: 'Membuat draft pesanan pembelian barang sembako ke supplier',
    allowedRoles: RBAC_MATRIX.PO_CREATE
  },
  {
    action: 'PO_APPROVE',
    label: 'Persetujuan PO (Approve)',
    description: 'Menyetujui draft PO agar siap diterima fisik oleh gudang',
    allowedRoles: RBAC_MATRIX.PO_APPROVE
  },
  {
    action: 'PO_RECEIVE',
    label: 'Penerimaan Barang (Goods Receipt)',
    description: 'Menerima sembako di gudang, membentuk InventoryLayer FIFO, dan mencatat hutang/kas',
    allowedRoles: RBAC_MATRIX.PO_RECEIVE
  },
  {
    action: 'PURCHASE_RETURN',
    label: 'Retur Pembelian ke Supplier',
    description: 'Mengembalikan barang rusak ke supplier dan memotong layer stok FIFO',
    allowedRoles: RBAC_MATRIX.PURCHASE_RETURN
  },
  {
    action: 'REPORT_VIEW',
    label: 'Akses Laporan Keuangan & Stok',
    description: 'Melihat Buku Besar, Neraca Saldo, Laba Rugi, Neraca, dan Kartu Stok (Prompt 6)',
    allowedRoles: RBAC_MATRIX.REPORT_VIEW
  },
  {
    action: 'USER_CREATE',
    label: 'Tambah Pengguna Baru',
    description: 'Menambah staf toko baru ke dalam sistem database',
    allowedRoles: RBAC_MATRIX.USER_CREATE
  },
  {
    action: 'ROLE_ASSIGN',
    label: 'Kelola & Ubah Peran (Assign Role)',
    description: 'Mengubah role pengguna atau mengangkat akun menjadi OWNER (Eksklusif OWNER)',
    allowedRoles: RBAC_MATRIX.ROLE_ASSIGN
  },
  {
    action: 'SETTINGS_UPDATE',
    label: 'Pengaturan & Info Toko',
    description: 'Memperbarui profil toko, nama toko, dan konfigurasi sistem',
    allowedRoles: RBAC_MATRIX.SETTINGS_UPDATE
  },
  {
    action: 'CASH_SESSION_OPEN',
    label: 'Buka Sesi Kasir (Shift)',
    description: 'Membuka shift kasir baru dan mencatat uang modal awal di laci kasir',
    allowedRoles: RBAC_MATRIX.CASH_SESSION_OPEN
  },
  {
    action: 'CASH_SESSION_CLOSE',
    label: 'Tutup Sesi Kasir & Rekonsiliasi',
    description: 'Menutup shift kasir, hitung fisik uang di laci, dan catat jurnal selisih kas',
    allowedRoles: RBAC_MATRIX.CASH_SESSION_CLOSE
  },
  {
    action: 'CASH_SESSION_VIEW',
    label: 'Lihat Riwayat Sesi Kasir',
    description: 'Melihat log sesi kasir aktif dan riwayat shift yang sudah ditutup',
    allowedRoles: RBAC_MATRIX.CASH_SESSION_VIEW
  }
];
