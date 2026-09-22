/**
 * OMAH SEMBAKO SEHATI — CORE DATA MODEL & BUSINESS RULES
 * 
 * Aturan Bisnis Non-Negosiasi:
 * 1. Immutable after commit: Sale, Journal, InventoryLayer tidak pernah di-UPDATE/DELETE setelah commit.
 * 2. Double-entry wajib seimbang: Setiap Journal, total baris DEBIT harus persis sama dengan total baris CREDIT (integer Rupiah).
 * 3. FIFO untuk biaya stok: Barang keluar (penjualan) dikonsumsi dari InventoryLayer yang paling lama lebih dulu (berdasarkan receivedAt).
 * 4. Rounding per baris, bukan per total: Tiap SaleLine dihitung & dibulatkan sendiri-sendiri; total = sum(rounded lines).
 * 5. Role-based access (RBAC): 5 role (OWNER, ADMIN, BOOKKEEPER, KASIR, GUDANG). hasPermission(role, action).
 */

export type UserRole = 'OWNER' | 'ADMIN' | 'BOOKKEEPER' | 'KASIR' | 'GUDANG';

export type ItemType = 'EQT' | 'KNS' | 'AFL'; // Default EQT untuk sekarang

export type AccountType = 
  | 'ASET' 
  | 'LIABILITAS' 
  | 'EKUITAS' 
  | 'PENDAPATAN' 
  | 'KONTRA-PENDAPATAN' 
  | 'BEBAN';

export type JournalSide = 'DEBIT' | 'CREDIT';

// Prompt 5: Sale statuses with REVERSED (void), RETURNED (full return), PARTIALLY_RETURNED
export type SaleStatus = 'DRAFT' | 'VALIDATED' | 'COMMITTED' | 'REVERSED' | 'RETURNED' | 'PARTIALLY_RETURNED';

// 1. Store (id, name) — single store, 1 row aktif
export interface Store {
  id: string;
  name: string;
  owner?: string;
  address?: string;
  phone?: string;
}

// 2. User (id, name, role)
export interface User {
  id: string;
  name: string;
  role: UserRole;
  phone?: string;
}

// 3. Product (id, name, unit, sellPrice: Long, itemType: EQT)
export interface Product {
  id: string;
  name: string;
  unit: string;
  sellPrice: number; // Long integer dalam satuan Rupiah
  itemType: ItemType;
  category?: string;
  minStockAlert?: number;
}

// 4. Customer (id, name, phone, arBalance: Long, creditLimit: Long, creditTermsDays: Int)
export interface Customer {
  id: string;
  name: string;
  phone: string;
  arBalance: number; // Piutang (Accounts Receivable) in Rupiah (Long)
  creditLimit: number; // Long integer Rupiah (0 = tidak boleh kredit sama sekali)
  creditTermsDays: number; // Default 30 hari jika kosong
}

// 5. Supplier (id, name, phone, apBalance: Long, contacts, payment terms, bank details)
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  apBalance: number; // Hutang (Accounts Payable) in Rupiah (Long)
  contactPerson?: string; // Nama penanggung jawab / PIC / Sales representative
  email?: string; // Email kontak
  address?: string; // Alamat kantor/gudang supplier
  city?: string; // Kota supplier
  bankName?: string; // Bank pembayaran (misal BCA, Mandiri, BRI, BNI)
  bankAccountNo?: string; // Nomor rekening bank
  bankAccountName?: string; // Nama pemilik rekening
  paymentTermsDays?: number; // Tempo pembayaran hari (misal 14 atau 30 hari, 0 = Tunai/COD)
  notes?: string; // Catatan khusus (jadwal kirim, minimal order, diskon)
  isActive?: boolean; // Status aktif (default true)
  createdAt?: string; // Tanggal pendaftaran supplier
}

// 6. InventoryLayer (id, productId, quantityRemaining, unitCost: Long, receivedAt, location) — Satu batch FIFO
export interface InventoryLayer {
  id: string;
  productId: string;
  quantityRemaining: number;
  unitCost: number; // Long integer dalam satuan Rupiah
  receivedAt: string; // ISO Timestamp
  location?: string; // Prompt 10: "GUDANG" | "TOKO" (default GUDANG)
  sourcePurchaseId?: string;
  sourceReceiptId?: string;
}

