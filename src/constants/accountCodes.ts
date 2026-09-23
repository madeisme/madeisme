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

import { Account, AccountType, JournalSide } from '../types/erp';

export const ACCOUNT_CODES = {
  KAS: '1110',
  KAS_KECIL: '1111',
  BANK: '1120',
  QRIS_CLEARING: '1130',
  PIUTANG_USAHA: '1210',
  SUPPLIER_CREDIT: '1220',
  PERSEDIAAN: '1310',
  PERSEDIAAN_DALAM_PERJALANAN: '1320',
  PERLENGKAPAN_TOKO: '1410',
  PERALATAN: '1510',
  AKUMULASI_PENYUSUTAN_PERALATAN: '1520',
  HUTANG_USAHA: '2110',
  UTANG_GAJI: '2120',
  DEPOSIT_CUSTOMER: '2130',
  UTANG_KONSINYASI: '2140',
  PPN_KELUARAN: '2210',
  PPN_MASUKAN: '2220',
  UTANG_BANK_JANGKA_PENDEK: '2310',
  MODAL_PEMILIK: '3110',
  PRIVE: '3120',
  LABA_DITAHAN: '3130',
  IKHTISAR_LABA_RUGI: '3140',
  PENJUALAN: '4110',
  DISKON_PENJUALAN: '4120',
  RETUR_PENJUALAN: '4130',
  PENDAPATAN_LAIN_LAIN: '4140',
  HPP: '5110',
  BIAYA_KIRIM: '5120',
  BIAYA_KEMASAN: '5130',
  BIAYA_KONSINYASI: '5140',
  SELISIH_PERSEDIAAN: '5900',
  SELISIH_KAS: '5910',
  BIAYA_GAJI: '6110',
  BIAYA_SEWA: '6120',
  BIAYA_LISTRIK_AIR: '6130',
  BIAYA_TELEPON_INTERNET: '6140',
  BIAYA_TRANSPORTASI: '6150',
  BIAYA_PERLENGKAPAN: '6160',
  BIAYA_PENYUSUTAN: '6170',
  BIAYA_LAIN_LAIN: '6180',
  // Backward compatibility alias untuk data lama
  BEBAN_OPERASIONAL: '5200',
  BEBAN_SEWA: '5220'
} as const;

export interface CanonicalAccountDef {
  code: string;
  name: string;
  type: AccountType;
  normalSide: JournalSide;
  description: string;
}

