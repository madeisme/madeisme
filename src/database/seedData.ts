import {
  Account,
  Store,
  User,
  Product,
  Customer,
  Supplier,
  InventoryLayer,
  Sale,
  SaleLine,
  Journal,
  JournalLine,
  Purchase,
  PurchaseLine,
  PurchaseReceipt,
  ArTransaction,
  OperationalExpense,
  GeneralJournalTransaction,
  Promotion
} from '../types/erp';
import { CANONICAL_COA } from '../constants/accountCodes';

// 40 Akun Chart of Accounts (COA) resmi dihasilkan dari CANONICAL_COA
export const SEED_ACCOUNTS: Account[] = CANONICAL_COA.map(c => ({
  code: c.code,
  name: c.name,
  type: c.type
}));

export const SEED_STORE: Store = {
  id: 'STR-001',
  name: 'Omah Sembako Sehati'
};

export const SEED_USERS: User[] = [
  { id: 'USR-001', name: 'Pak Budi Santoso', role: 'OWNER' },
  { id: 'USR-002', name: 'Siti Aminah', role: 'KASIR' },
  { id: 'USR-003', name: 'Mas Joko Prabowo', role: 'GUDANG' },
  { id: 'USR-004', name: 'Bu Rahayu', role: 'BOOKKEEPER' },
  { id: 'USR-005', name: 'Rendra Kurnia', role: 'ADMIN' }
];

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'PRD-001',
    name: 'Gula Pasir Gulaku Kuning 1kg',
    unit: 'kg',
    sellPrice: 15000,
    itemType: 'EQT',
    category: 'Sembako Utama',
    minStockAlert: 8
  },
  {
    id: 'PRD-002',
    name: 'Beras Rojolele Super 5kg',
    unit: 'sak',
    sellPrice: 72000,
    itemType: 'EQT',
    category: 'Beras & Biji',
    minStockAlert: 10
  },
  {
    id: 'PRD-003',
    name: 'Minyak Goreng Bimoli 2L',
    unit: 'pouch',
    sellPrice: 38000,
    itemType: 'EQT',
    category: 'Minyak & Lemak',
    minStockAlert: 6
  },
  {
    id: 'PRD-004',
    name: 'Telur Ayam Ras Segar 1kg',
    unit: 'kg',
    sellPrice: 28000,
    itemType: 'EQT',
    category: 'Unggas & Telur',
    minStockAlert: 10
  },
  {
    id: 'PRD-005',
    name: 'Tepung Terigu Segitiga Biru 1kg',
    unit: 'kg',
    sellPrice: 13000,
    itemType: 'EQT',
    category: 'Tepung & Olahan',
    minStockAlert: 10
  },
  {
    id: 'PRD-006',
    name: 'Indomie Goreng Spesial (Karton 40 pcs)',
    unit: 'dus',
    sellPrice: 118000,
    itemType: 'EQT',
    category: 'Mie & Pasta',
    minStockAlert: 5
  },
  {
    id: 'PRD-007',
    name: 'Susu Kental Manis Frisian Flag 370g',
    unit: 'kaleng',
    sellPrice: 12500,
    itemType: 'EQT',
    category: 'Susu & Minuman',
    minStockAlert: 12
  }
];

export const SEED_CUSTOMERS: Customer[] = [
  { 
    id: 'CUST-001', 
    name: 'Warung Bu RT Maryam', 
    phone: '0812-3456-7890', 
    arBalance: 150000, 
    creditLimit: 1000000, 
    creditTermsDays: 30 
  },
  { 
    id: 'CUST-002', 
    name: 'Kantin Bu Sri', 
    phone: '0819-8765-4321', 
    arBalance: 0, 
    creditLimit: 750000, 
    creditTermsDays: 14 
  },
  { 
    id: 'CUST-003', 
    name: 'Pelanggan Tunai Kasir', 
    phone: '-', 
    arBalance: 0, 
    creditLimit: 0, // 0 = tidak boleh kredit sama sekali (§2 & §3)
    creditTermsDays: 0 
  },
  { 
    id: 'CUST-004', 
    name: 'Bu Rina (Sembako Rumahan)', 
    phone: '0813-9988-7766', 
    arBalance: 0, 
    creditLimit: 500000, // Sesuai contoh konkret Prompt 4 (§6): limit 500.000, terms 14 hari
    creditTermsDays: 14 
  }
];