// 7. Sale (id, customerId?, status, subtotal: Long, ppnAmount: Long, grandTotal: Long, businessDate)
export interface Sale {
  id: string;
  clientSaleKey: string; // UUID untuk idempotency (§4)
  customerId?: string;
  status: SaleStatus; // DRAFT -> VALIDATED -> COMMITTED -> REVERSED | RETURNED | PARTIALLY_RETURNED
  paymentMethod: 'CASH' | 'CREDIT'; // Prompt 4
  dueDate?: string; // YYYY-MM-DD, hanya diisi jika CREDIT
  creditOverride?: boolean; // true jika di-override oleh OWNER/ADMIN saat melebihi limit kredit
  subtotal: number; // Long integer Rupiah
  discountCode?: string; // Kode voucher / kupon promo (misal HEMAT10)
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: number; // Nilai promo (e.g. 10% atau Rp 5.000)
  discountAmount?: number; // Nilai rupiah potongan penjualan (Akun 4120)
  ppnAmount: number; // Long integer Rupiah
  grandTotal: number; // Long integer Rupiah (subtotal - discountAmount + ppnAmount)
  cashPaid: number; // Long integer Rupiah (0 untuk CREDIT)
  changeAmount: number; // Long integer Rupiah (0 untuk CREDIT)
  cashierName: string;
  userId?: string; // ID user kasir yang memproses transaksi (Prompt 8)
  cashSessionId?: string; // ID sesi kasir yang aktif saat transaksi
  businessDate: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
}

// 8. SaleLine (id, saleId, productId, qty, unitPrice: Long, hppLine: Long)
export interface SaleLine {
  id: string;
  saleId: string;
  productId: string;
  qty: number;
  unitPrice: number; // Long integer Rupiah
  hppLine: number; // Long integer Rupiah
  ppnLine?: number; // Long integer Rupiah (jika PPN toggle aktif)
  returnedQty?: number; // Qty yang sudah diretur (default 0)
  consumedLayers?: {
    layerId: string;
    qty: number;
    unitCost: number;
  }[];
}

// 9. Journal (id, refType, refId, businessDate)
export interface Journal {
  id: string;
  refType: string; // misal: 'SALE', 'PURCHASE', 'ADJUSTMENT'
  refId: string;
  businessDate: string; // YYYY-MM-DD
}

// 10. JournalLine (id, journalId, accountCode, side: DEBIT|CREDIT, amount: Long)
export interface JournalLine {
  id: string;
  journalId: string;
  accountCode: string;
  side: JournalSide;
  amount: number; // Long integer Rupiah
}

// 11. Account (code, name, type) — 8 Seed accounts
export interface Account {
  code: string;
  name: string;
  type: AccountType;
}

// Cart Item state for Kasir tab (persisted across tab changes)
export interface CartItem {
  productId: string;
  qty: number;
  unitPrice: number; // Long integer Rupiah
}

// Prompt 3 & 5: Purchase Entities
export type PurchaseStatus = 'DRAFT' | 'APPROVED' | 'RECEIVING' | 'RECEIVED' | 'RETURNED';
export type PurchasePaymentMethod = 'CASH' | 'CREDIT';

