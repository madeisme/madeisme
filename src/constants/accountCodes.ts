/**
 * Chart of Accounts (COA) Canonical Constants
 * 
 * Sesuai Audit #1 (Prompt 9):
 * Satu sumber kebenaran untuk seluruh kode akun di Omah Sembako Sehati ERP.
 * 
 * | Kode | Nama               | Tipe              |
 * |------|--------------------|-------------------|
 * | 1110 | KAS                | ASET              |
 * | 1210 | PIUTANG_USAHA      | ASET              |
 * | 1310 | PERSEDIAAN         | ASET              |
 * | 2110 | HUTANG_USAHA       | LIABILITAS        |
 * | 2210 | PPN_KELUARAN       | LIABILITAS        |
 * | 4110 | PENJUALAN          | PENDAPATAN        |
 * | 4120 | DISKON_PENJUALAN   | KONTRA-PENDAPATAN |
 * | 5110 | HPP                | BEBAN             |
 * | 5910 | SELISIH_KAS        | BEBAN             |
 */

import { Account, AccountType } from '../types/erp';

export const ACCOUNT_CODES = {
  KAS: '1110',
  PIUTANG_USAHA: '1210',
  PERSEDIAAN: '1310',
  HUTANG_USAHA: '2110',
  PPN_KELUARAN: '2210',
  MODAL_PEMILIK: '3110', // Ekuitas Modal Masuk Pemilik
  PENJUALAN: '4110',
  DISKON_PENJUALAN: '4120',
  HPP: '5110',
  BEBAN_OPERASIONAL: '5200', // Pengeluaran operasional toko (listrik, air, perlengkapan, dll)
  BEBAN_SEWA: '5220', // Beban sewa tempat/gedung/kios
  SELISIH_PERSEDIAAN: '5900', // Prompt 10 §3: Selisih Stock Opname (BEBAN)
  SELISIH_KAS: '5910',
} as const;

export interface CanonicalAccountDef {
  code: string;
  name: string;
  type: AccountType;
  description: string;
}

export const CANONICAL_COA: CanonicalAccountDef[] = [
  { code: ACCOUNT_CODES.KAS, name: 'KAS', type: 'ASET', description: 'Kas di kasir / laci tunai toko' },
  { code: ACCOUNT_CODES.PIUTANG_USAHA, name: 'PIUTANG_USAHA', type: 'ASET', description: 'Tagihan piutang penjualan tempo ke pelanggan' },
  { code: ACCOUNT_CODES.PERSEDIAAN, name: 'PERSEDIAAN', type: 'ASET', description: 'Nilai persediaan barang dagangan (FIFO layer)' },
  { code: ACCOUNT_CODES.HUTANG_USAHA, name: 'HUTANG_USAHA', type: 'LIABILITAS', description: 'Kewajiban hutang dagang ke supplier atas PO kredit' },
  { code: ACCOUNT_CODES.PPN_KELUARAN, name: 'PPN_KELUARAN', type: 'LIABILITAS', description: 'Kewajiban PPN atas penjualan jika PPN diaktifkan' },
  { code: ACCOUNT_CODES.MODAL_PEMILIK, name: 'MODAL_PEMILIK', type: 'EKUITAS', description: 'Modal awal & tambahan modal masuk dari pemilik toko' },
  { code: ACCOUNT_CODES.PENJUALAN, name: 'PENJUALAN', type: 'PENDAPATAN', description: 'Pendapatan bruto hasil penjualan barang sembako' },
  { code: ACCOUNT_CODES.DISKON_PENJUALAN, name: 'DISKON_PENJUALAN', type: 'KONTRA-PENDAPATAN', description: 'Pengurang pendapatan atas diskon penjualan' },
  { code: ACCOUNT_CODES.HPP, name: 'HPP', type: 'BEBAN', description: 'Harga Pokok Penjualan yang terhitung dari FIFO layer' },
  { code: ACCOUNT_CODES.BEBAN_OPERASIONAL, name: 'BEBAN_OPERASIONAL', type: 'BEBAN', description: 'Pengeluaran beban operasional harian toko (listrik, air, operasional)' },
  { code: ACCOUNT_CODES.BEBAN_SEWA, name: 'BEBAN_SEWA', type: 'BEBAN', description: 'Beban sewa tempat, kios, atau gedung toko' },
  { code: ACCOUNT_CODES.SELISIH_PERSEDIAAN, name: 'SELISIH_PERSEDIAAN', type: 'BEBAN', description: 'Selisih penyesuaian stock opname fisik vs sistem' },
  { code: ACCOUNT_CODES.SELISIH_KAS, name: 'SELISIH_KAS', type: 'BEBAN', description: 'Selisih lebih atau kurang kas fisik saat tutup shift' },
];

export function getCanonicalAccount(code: string): CanonicalAccountDef | undefined {
  return CANONICAL_COA.find(a => a.code === code);
}

export function getAccountName(code: string, customAccounts?: Account[]): string {
  if (customAccounts) {
    const acc = customAccounts.find(a => a.code === code);
    if (acc) return acc.name;
  }
  const canonical = getCanonicalAccount(code);
  return canonical ? canonical.name : `AKUN_${code}`;
}

export function getAccountType(code: string, customAccounts?: Account[]): AccountType {
  if (customAccounts) {
    const acc = customAccounts.find(a => a.code === code);
    if (acc) return acc.type;
  }
  const canonical = getCanonicalAccount(code);
  return canonical ? canonical.type : 'BEBAN';
}