export const SEED_SUPPLIERS: Supplier[] = [
  { 
    id: 'SUP-001', 
    name: 'PT Sinar Pangan Distribusi', 
    phone: '0821-1234-5678', 
    contactPerson: 'Bambang Hartono (Sales Supervisor)',
    email: 'order@sinarpangan.co.id',
    address: 'Kawasan Industri Rungkut Blok B-12, Surabaya',
    city: 'Surabaya',
    bankName: 'BCA',
    bankAccountNo: '088-2938-192',
    bankAccountName: 'PT Sinar Pangan Distribusi',
    paymentTermsDays: 14,
    notes: 'Distributor utama minyak goreng kemasan dan gula pasir GMP. Pengiriman setiap Selasa & Jumat.',
    isActive: true,
    createdAt: '2026-08-01',
    apBalance: 2400000 
  },
  { 
    id: 'SUP-002', 
    name: 'Agen Beras Makmur Sentosa', 
    phone: '0852-9876-1234', 
    contactPerson: 'H. Sudirman (Pemilik)',
    email: 'berasmakmur@gmail.com',
    address: 'Pasar Induk Beras Cipinang Kios D-45, Jakarta Timur',
    city: 'Jakarta Timur',
    bankName: 'Mandiri',
    bankAccountNo: '142-00-1928374-1',
    bankAccountName: 'H. Sudirman',
    paymentTermsDays: 30,
    notes: 'Suplai beras Rojolele & Pandan Wangi kualitas super per sak 25kg & 50kg. Minimal order 10 sak.',
    isActive: true,
    createdAt: '2026-08-05',
    apBalance: 0 
  },
  { 
    id: 'SUP-003', 
    name: 'Peternak Telur Sejahtera Blitar', 
    phone: '0813-4567-8901', 
    contactPerson: 'Suryadi (Koordinator Kandang)',
    email: 'telurblitar.sejahtera@gmail.com',
    address: 'Desa Ponggok RT 03/RW 02, Kec. Ponggok, Blitar',
    city: 'Blitar',
    bankName: 'BRI',
    bankAccountNo: '0129-01-002938-53-4',
    bankAccountName: 'Suryadi',
    paymentTermsDays: 7,
    notes: 'Telur ayam ras segar grade A per peti 15kg. Kiriman tiba subuh setiap 2 hari.',
    isActive: true,
    createdAt: '2026-08-10',
    apBalance: 560000 
  }
];

// Initial inventory layers representing FIFO batches
export const SEED_INVENTORY_LAYERS: InventoryLayer[] = [
  {
    id: 'INV-001',
    productId: 'PRD-001', // Gula Pasir
    quantityRemaining: 10,
    unitCost: 12000,
    receivedAt: '2026-09-10T08:00:00Z',
    location: 'GUDANG'
  },
  {
    id: 'INV-002',
    productId: 'PRD-002', // Beras Rojolele
    quantityRemaining: 22,
    unitCost: 62000,
    receivedAt: '2026-09-12T09:30:00Z',
    location: 'GUDANG'
  },
  {
    id: 'INV-003',
    productId: 'PRD-003', // Minyak Goreng
    quantityRemaining: 14,
    unitCost: 32000,
    receivedAt: '2026-09-13T10:15:00Z',
    location: 'GUDANG'
  },
  {
    id: 'INV-004',
    productId: 'PRD-004', // Telur Ayam (Stok menipis: 4 kg vs min 10 kg)
    quantityRemaining: 4,
    unitCost: 24000,
    receivedAt: '2026-09-15T07:00:00Z',
    location: 'GUDANG'
  },
  {
    id: 'INV-005',
    productId: 'PRD-005', // Tepung Segitiga Biru
    quantityRemaining: 35,
    unitCost: 10500,
    receivedAt: '2026-09-14T11:00:00Z',
    location: 'GUDANG'
  },
  {
    id: 'INV-006',
    productId: 'PRD-006', // Indomie Dus
    quantityRemaining: 8,
    unitCost: 102000,
    receivedAt: '2026-09-11T14:20:00Z',
    location: 'GUDANG'
  },
  {
    id: 'INV-007',
    productId: 'PRD-007', // Susu
    quantityRemaining: 24,
    unitCost: 10200,
    receivedAt: '2026-09-15T15:00:00Z',
    location: 'GUDANG'
  }
];

// Prompt 4: Initial Credit Sale and AR Transactions
export const SEED_SALES: Sale[] = [
  {
    id: 'SL-20260910-0001',
    clientSaleKey: 'seed-sale-key-001',
    customerId: 'CUST-001', // Warung Bu RT Maryam
    status: 'COMMITTED',
    paymentMethod: 'CREDIT',
    dueDate: '2026-10-10', // 30 hari jatuh tempo
    creditOverride: false,
    subtotal: 150000,
    ppnAmount: 0,
    grandTotal: 150000,
    cashPaid: 0,
    changeAmount: 0,
    cashierName: 'Siti Aminah',
    businessDate: '2026-09-10',
    createdAt: '2026-09-10T10:15:00.000Z'
  }
];

export const SEED_SALE_LINES: SaleLine[] = [
  {
    id: 'SL-20260910-0001-1',
    saleId: 'SL-20260910-0001',
    productId: 'PRD-001', // Gula Pasir 10kg
    qty: 10,
    unitPrice: 15000,
    hppLine: 120000,
    ppnLine: 0
  }
];