export interface Purchase {
  id: string; // e.g. PO-20260917-0001
  supplierId: string;
  status: PurchaseStatus;
  paymentMethod: PurchasePaymentMethod; // CASH | CREDIT
  businessDate: string; // YYYY-MM-DD
  subtotal: number; // Long integer Rupiah
  ppnAmount: number; // Long integer Rupiah (default 0 for sembako)
  grandTotal: number; // Long integer Rupiah
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export interface PurchaseLine {
  id: string;
  purchaseId: string;
  productId: string;
  qtyOrdered: number;
  qtyReceivedCumulative: number;
  qtyReturned?: number; // Qty barang yang diretur ke supplier
  poPrice: number; // Long integer Rupiah (harga beli terkunci)
}

export interface PurchaseReceipt {
  id: string; // e.g. RC-20260917-0001
  purchaseId: string;
  receivedAt: string; // ISO timestamp
  businessDate: string; // YYYY-MM-DD
  receivedBy: string;
  notes?: string;
  itemsReceived?: {
    lineId: string;
    productId: string;
    qtyReceived: number;
    poPrice: number;
    layerId: string;
  }[];
}

// Prompt 4: Piutang Usaha (Accounts Receivable / AR)
export type ArTransactionType = 'SALE_CREDIT' | 'AR_SETTLE';

export interface ArTransaction {
  id: string; // e.g. "AR-202609-001"
  customerId: string;
  type: ArTransactionType; // SALE_CREDIT (tambah piutang) | AR_SETTLE (pelunasan piutang)
  amount: number; // Long integer Rupiah
  businessDate: string; // YYYY-MM-DD
  refSaleId?: string; // ID Sale yang berkaitan (jika ada)
  notes?: string;
  userId?: string; // ID kasir yang memproses pelunasan (Prompt 8)
  cashSessionId?: string;
  createdAt: string; // ISO timestamp
}

// Prompt 5: Sale Return & Purchase Return records
export interface SaleReturn {
  id: string; // e.g. "SR-20260917-0001"
  saleId: string;
  businessDate: string; // YYYY-MM-DD
  returnedBy: string;
  returnedByUserId?: string; // ID user yang memproses retur (Prompt 8)
  cashSessionId?: string;
  reason?: string;
  totalSubtotal: number;
  totalPpn: number;
  totalHpp: number;
  totalRefund: number; // totalSubtotal + totalPpn
  items: {
    lineId: string;
    productId: string;
    qtyReturned: number;
    returnSubtotal: number;
    returnPpn: number;
    returnHpp: number;
    newLayerId: string;
  }[];
  journalId: string;
  createdAt: string; // ISO timestamp
}

export interface PurchaseReturn {
  id: string; // e.g. "PR-20260917-0001"
  purchaseId: string;
  supplierId: string;
  businessDate: string; // YYYY-MM-DD
  returnedBy: string;
  reason?: string;
  totalAmount: number;
  items: {
    lineId: string;
    productId: string;
    qtyReturned: number;
    poPrice: number;
    layerId: string;
  }[];
  journalId: string;
  createdAt: string; // ISO timestamp
}

// Prompt 8: Sesi Kasir (CashSession)
export type CashSessionStatus = 'OPEN' | 'CLOSED';

export interface CashSession {
  id: string; // e.g. "CS-20260918-0001"
  storeId: string;
  userId: string; // kasir yang buka sesi
  status: CashSessionStatus; // OPEN | CLOSED
  openedAt: string; // ISO timestamp
  openingFloat: number; // uang modal awal di laci kasir saat buka
  closedAt?: string; // ISO timestamp saat ditutup
  systemExpectedCash?: number; // dihitung sistem saat tutup (Prompt 8 §4)
  actualCash?: number; // hasil hitung fisik oleh kasir
  variance?: number; // actualCash - systemExpectedCash (negatif = kurang, positif = lebih)
  journalId?: string; // ID jurnal selisih kas (5910) jika variance != 0
  closedByUserId?: string; // user yang menutup sesi (kasir sendiri atau OWNER/ADMIN)
  notes?: string;
}

// Prompt 10: Stock Opname & Transfer Lokasi
export type StockLocation = 'GUDANG' | 'TOKO';

export type StockOpnameStatus = 'DRAFT' | 'COMMITTED';

export interface StockOpname {
  id: string; // e.g. "OPN-20260918-0001"
  businessDate: string; // YYYY-MM-DD
  userId: string;
  location: StockLocation;
  status: StockOpnameStatus; // DRAFT | COMMITTED
  notes?: string;
  createdAt: string; // ISO timestamp
  committedAt?: string; // ISO timestamp
  journalId?: string; // Jurnal selisih persediaan jika ada varians
  totalVarianceValueLebih?: number;
  totalVarianceValueKurang?: number;
}

export interface StockOpnameLine {
  id: string;
  opnameId: string;
  productId: string;
  physicalQty: number;
  location: StockLocation;
  systemQtyLive?: number; // dihitung sistem saat commit
  varianceQty?: number; // physicalQty - systemQtyLive
  unitCostAvg?: number; // unitCostRata2
  varianceValue?: number; // |varianceQty| * unitCostAvg
}

export type StockTransferStatus = 'DRAFT' | 'APPROVED' | 'RECEIVING' | 'COMPLETED';

export interface StockTransfer {
  id: string; // e.g. "TRF-20260918-0001"
  transferNumber?: string;
  fromLocation: StockLocation;
  toLocation: StockLocation;
  status: StockTransferStatus; // DRAFT | APPROVED | RECEIVING | COMPLETED
  businessDate: string; // YYYY-MM-DD
  userId: string; // pembuat DRAFT
  approvedBy?: string; // approver
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface StockTransferLine {
  id: string;
  transferId: string;
  productId: string;
  qtyRequested: number;
  qtyReceivedCumulative: number;
}

// Prompt 15: Google Sign-In & Backup/Restore Google Sheets
export interface GoogleAccountLink {
  userId: string;
  googleEmail: string;
  googleDisplayName: string;
  googlePhotoUrl?: string;
  connectedAt: string; // ISO timestamp
  isConnected?: boolean;
}

export interface BackupConfig {
  id: string; // "DEFAULT"
  googleEmail: string;
  fileId: string;
  fileName?: string;
  lastBackupAt?: string;
  lastRestoreAt?: string;
  schemaVersion: number;
}

export interface BackupMetadata {
  schemaVersion: number;
  exportedAt: string;
  storeName: string;
  totalRecordsPerTable: Record<string, number>;
}

// Pengeluaran Operasional (Layar Operasional)
export interface OperationalExpense {
  id: string; // e.g. "EXP-20260920-0001"
  category: string; // e.g. "Listrik & Air", "Perlengkapan Toko", "Transport & Logistik", dll
  amount: number; // Long integer Rupiah
  businessDate: string; // YYYY-MM-DD
  notes?: string;
  receiptNumber?: string;
  userId?: string;
  createdByName: string;
  journalId: string;
  createdAt: string; // ISO timestamp
}

// Transaksi Jurnal Umum Non-Kasir (Layar Operasional)
export type GeneralJournalCategory = 
  | 'MODAL_MASUK'
  | 'BEBAN_LISTRIK'
  | 'BEBAN_SEWA'
  | 'BEBAN_OPERASIONAL'
  | 'PENARIKAN_PRIVE'
  | 'LAINNYA';

export interface GeneralJournalLineItem {
  id: string;
  accountCode: string;
  side: JournalSide;
  amount: number;
  description?: string;
}

export interface GeneralJournalTransaction {
  id: string; // e.g. "GJ-20260920-0001"
  businessDate: string; // YYYY-MM-DD
  description: string;
  refNumber?: string;
  category: GeneralJournalCategory;
  lines: GeneralJournalLineItem[];
  totalAmount: number; // total debit === total credit
  userId?: string;
  createdByName: string;
  journalId: string;
  createdAt: string; // ISO timestamp
}

// 18. Promotion & Promo Code (Layar Kasir)
export type PromotionType = 'PERCENTAGE' | 'FIXED';

export interface Promotion {
  id: string;
  code: string; // Kode unik promo, uppercase (e.g. "HEMAT10", "SEMBAKO5K")
  name: string; // Nama promo (e.g. "Diskon Belanja Sembako 10%")
  type: PromotionType; // 'PERCENTAGE' (persen) | 'FIXED' (nominal Rp)
  value: number; // Nilai persentase (e.g. 10 untuk 10%) atau nominal Rupiah (e.g. 5000)
  minPurchase: number; // Minimal pembelanjaan (Rupiah), default 0
  maxDiscount?: number; // Batas maksimum potongan (hanya relevan jika type === 'PERCENTAGE')
  startDate?: string; // Tanggal mulai berlaku (YYYY-MM-DD)
  endDate?: string; // Tanggal berakhir promo (YYYY-MM-DD)
  isActive: boolean; // Status aktif
  usageCount: number; // Berapa kali kupon promo ini telah digunakan
  description?: string; // Catatan atau syarat & ketentuan singkat
  createdAt: string; // ISO timestamp
}