// JANGAN mengubah ARTI kode akun yang sudah ada (misal kode 2210 harus SELALU
// berarti PPN Keluaran). Kode ini sudah dipakai JournalLine historis sejak
// Prompt 2 — mengubah artinya (walau cuma nama akunnya) akan mengorupsi makna
// laporan keuangan yang sudah tercatat secara senyap. Kalau perlu akun baru,
// TAMBAH kode baru, jangan pakai ulang/redefinisi kode yang sudah ada.
export const CANONICAL_COA: CanonicalAccountDef[] = [
  { code: '1110', name: 'Kas', type: 'ASET', normalSide: 'DEBIT', description: 'Kas di kasir / laci tunai toko' },
  { code: '1111', name: 'Kas Kecil (Petty Cash)', type: 'ASET', normalSide: 'DEBIT', description: 'Kas kecil operasional harian toko' },
  { code: '1120', name: 'Bank', type: 'ASET', normalSide: 'DEBIT', description: 'Rekening bank operasional toko' },
  { code: '1130', name: 'QRIS Clearing', type: 'ASET', normalSide: 'DEBIT', description: 'Dana kliring penerimaan QRIS / digital' },
  { code: '1210', name: 'Piutang Usaha', type: 'ASET', normalSide: 'DEBIT', description: 'Tagihan piutang penjualan tempo ke pelanggan' },
  { code: '1220', name: 'Supplier Credit', type: 'ASET', normalSide: 'DEBIT', description: 'Kredit / deposit saldo toko di supplier' },
  { code: '1310', name: 'Persediaan Barang Dagang', type: 'ASET', normalSide: 'DEBIT', description: 'Nilai persediaan barang dagangan (FIFO layer)' },
  { code: '1320', name: 'Persediaan Dalam Perjalanan', type: 'ASET', normalSide: 'DEBIT', description: 'Persediaan PO dalam pengiriman supplier' },
  { code: '1410', name: 'Perlengkapan Toko', type: 'ASET', normalSide: 'DEBIT', description: 'Perlengkapan habis pakai toko sembako' },
  { code: '1510', name: 'Peralatan', type: 'ASET', normalSide: 'DEBIT', description: 'Peralatan operasional (rak, timbangan, komputer kasir)' },
  { code: '1520', name: 'Akumulasi Penyusutan Peralatan', type: 'ASET', normalSide: 'CREDIT', description: 'Kontra aset akumulasi penyusutan peralatan' },
  { code: '2110', name: 'Utang Usaha', type: 'LIABILITAS', normalSide: 'CREDIT', description: 'Kewajiban utang dagang ke supplier atas PO kredit' },
  { code: '2120', name: 'Utang Gaji', type: 'LIABILITAS', normalSide: 'CREDIT', description: 'Kewajiban gaji karyawan yang belum terbayar' },
  { code: '2130', name: 'Deposit Customer', type: 'LIABILITAS', normalSide: 'CREDIT', description: 'Titipan saldo / uang muka dari pelanggan' },
  { code: '2140', name: 'Utang Konsinyasi', type: 'LIABILITAS', normalSide: 'CREDIT', description: 'Kewajiban pembayaran barang konsinyasi terjual' },
  { code: '2210', name: 'PPN Keluaran', type: 'LIABILITAS', normalSide: 'CREDIT', description: 'Kewajiban PPN atas penjualan jika PPN diaktifkan' },
  { code: '2220', name: 'PPN Masukan', type: 'LIABILITAS', normalSide: 'DEBIT', description: 'Pajak masukan atas pembelian dari supplier PKP' },
  { code: '2310', name: 'Utang Bank Jangka Pendek', type: 'LIABILITAS', normalSide: 'CREDIT', description: 'Kewajiban pinjaman modal kerja bank' },
  { code: '3110', name: 'Modal Pemilik', type: 'EKUITAS', normalSide: 'CREDIT', description: 'Modal awal & tambahan modal masuk dari pemilik toko' },
  { code: '3120', name: 'Prive', type: 'EKUITAS', normalSide: 'DEBIT', description: 'Penarikan dana pribadi pemilik toko' },
  { code: '3130', name: 'Laba Ditahan', type: 'EKUITAS', normalSide: 'CREDIT', description: 'Akumulasi saldo laba bersih periode sebelumnya' },
  { code: '3140', name: 'Ikhtisar Laba Rugi', type: 'EKUITAS', normalSide: 'CREDIT', description: 'Akun perantara tutup buku pendapatan & beban' },
  { code: '4110', name: 'Penjualan', type: 'PENDAPATAN', normalSide: 'CREDIT', description: 'Pendapatan bruto hasil penjualan barang sembako' },
  { code: '4120', name: 'Diskon Penjualan', type: 'PENDAPATAN', normalSide: 'DEBIT', description: 'Kontra pendapatan atas diskon penjualan barang' },
  { code: '4130', name: 'Retur Penjualan', type: 'PENDAPATAN', normalSide: 'DEBIT', description: 'Kontra pendapatan atas pengembalian barang pelanggan' },
  { code: '4140', name: 'Pendapatan Lain-lain', type: 'PENDAPATAN', normalSide: 'CREDIT', description: 'Pendapatan non-operasional toko lainnya' },
  { code: '5110', name: 'Harga Pokok Penjualan', type: 'BEBAN', normalSide: 'DEBIT', description: 'Harga Pokok Penjualan yang terhitung dari FIFO layer' },
  { code: '5120', name: 'Biaya Kirim', type: 'BEBAN', normalSide: 'DEBIT', description: 'Biaya ekspedisi & ongkos kirim pengiriman barang' },
  { code: '5130', name: 'Biaya Kemasan', type: 'BEBAN', normalSide: 'DEBIT', description: 'Biaya kardus, kantong kresek, bubble wrap' },
  { code: '5140', name: 'Biaya Konsinyasi', type: 'BEBAN', normalSide: 'DEBIT', description: 'Biaya komisi / bagi hasil barang konsinyasi' },
  { code: '5900', name: 'Selisih Penyesuaian Persediaan', type: 'BEBAN', normalSide: 'DEBIT', description: 'Selisih penyesuaian stock opname fisik vs sistem' },
  { code: '5910', name: 'Selisih Kas', type: 'BEBAN', normalSide: 'DEBIT', description: 'Selisih lebih atau kurang kas fisik saat tutup shift' },
  { code: '6110', name: 'Biaya Gaji', type: 'BEBAN', normalSide: 'DEBIT', description: 'Biaya gaji dan upah karyawan toko' },
  { code: '6120', name: 'Biaya Sewa', type: 'BEBAN', normalSide: 'DEBIT', description: 'Biaya sewa tempat, ruko, kios, atau gudang' },
  { code: '6130', name: 'Biaya Listrik & Air', type: 'BEBAN', normalSide: 'DEBIT', description: 'Biaya utilitas listrik PLN dan PDAM toko' },
  { code: '6140', name: 'Biaya Telepon & Internet', type: 'BEBAN', normalSide: 'DEBIT', description: 'Biaya pulsa, kuota data, dan WiFi toko' },
  { code: '6150', name: 'Biaya Transportasi', type: 'BEBAN', normalSide: 'DEBIT', description: 'Biaya bensin dan operasional armada toko' },
  { code: '6160', name: 'Biaya Perlengkapan', type: 'BEBAN', normalSide: 'DEBIT', description: 'Biaya alat tulis, kertas struk, dan ATK kasir' },
  { code: '6170', name: 'Biaya Penyusutan', type: 'BEBAN', normalSide: 'DEBIT', description: 'Beban penyusutan aset tetap & peralatan toko' },
  { code: '6180', name: 'Biaya Lain-lain', type: 'BEBAN', normalSide: 'DEBIT', description: 'Beban operasional umum dan lain-lain toko' }
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