export const SEED_JOURNALS: Journal[] = [
  {
    id: 'JRN-20260901-0001',
    refType: 'EXPENSE',
    refId: 'SALDO-AWAL-PERSEDIAAN',
    businessDate: '2026-09-01'
  },
  {
    id: 'JRN-20260910-0001',
    refType: 'SALE',
    refId: 'SL-20260910-0001',
    businessDate: '2026-09-10'
  }
];

export const SEED_JOURNAL_LINES: JournalLine[] = [
  { id: 'JRN-20260901-0001-1', journalId: 'JRN-20260901-0001', accountCode: '1310', side: 'DEBIT', amount: 3576300 },
  { id: 'JRN-20260901-0001-2', journalId: 'JRN-20260901-0001', accountCode: '3110', side: 'CREDIT', amount: 3576300 },
  { id: 'JRN-20260910-0001-1', journalId: 'JRN-20260910-0001', accountCode: '1210', side: 'DEBIT', amount: 150000 },
  { id: 'JRN-20260910-0001-2', journalId: 'JRN-20260910-0001', accountCode: '5110', side: 'DEBIT', amount: 120000 },
  { id: 'JRN-20260910-0001-3', journalId: 'JRN-20260910-0001', accountCode: '4110', side: 'CREDIT', amount: 150000 },
  { id: 'JRN-20260910-0001-4', journalId: 'JRN-20260910-0001', accountCode: '1310', side: 'CREDIT', amount: 120000 }
];

export const SEED_AR_TRANSACTIONS: ArTransaction[] = [
  {
    id: 'AR-20260910-0001',
    customerId: 'CUST-001',
    type: 'SALE_CREDIT',
    amount: 150000,
    businessDate: '2026-09-10',
    refSaleId: 'SL-20260910-0001',
    notes: 'Penjualan sembako tempo 30 hari (Warung Bu RT)',
    createdAt: '2026-09-10T10:15:00.000Z'
  }
];

// Prompt 3: Initial PO matching the concrete scenario (§6)
export const SEED_PURCHASES: Purchase[] = [
  {
    id: 'PO-20260916-0001',
    supplierId: 'SUP-001', // PT Sinar Pangan Distribusi
    status: 'APPROVED',
    paymentMethod: 'CREDIT',
    businessDate: '2026-09-16',
    subtotal: 240000,
    ppnAmount: 0,
    grandTotal: 240000,
    createdBy: 'Pak Joko (GUDANG)',
    createdAt: '2026-09-16T08:00:00.000Z',
    approvedBy: 'Pak Budi (OWNER)',
    approvedAt: '2026-09-16T08:30:00.000Z',
    notes: 'Restock gula pasir 20 unit siap terima parsial (§6)'
  }
];

export const SEED_PURCHASE_LINES: PurchaseLine[] = [
  {
    id: 'POL-20260916-0001-1',
    purchaseId: 'PO-20260916-0001',
    productId: 'PRD-001', // Gula Pasir Putih 1kg
    qtyOrdered: 20,
    qtyReceivedCumulative: 0,
    poPrice: 12000
  }
];

export const SEED_PURCHASE_RECEIPTS: PurchaseReceipt[] = [];

// Pengeluaran Operasional Awal (Layar Operasional)
export const SEED_OPERATIONAL_EXPENSES: OperationalExpense[] = [
  {
    id: 'EXP-20260918-0001',
    category: 'Listrik & Air',
    amount: 350000,
    businessDate: '2026-09-18',
    notes: 'Token Listrik PLN & Tagihan PDAM Toko September',
    receiptNumber: 'PLN-99214',
    userId: 'USR-001',
    createdByName: 'Pak Budi Santoso',
    journalId: 'JRN-EXP-20260918-0001',
    createdAt: '2026-09-18T09:00:00.000Z'
  },
  {
    id: 'EXP-20260919-0001',
    category: 'Perlengkapan Toko',
    amount: 120000,
    businessDate: '2026-09-19',
    notes: 'Pembelian kantong kresek ramah lingkungan & kertas kasir thermal',
    receiptNumber: 'NOTA-8812',
    userId: 'USR-002',
    createdByName: 'Siti Aminah',
    journalId: 'JRN-EXP-20260919-0001',
    createdAt: '2026-09-19T14:30:00.000Z'
  },
  {
    id: 'EXP-20260920-0001',
    category: 'Kebersihan & Keamanan',
    amount: 75000,
    businessDate: '2026-09-20',
    notes: 'Iuran kebersihan sampah lingkungan & keamanan ruko',
    receiptNumber: 'IUR-202609',
    userId: 'USR-001',
    createdByName: 'Pak Budi Santoso',
    journalId: 'JRN-EXP-20260920-0001',
    createdAt: '2026-09-20T08:15:00.000Z'
  }
];

// Seed Data Jurnal Umum Transaksi Non-Kasir
export const SEED_GENERAL_JOURNALS: GeneralJournalTransaction[] = [
  {
    id: 'GJ-20260915-0001',
    businessDate: '2026-09-15',
    description: 'Setoran Modal Awal Tunai Toko oleh Pemilik',
    refNumber: 'MODAL-01',
    category: 'MODAL_MASUK',
    totalAmount: 10000000,
    userId: 'USR-001',
    createdByName: 'Pak Budi Santoso',
    journalId: 'JRN-GJ-20260915-0001',
    createdAt: '2026-09-15T08:00:00.000Z',
    lines: [
      { id: 'GJL-001-1', accountCode: '1110', side: 'DEBIT', amount: 10000000, description: 'Penerimaan Kas Modal Masuk' },
      { id: 'GJL-001-2', accountCode: '3110', side: 'CREDIT', amount: 10000000, description: 'Setoran Modal Pemilik' }
    ]
  },
  {
    id: 'GJ-20260916-0001',
    businessDate: '2026-09-16',
    description: 'Pembayaran Beban Sewa Kios Toko Bulan September',
    refNumber: 'SEWA-KOS-09',
    category: 'BEBAN_SEWA',
    totalAmount: 1500000,
    userId: 'USR-001',
    createdByName: 'Pak Budi Santoso',
    journalId: 'JRN-GJ-20260916-0001',
    createdAt: '2026-09-16T10:00:00.000Z',
    lines: [
      { id: 'GJL-002-1', accountCode: '5220', side: 'DEBIT', amount: 1500000, description: 'Beban Sewa Kios Toko' },
      { id: 'GJL-002-2', accountCode: '1110', side: 'CREDIT', amount: 1500000, description: 'Pembayaran Kas Tunai Sewa' }
    ]
  },
  {
    id: 'GJ-20260918-0002',
    businessDate: '2026-09-18',
    description: 'Pembayaran Beban Listrik & Token PLN Toko',
    refNumber: 'PLN-99214',
    category: 'BEBAN_LISTRIK',
    totalAmount: 350000,
    userId: 'USR-001',
    createdByName: 'Pak Budi Santoso',
    journalId: 'JRN-GJ-20260918-0002',
    createdAt: '2026-09-18T09:30:00.000Z',
    lines: [
      { id: 'GJL-003-1', accountCode: '5200', side: 'DEBIT', amount: 350000, description: 'Beban Listrik Toko' },
      { id: 'GJL-003-2', accountCode: '1110', side: 'CREDIT', amount: 350000, description: 'Pembayaran Kas Listrik' }
    ]
  }
];

// Seed Promosi & Diskon Layar Kasir
export const SEED_PROMOTIONS: Promotion[] = [
  {
    id: 'PRM-001',
    code: 'HEMAT10',
    name: 'Diskon Sembako 10%',
    type: 'PERCENTAGE',
    value: 10,
    minPurchase: 50000,
    maxDiscount: 15000,
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    isActive: true,
    usageCount: 4,
    description: 'Potongan 10% untuk pembelanjaan sembako minimal Rp 50.000 (Maksimal potongan Rp 15.000)',
    createdAt: '2026-09-01T08:00:00.000Z'
  },
  {
    id: 'PRM-002',
    code: 'SEMBAKO5K',
    name: 'Potongan Langsung Rp 5.000',
    type: 'FIXED',
    value: 5000,
    minPurchase: 75000,
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    isActive: true,
    usageCount: 7,
    description: 'Potongan belanja langsung Rp 5.000 setiap transaksi minimal Rp 75.000',
    createdAt: '2026-09-01T08:00:00.000Z'
  },
  {
    id: 'PRM-003',
    code: 'JUMATBERKAH',
    name: 'Jumat Berkah Diskon Rp 10.000',
    type: 'FIXED',
    value: 10000,
    minPurchase: 150000,
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    isActive: true,
    usageCount: 2,
    description: 'Spesial belanja grosir sembako minimal Rp 150.000 potong langsung Rp 10.000',
    createdAt: '2026-09-05T08:00:00.000Z'
  },
  {
    id: 'PRM-004',
    code: 'MEMBER5',
    name: 'Diskon Member Setia 5%',
    type: 'PERCENTAGE',
    value: 5,
    minPurchase: 25000,
    maxDiscount: 20000,
    startDate: '2026-08-01',
    endDate: '2026-12-31',
    isActive: true,
    usageCount: 12,
    description: 'Diskon 5% untuk pelanggan setia dan tetangga sekitar tanpa batasan hari',
    createdAt: '2026-08-01T08:00:00.000Z'
  }
];


