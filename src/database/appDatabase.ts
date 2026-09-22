/**
 * OmahSembakoDatabase — Room SQLite Database representation
 * 
 * Sesuai arsitektur di Prompt 1:
 * - Room DAO layer untuk 11 entitas
 * - Inisialisasi otomatis 8 Chart of Accounts (§6)
 * - Semua nominal integer Long (satuan Rupiah)
 * - State management reactive
 */

import {
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
  Account,
  CartItem,
  Purchase,
  PurchaseLine,
  PurchaseReceipt,
  ArTransaction,
  SaleReturn,
  PurchaseReturn,
  CashSession,
  UserRole,
  StockLocation,
  StockOpname,
  StockOpnameLine,
  StockTransfer,
  StockTransferLine,
  GoogleAccountLink,
  BackupConfig,
  OperationalExpense,
  GeneralJournalTransaction,
  GeneralJournalCategory,
  GeneralJournalLineItem,
  Promotion
} from '../types/erp';
import { hasPermission } from '../rbac/permissions';
import {
  SEED_ACCOUNTS,
  SEED_STORE,
  SEED_USERS,
  SEED_PRODUCTS,
  SEED_CUSTOMERS,
  SEED_SUPPLIERS,
  SEED_INVENTORY_LAYERS,
  SEED_SALES,
  SEED_SALE_LINES,
  SEED_JOURNALS,
  SEED_JOURNAL_LINES,
  SEED_PURCHASES,
  SEED_PURCHASE_LINES,
  SEED_PURCHASE_RECEIPTS,
  SEED_AR_TRANSACTIONS,
  SEED_OPERATIONAL_EXPENSES,
  SEED_GENERAL_JOURNALS,
  SEED_PROMOTIONS
} from './seedData';
import { isDateOverdue, getDaysRemainingOrOverdue } from '../utils/formatters';

export interface IdempotencyRecord {
  key: string;
  refType: string;
  refId: string;
  createdAt: string;
}

export interface TaxInvoiceRecord {
  id: string;
  invoiceNumber: string;
  saleId?: string;
  generatedAt: string;
}

export interface DatabaseSchema {
  stores: Store[];
  users: User[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  inventoryLayers: InventoryLayer[];
  sales: Sale[];
  saleLines: SaleLine[];
  journals: Journal[];
  journalLines: JournalLine[];
  accounts: Account[];
  purchases: Purchase[];
  purchaseLines: PurchaseLine[];
  purchaseReceipts: PurchaseReceipt[];
  arTransactions: ArTransaction[];
  saleReturns: SaleReturn[];
  purchaseReturns: PurchaseReturn[];
  cashSessions: CashSession[]; // Prompt 8: Sesi Kasir
  stockOpnames: StockOpname[]; // Prompt 10: Stock Opname
  stockOpnameLines: StockOpnameLine[];
  stockTransfers: StockTransfer[]; // Prompt 10: Transfer Lokasi
  stockTransferLines: StockTransferLine[];
  // Prompt 15: Google Sign-In & Backup/Restore
  googleAccountLinks: GoogleAccountLink[];
  backupConfigs: BackupConfig[];
  operationalExpenses: OperationalExpense[];
  generalJournals: GeneralJournalTransaction[];
  promotions: Promotion[];
  taxInvoiceNumbers?: TaxInvoiceRecord[];
  idempotencyKeys?: IdempotencyRecord[];
}

export const IDB_DATABASE_NAME = 'omah_sembako_erp_db';
export const IDB_VERSION = 1;
export const STORAGE_KEY = 'omah_sembako_room_db_v1';
export const IDB_MIGRATED_KEY = 'omah_sembako_idb_migrated';

export const IDB_STORES = {
  STORES: 'stores',
  USERS: 'users',
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  INVENTORY_LAYERS: 'inventory_layers',
  SALES: 'sales',
  SALE_LINES: 'sale_lines',
  JOURNALS: 'journals',
  JOURNAL_LINES: 'journal_lines',
  ACCOUNTS: 'accounts',
  PURCHASES: 'purchases',
  PURCHASE_LINES: 'purchase_lines',
  PURCHASE_RECEIPTS: 'purchase_receipts',
  AR_TRANSACTIONS: 'ar_transactions',
  SALE_RETURNS: 'sale_returns',
  PURCHASE_RETURNS: 'purchase_returns',
  CASH_SESSIONS: 'cash_sessions',
  STOCK_OPNAMES: 'stock_opnames',
  STOCK_OPNAME_LINES: 'stock_opname_lines',
  STOCK_TRANSFERS: 'stock_transfers',
  STOCK_TRANSFER_LINES: 'stock_transfer_lines',
  TAX_INVOICE_NUMBERS: 'tax_invoice_numbers',
  GOOGLE_ACCOUNT_LINKS: 'google_account_links',
  BACKUP_CONFIGS: 'backup_configs',
  OPERATIONAL_EXPENSES: 'operational_expenses',
  GENERAL_JOURNALS: 'general_journals',
  PROMOTIONS: 'promotions',
  IDEMPOTENCY_KEYS: 'idempotency_keys'
} as const;

export const ALL_IDB_STORE_NAMES = Object.values(IDB_STORES) as string[];

export const SCHEMA_KEY_TO_STORE: Record<string, string> = {
  stores: IDB_STORES.STORES,
  users: IDB_STORES.USERS,
  products: IDB_STORES.PRODUCTS,
  customers: IDB_STORES.CUSTOMERS,
  suppliers: IDB_STORES.SUPPLIERS,
  inventoryLayers: IDB_STORES.INVENTORY_LAYERS,
  sales: IDB_STORES.SALES,
  saleLines: IDB_STORES.SALE_LINES,
  journals: IDB_STORES.JOURNALS,
  journalLines: IDB_STORES.JOURNAL_LINES,
  accounts: IDB_STORES.ACCOUNTS,
  purchases: IDB_STORES.PURCHASES,
  purchaseLines: IDB_STORES.PURCHASE_LINES,
  purchaseReceipts: IDB_STORES.PURCHASE_RECEIPTS,
  arTransactions: IDB_STORES.AR_TRANSACTIONS,
  saleReturns: IDB_STORES.SALE_RETURNS,
  purchaseReturns: IDB_STORES.PURCHASE_RETURNS,
  cashSessions: IDB_STORES.CASH_SESSIONS,
  stockOpnames: IDB_STORES.STOCK_OPNAMES,
  stockOpnameLines: IDB_STORES.STOCK_OPNAME_LINES,
  stockTransfers: IDB_STORES.STOCK_TRANSFERS,
  stockTransferLines: IDB_STORES.STOCK_TRANSFER_LINES,
  taxInvoiceNumbers: IDB_STORES.TAX_INVOICE_NUMBERS,
  googleAccountLinks: IDB_STORES.GOOGLE_ACCOUNT_LINKS,
  backupConfigs: IDB_STORES.BACKUP_CONFIGS,
  operationalExpenses: IDB_STORES.OPERATIONAL_EXPENSES,
  generalJournals: IDB_STORES.GENERAL_JOURNALS,
  promotions: IDB_STORES.PROMOTIONS,
  idempotencyKeys: IDB_STORES.IDEMPOTENCY_KEYS
};

export const STORE_TO_SCHEMA_KEY: Record<string, string> = {};
for (const [k, v] of Object.entries(SCHEMA_KEY_TO_STORE)) {
  STORE_TO_SCHEMA_KEY[v] = k;
}

export class AppDatabase {
  private data: DatabaseSchema;
  private listeners: Set<() => void> = new Set();
  private dbInstance: IDBDatabase | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  public isReady: boolean = false;
  public readyPromise: Promise<void>;
  
  // Navigation & Screen Retained States (Aturan §3: Pindah tab tidak mereset state tab asal)
  public activeTab: 'beranda' | 'kasir' | 'beli' | 'stok' | 'operasional' = 'beranda';
  public kasirCart: CartItem[] = [];
  public kasirSearchQuery: string = '';
  public kasirSelectedCategory: string = 'Semua';
  public stokSearchQuery: string = '';
  public currentUser: User = SEED_USERS[0];

  constructor() {
    // 1. Initial synchronous hydration (baca dari localStorage jika ada sisa data lama sebelum migrasi)
    let initialData: DatabaseSchema;
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          initialData = this.sanitizeDatabaseSchema(parsed);
        } catch {
          initialData = this.createFirstRunDatabase();
        }
      } else {
        initialData = this.createFirstRunDatabase();
      }
    } else {
      initialData = this.createFirstRunDatabase();
    }

    this.data = initialData;
    if (this.data.users && this.data.users.length > 0) {
      this.currentUser = this.data.users[0];
    } else {
      this.currentUser = {
        id: 'GUEST',
        name: 'Pemilik Toko',
        role: 'OWNER',
        phone: ''
      };
    }

    // 2. Jalankan inisialisasi IndexedDB & migrasi otomatis di background
    this.readyPromise = this.initStorage();
  }

  /**
   * Buka koneksi IndexedDB dan buat 29 object stores dengan primary key & indeks sesuai spesifikasi
   */
  private openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB tidak tersedia di runtime ini'));
        return;
      }

      const req = window.indexedDB.open(IDB_DATABASE_NAME, IDB_VERSION);

      req.onupgradeneeded = () => {
        const idb = req.result;
        for (const storeName of ALL_IDB_STORE_NAMES) {
          if (!idb.objectStoreNames.contains(storeName)) {
            let keyPath: string = 'id';
            if (storeName === IDB_STORES.ACCOUNTS) keyPath = 'code';
            else if (storeName === IDB_STORES.GOOGLE_ACCOUNT_LINKS) keyPath = 'userId';
            else if (storeName === IDB_STORES.IDEMPOTENCY_KEYS) keyPath = 'key';

            const os = idb.createObjectStore(storeName, { keyPath });

            // Indeks relasional sekunder untuk query cepat
            if (storeName === IDB_STORES.SALES) {
              os.createIndex('clientSaleKey', 'clientSaleKey', { unique: false });
              os.createIndex('customerId', 'customerId', { unique: false });
              os.createIndex('businessDate', 'businessDate', { unique: false });
            } else if (storeName === IDB_STORES.SALE_LINES) {
              os.createIndex('saleId', 'saleId', { unique: false });
              os.createIndex('productId', 'productId', { unique: false });
            } else if (storeName === IDB_STORES.JOURNALS) {
              os.createIndex('refId', 'refId', { unique: false });
              os.createIndex('refType', 'refType', { unique: false });
            } else if (storeName === IDB_STORES.JOURNAL_LINES) {
              os.createIndex('journalId', 'journalId', { unique: false });
              os.createIndex('accountCode', 'accountCode', { unique: false });
            } else if (storeName === IDB_STORES.INVENTORY_LAYERS) {
              os.createIndex('productId', 'productId', { unique: false });
              os.createIndex('location', 'location', { unique: false });
            } else if (storeName === IDB_STORES.PURCHASE_LINES) {
              os.createIndex('purchaseId', 'purchaseId', { unique: false });
            } else if (storeName === IDB_STORES.AR_TRANSACTIONS) {
              os.createIndex('customerId', 'customerId', { unique: false });
            } else if (storeName === IDB_STORES.CASH_SESSIONS) {
              os.createIndex('userId', 'userId', { unique: false });
              os.createIndex('status', 'status', { unique: false });
            }
          }
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Normalisasi primary key record agar tidak pernah null/undefined saat insert ke IndexedDB
   */
  private normalizeRecordKey(storeName: string, rec: any): any {
    if (!rec || typeof rec !== 'object') return rec;
    const clone = { ...rec };
    if (storeName === IDB_STORES.ACCOUNTS) {
      if (!clone.code) clone.code = 'UNKNOWN';
    } else if (storeName === IDB_STORES.GOOGLE_ACCOUNT_LINKS) {
      if (!clone.userId) clone.userId = clone.id || 'DEFAULT';
    } else if (storeName === IDB_STORES.IDEMPOTENCY_KEYS) {
      if (!clone.key) clone.key = clone.id || String(Date.now() + Math.random());
    } else {
      if (!clone.id) clone.id = String(Date.now() + Math.random());
    }
    return clone;
  }

  /**
   * Inisialisasi storage IndexedDB & jalankan migrasi otomatis jika ada localStorage
   */
  private async initStorage(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.isReady = true;
      return;
    }

    try {
      const idb = await this.openIDB();
      this.dbInstance = idb;

      // Cek apakah ada data lama di localStorage
      const legacyRaw = typeof window !== 'undefined' && window.localStorage
        ? localStorage.getItem(STORAGE_KEY)
        : null;

      if (legacyRaw) {
        console.log('[IndexedDB Migration] Ditemukan data lama di localStorage. Memulai migrasi otomatis...');
        let parsedLegacy: any;
        try {
          parsedLegacy = JSON.parse(legacyRaw);
        } catch (err) {
          console.error('[IndexedDB Migration] Format JSON localStorage tidak valid:', err);
        }

        if (parsedLegacy) {
          const sanitized = this.sanitizeDatabaseSchema(parsedLegacy);
          this.data = sanitized;
          if (sanitized.users && sanitized.users.length > 0) {
            this.currentUser = sanitized.users[0];
          }

          // Tulis seluruh tabel ke IndexedDB dalam SATU IDBTransaction atomik
          await this.writeAllToIndexedDBAtomic(idb, sanitized);

          // Verifikasi integritas data di IndexedDB sebelum menghapus dari localStorage
          const isVerified = await this.verifyIDBStores(idb);
          if (isVerified) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.setItem(IDB_MIGRATED_KEY, new Date().toISOString());
            console.log('[IndexedDB Migration] Migrasi 100% SUKSES. Data lama localStorage telah dihapus.');
          } else {
            console.warn('[IndexedDB Migration] Verifikasi data gagal. localStorage dipertahankan sementara.');
          }

          this.isReady = true;
          this.notify();
          return;
        }
      }

      // Jika tidak ada data di localStorage, baca data dari IndexedDB
      const loadedFromIDB = await this.readAllFromIndexedDB(idb);
      const hasDataInIDB = loadedFromIDB.accounts && loadedFromIDB.accounts.length >= 8;

      if (hasDataInIDB) {
        this.data = this.sanitizeDatabaseSchema(loadedFromIDB);
        if (this.data.users && this.data.users.length > 0) {
          this.currentUser = this.data.users.find(u => u.id === this.currentUser.id) || this.data.users[0];
        }
        console.log('[IndexedDB] Data berhasil dimuat dari IndexedDB.');
      } else {
        // Install baru: IndexedDB kosong
        console.log('[IndexedDB] Database baru terdeteksi kosong. Menulis data inisial...');
        await this.writeAllToIndexedDBAtomic(idb, this.data);
      }

      this.isReady = true;
      this.notify();
    } catch (err) {
      console.error('[IndexedDB] Gagal menginisialisasi IndexedDB:', err);
      this.isReady = true;
    }
  }

  /**
   * Tulis seluruh 29 object stores dalam satu IDBTransaction atomik
   */
  private writeAllToIndexedDBAtomic(idb: IDBDatabase, schema: DatabaseSchema): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(ALL_IDB_STORE_NAMES, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));

      for (const [schemaKey, storeName] of Object.entries(SCHEMA_KEY_TO_STORE)) {
        const records = (schema as any)[schemaKey] || [];
        const os = tx.objectStore(storeName);
        os.clear();
        for (const rec of records) {
          os.put(this.normalizeRecordKey(storeName, rec));
        }
      }

      // Sinkronkan juga idempotency keys dari sales
      const idempStore = tx.objectStore(IDB_STORES.IDEMPOTENCY_KEYS);
      idempStore.clear();
      const existingKeys = schema.idempotencyKeys || [];
      for (const ik of existingKeys) {
        idempStore.put(ik);
      }
      for (const sale of schema.sales || []) {
        if (sale.clientSaleKey && !existingKeys.some(k => k.key === sale.clientSaleKey)) {
          idempStore.put({
            key: sale.clientSaleKey,
            refType: 'SALE',
            refId: sale.id,
            createdAt: sale.createdAt || sale.businessDate || new Date().toISOString()
          });
        }
      }
    });
  }

  /**
   * Baca seluruh 29 object stores dari IndexedDB
   */
  private readAllFromIndexedDB(idb: IDBDatabase): Promise<Partial<DatabaseSchema>> {
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(ALL_IDB_STORE_NAMES, 'readonly');
      const result: Partial<DatabaseSchema> = {};

      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);

      for (const [schemaKey, storeName] of Object.entries(SCHEMA_KEY_TO_STORE)) {
        const os = tx.objectStore(storeName);
        const req = os.getAll();
        req.onsuccess = () => {
          (result as any)[schemaKey] = req.result || [];
        };
      }
    });
  }

  /**
   * Verifikasi bahwa tabel IndexedDB memiliki isi yang sah
   */
  private verifyIDBStores(idb: IDBDatabase): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const tx = idb.transaction([IDB_STORES.ACCOUNTS], 'readonly');
        const os = tx.objectStore(IDB_STORES.ACCOUNTS);
        const countReq = os.count();
        countReq.onsuccess = () => {
          resolve(countReq.result >= 8);
        };
        countReq.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Persist atomik ke IndexedDB untuk stores yang terdampak menggunakan IDBTransaction
   */
  private persistToIndexedDB(affectedStoreNames?: string[]): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.resolve();
    }

    const storesToLock = (affectedStoreNames && affectedStoreNames.length > 0)
      ? affectedStoreNames.filter(s => ALL_IDB_STORE_NAMES.includes(s))
      : ALL_IDB_STORE_NAMES;

    if (storesToLock.length === 0) {
      return Promise.resolve();
    }

    this.writeQueue = this.writeQueue.then(async () => {
      try {
        if (!this.dbInstance) {
          this.dbInstance = await this.openIDB();
        }
        const idb = this.dbInstance;

        await new Promise<void>((resolve, reject) => {
          const tx = idb.transaction(storesToLock, 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));

          for (const storeName of storesToLock) {
            const schemaKey = STORE_TO_SCHEMA_KEY[storeName];
            if (!schemaKey) continue;
            const records = (this.data as any)[schemaKey] || [];
            const os = tx.objectStore(storeName);
            os.clear();
            for (const rec of records) {
              os.put(this.normalizeRecordKey(storeName, rec));
            }
          }
        });
      } catch (err) {
        console.error('[IndexedDB] Gagal menyimpan ke IndexedDB:', err);
      }
    });

    return this.writeQueue;
  }

  /**
   * Helper diagnostik & verifikasi untuk mengecek jumlah record di setiap store IndexedDB
   */
  public async getIndexedDBRecordCounts(): Promise<Record<string, number>> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return {};
    }
    if (!this.dbInstance) {
      this.dbInstance = await this.openIDB();
    }
    const idb = this.dbInstance;
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(ALL_IDB_STORE_NAMES, 'readonly');
      const counts: Record<string, number> = {};
      let completed = 0;

      for (const storeName of ALL_IDB_STORE_NAMES) {
        const os = tx.objectStore(storeName);
        const req = os.count();
        req.onsuccess = () => {
          counts[storeName] = req.result;
          completed++;
          if (completed === ALL_IDB_STORE_NAMES.length) {
            resolve(counts);
          }
        };
        req.onerror = () => {
          counts[storeName] = -1;
          completed++;
          if (completed === ALL_IDB_STORE_NAMES.length) {
            resolve(counts);
          }
        };
      }
    });
  }

  /**
   * Menunggu hingga inisialisasi IndexedDB dan antrean tulis selesai
   */
  public async waitUntilReady(): Promise<void> {
    await this.readyPromise;
    await this.writeQueue;
  }

  // Idempotency Key Management (§2.2)
  public recordIdempotencyKey(key: string, refType: string, refId: string): void {
    if (!this.data.idempotencyKeys) {
      this.data.idempotencyKeys = [];
    }
    const exists = this.data.idempotencyKeys.some(ik => ik.key === key);
    if (!exists) {
      this.data.idempotencyKeys.push({
        key,
        refType,
        refId,
        createdAt: new Date().toISOString()
      });
      this.persistToIndexedDB([IDB_STORES.IDEMPOTENCY_KEYS]);
    }
  }

  public getIdempotencyKey(key: string): IdempotencyRecord | undefined {
    if (!this.data.idempotencyKeys) return undefined;
    return this.data.idempotencyKeys.find(ik => ik.key === key);
  }

  public hasIdempotencyKey(key: string): boolean {
    return !!this.getIdempotencyKey(key);
  }

  public getAllIdempotencyKeys(): IdempotencyRecord[] {
    return this.data.idempotencyKeys ? [...this.data.idempotencyKeys] : [];
  }

  // Tax Invoice Number Management (§2.1)
  public getAllTaxInvoiceNumbers(): TaxInvoiceRecord[] {
    return this.data.taxInvoiceNumbers ? [...this.data.taxInvoiceNumbers] : [];
  }

  public recordTaxInvoiceNumber(invoice: { id?: string; invoiceNumber: string; saleId?: string }): TaxInvoiceRecord {
    if (!this.data.taxInvoiceNumbers) {
      this.data.taxInvoiceNumbers = [];
    }
    const record: TaxInvoiceRecord = {
      id: invoice.id || `TAX-${Date.now()}`,
      invoiceNumber: invoice.invoiceNumber,
      saleId: invoice.saleId,
      generatedAt: new Date().toISOString()
    };
    this.data.taxInvoiceNumbers.push(record);
    this.persistToIndexedDB([IDB_STORES.TAX_INVOICE_NUMBERS]);
    return record;
  }

  /**
   * Sanitasi dan migrasi struktur DatabaseSchema
   */
  private sanitizeDatabaseSchema(parsed: any): DatabaseSchema {
    if (!parsed || typeof parsed !== 'object') {
      return this.createFirstRunDatabase();
    }

    const schema: DatabaseSchema = {
      stores: Array.isArray(parsed.stores) ? parsed.stores : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
      inventoryLayers: Array.isArray(parsed.inventoryLayers) ? parsed.inventoryLayers : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      saleLines: Array.isArray(parsed.saleLines) ? parsed.saleLines : [],
      journals: Array.isArray(parsed.journals) ? parsed.journals : [],
      journalLines: Array.isArray(parsed.journalLines) ? parsed.journalLines : [],
      accounts: Array.isArray(parsed.accounts) && parsed.accounts.length >= 8 ? parsed.accounts : [...SEED_ACCOUNTS],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [...SEED_PURCHASES],
      purchaseLines: Array.isArray(parsed.purchaseLines) ? parsed.purchaseLines : [...SEED_PURCHASE_LINES],
      purchaseReceipts: Array.isArray(parsed.purchaseReceipts) ? parsed.purchaseReceipts : [...SEED_PURCHASE_RECEIPTS],
      arTransactions: Array.isArray(parsed.arTransactions) ? parsed.arTransactions : [...SEED_AR_TRANSACTIONS],
      saleReturns: Array.isArray(parsed.saleReturns) ? parsed.saleReturns : [],
      purchaseReturns: Array.isArray(parsed.purchaseReturns) ? parsed.purchaseReturns : [],
      cashSessions: Array.isArray(parsed.cashSessions) ? parsed.cashSessions : [],
      stockOpnames: Array.isArray(parsed.stockOpnames) ? parsed.stockOpnames : [],
      stockOpnameLines: Array.isArray(parsed.stockOpnameLines) ? parsed.stockOpnameLines : [],
      stockTransfers: Array.isArray(parsed.stockTransfers) ? parsed.stockTransfers : [],
      stockTransferLines: Array.isArray(parsed.stockTransferLines) ? parsed.stockTransferLines : [],
      googleAccountLinks: Array.isArray(parsed.googleAccountLinks) ? parsed.googleAccountLinks : [],
      backupConfigs: Array.isArray(parsed.backupConfigs) ? parsed.backupConfigs : [],
      operationalExpenses: Array.isArray(parsed.operationalExpenses) ? parsed.operationalExpenses : [...SEED_OPERATIONAL_EXPENSES],
      generalJournals: Array.isArray(parsed.generalJournals) ? parsed.generalJournals : [...SEED_GENERAL_JOURNALS],
      promotions: Array.isArray(parsed.promotions) ? parsed.promotions : [...SEED_PROMOTIONS],
      taxInvoiceNumbers: Array.isArray(parsed.taxInvoiceNumbers) ? parsed.taxInvoiceNumbers : [],
      idempotencyKeys: Array.isArray(parsed.idempotencyKeys) ? parsed.idempotencyKeys : []
    };

    // Migrasi akun 5910 SELISIH_KAS
    if (!schema.accounts.some((a: Account) => a.code === '5910')) {
      schema.accounts.push({ code: '5910', name: 'SELISIH_KAS', type: 'BEBAN' });
    }
    // Migrasi akun 5900 SELISIH_PERSEDIAAN
    if (!schema.accounts.some((a: Account) => a.code === '5900')) {
      schema.accounts.push({ code: '5900', name: 'SELISIH_PERSEDIAAN', type: 'BEBAN' });
    }
    // Migrasi akun 5200 BEBAN_OPERASIONAL
    if (!schema.accounts.some((a: Account) => a.code === '5200')) {
      schema.accounts.push({ code: '5200', name: 'BEBAN_OPERASIONAL', type: 'BEBAN' });
    }
    // Migrasi akun 3110 MODAL_PEMILIK
    if (!schema.accounts.some((a: Account) => a.code === '3110')) {
      schema.accounts.push({ code: '3110', name: 'MODAL_PEMILIK', type: 'EKUITAS' });
    }
    // Migrasi akun 5220 BEBAN_SEWA
    if (!schema.accounts.some((a: Account) => a.code === '5220')) {
      schema.accounts.push({ code: '5220', name: 'BEBAN_SEWA', type: 'BEBAN' });
    }

    // BackupConfig sanitasi
    schema.backupConfigs.forEach((b: BackupConfig) => {
      if (b.schemaVersion === undefined) b.schemaVersion = 1;
      if (b.googleEmail === undefined) {
        const link = schema.googleAccountLinks?.[0];
        b.googleEmail = link?.googleEmail || '';
      }
    });

    // InventoryLayers default location
    schema.inventoryLayers.forEach((l: InventoryLayer) => {
      if (!l.location) l.location = 'GUDANG';
    });

    // Customer credit limit & Bu Rina
    schema.customers.forEach((c: Customer) => {
      if (c.creditLimit === undefined) {
        const seedCust = SEED_CUSTOMERS.find(sc => sc.id === c.id);
        c.creditLimit = seedCust ? seedCust.creditLimit : 0;
      }
      if (c.creditTermsDays === undefined) {
        const seedCust = SEED_CUSTOMERS.find(sc => sc.id === c.id);
        c.creditTermsDays = seedCust ? seedCust.creditTermsDays : 30;
      }
    });
    if (!schema.customers.some((c: Customer) => c.id === 'CUST-004')) {
      const buRina = SEED_CUSTOMERS.find(sc => sc.id === 'CUST-004');
      if (buRina) schema.customers.push(buRina);
    }

    // Sales paymentMethod
    schema.sales.forEach((s: Sale) => {
      if (!s.paymentMethod) s.paymentMethod = 'CASH';
    });

    return schema;
  }

  /**
   * Database kosong untuk First-Run Setup (Prompt 7 §3).
   * Tabel users kosong agar memicu onboarding screen.
   */
  public createFirstRunDatabase(): DatabaseSchema {
    const freshDb: DatabaseSchema = {
      stores: [],
      users: [],
      products: [],
      customers: [],
      suppliers: [],
      inventoryLayers: [],
      sales: [],
      saleLines: [],
      journals: [],
      journalLines: [],
      accounts: [...SEED_ACCOUNTS],
      purchases: [],
      purchaseLines: [],
      purchaseReceipts: [],
      arTransactions: [],
      saleReturns: [],
      purchaseReturns: [],
      cashSessions: [],
      stockOpnames: [],
      stockOpnameLines: [],
      stockTransfers: [],
      stockTransferLines: [],
      googleAccountLinks: [],
      backupConfigs: [],
      operationalExpenses: [],
      generalJournals: [],
      promotions: [...SEED_PROMOTIONS],
      taxInvoiceNumbers: [],
      idempotencyKeys: []
    };
    this.persist(freshDb);
    return freshDb;
  }

  public createSeedDatabase(): DatabaseSchema {
    const seed: DatabaseSchema = {
      stores: [SEED_STORE],
      users: [...SEED_USERS],
      products: [...SEED_PRODUCTS],
      customers: [...SEED_CUSTOMERS],
      suppliers: [...SEED_SUPPLIERS],
      inventoryLayers: [...SEED_INVENTORY_LAYERS],
      sales: [...SEED_SALES],
      saleLines: [...SEED_SALE_LINES],
      journals: [...SEED_JOURNALS],
      journalLines: [...SEED_JOURNAL_LINES],
      accounts: [...SEED_ACCOUNTS],
      purchases: [...SEED_PURCHASES],
      purchaseLines: [...SEED_PURCHASE_LINES],
      purchaseReceipts: [...SEED_PURCHASE_RECEIPTS],
      arTransactions: [...SEED_AR_TRANSACTIONS],
      saleReturns: [],
      purchaseReturns: [],
      cashSessions: [],
      stockOpnames: [],
      stockOpnameLines: [],
      stockTransfers: [],
      stockTransferLines: [],
      googleAccountLinks: [],
      backupConfigs: [],
      operationalExpenses: [...SEED_OPERATIONAL_EXPENSES],
      generalJournals: [...SEED_GENERAL_JOURNALS],
      promotions: [...SEED_PROMOTIONS],
      taxInvoiceNumbers: [],
      idempotencyKeys: []
    };
    this.persist(seed);
    return seed;
  }

  /**
   * Menyimpan perubahan data ke in-memory state dan commit atomik ke IndexedDB via IDBTransaction.
   * localStorage tidak lagi digunakan sebagai blob penyimpanan data.
   */
  private persist(dataToSave: DatabaseSchema = this.data, affectedStores?: string[]) {
    try {
      this.data = dataToSave;
      this.persistToIndexedDB(affectedStores);
    } catch (e) {
      console.error('Gagal menyimpan database ke IndexedDB', e);
    }
    this.notify();
  }

  public resetToSeed() {
    this.data = this.createSeedDatabase();
    this.currentUser = this.data.users[0];
    this.kasirCart = [];
    this.kasirSearchQuery = '';
    this.stokSearchQuery = '';
    this.persist();
  }

  /**
   * Reset / bersihkan data users untuk menguji First-Run Setup Onboarding
   * Sesuai Kriteria Selesai 1 & 2
   */
  public clearDataForFirstRun() {
    this.data = this.createFirstRunDatabase();
    this.currentUser = {
      id: 'GUEST',
      name: 'Belum Terdaftar',
      role: 'OWNER',
      phone: ''
    };
    this.kasirCart = [];
    this.kasirSearchQuery = '';
    this.stokSearchQuery = '';
    this.persist();
  }

  /**
   * Cek apakah aplikasi berada dalam kondisi First-Run (belum ada user terdaftar)
   */
  public isFirstRun(): boolean {
    return !this.data.users || this.data.users.length === 0;
  }

  /**
   * Eksekusi First-Run Onboarding Setup (Prompt 7 §3):
   * 1. Input nama toko (Store) + nama pemilik
   * 2. Buat 1 User role OWNER (satu-satunya cara membuat OWNER pertama)
   * 3. Seed 8 COA accounts
   * 4. Siapkan master data sembako & saldo awal agar langsung siap bertransaksi
   */
  public completeFirstRunSetup(params: {
    storeName: string;
    ownerName: string;
    phone?: string;
    includeSampleProducts?: boolean;
  }): { success: boolean; error?: string; user?: User; store?: Store } {
    if (this.data.users && this.data.users.length > 0) {
      return {
        success: false,
        error: 'Setup awal sudah selesai. Aplikasi sudah memiliki akun OWNER terdaftar.'
      };
    }

    const trimmedStore = params.storeName.trim() || 'Omah Sembako Sehati';
    const trimmedOwner = params.ownerName.trim() || 'Pak Budi';

    // 1. Buat Store pertama
    const newStore: Store = {
      id: 'STR-001',
      name: trimmedStore,
      owner: trimmedOwner,
      address: 'Jl. Raya Kaliurang KM 9, Sleman, D.I. Yogyakarta',
      phone: params.phone?.trim() || '0812-3456-7890'
    };
    this.data.stores = [newStore];

    // 2. Buat 1 User role OWNER (Satu-satunya cara membuat OWNER pertama)
    const firstOwner: User = {
      id: 'USR-001',
      name: trimmedOwner,
      role: 'OWNER',
      phone: params.phone?.trim() || '0812-3456-7890'
    };
    this.data.users = [firstOwner];
    this.currentUser = firstOwner;

    // 3. Pastikan 8 akun COA terdaftar (Prompt 1 §6)
    if (!this.data.accounts || this.data.accounts.length < 8) {
      this.data.accounts = [...SEED_ACCOUNTS];
    }

    // 4. Sertakan master data produk & inventori awal
    if (params.includeSampleProducts !== false) {
      this.data.products = [...SEED_PRODUCTS];
      this.data.inventoryLayers = [...SEED_INVENTORY_LAYERS];
      this.data.customers = [...SEED_CUSTOMERS];
      this.data.suppliers = [...SEED_SUPPLIERS];
      this.data.journals = [...SEED_JOURNALS];
      this.data.journalLines = [...SEED_JOURNAL_LINES];
    }

    this.persist();
    return { success: true, user: firstOwner, store: newStore };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // ==========================================
  // ROOM DAO IMPLEMENTATIONS
  // ==========================================

  // StoreDao
  public getStore(): Store {
    return this.data.stores[0] || SEED_STORE;
  }

  public updateStore(store: Store) {
    this.data.stores = [store];
    this.persist();
  }

  public updateStoreInfo(params: {
    name: string;
    address?: string;
    phone?: string;
    actorRole: UserRole | string;
  }): { success: boolean; error?: string; store?: Store } {
    if (!hasPermission(params.actorRole, 'SETTINGS_UPDATE')) {
      return {
        success: false,
        error: 'Akses ditolak: Hanya peran OWNER dan ADMIN yang diizinkan mengubah informasi toko.'
      };
    }

    const currentStore = this.getStore();
    const updated: Store = {
      ...currentStore,
      name: params.name.trim() || currentStore.name,
      address: params.address?.trim() ?? currentStore.address,
      phone: params.phone?.trim() ?? currentStore.phone
    };

    this.data.stores = [updated];
    this.persist();
    return { success: true, store: updated };
  }

  // UserDao
  public getAllUsers(): User[] {
    return [...this.data.users];
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public insertUser(user: User) {
    this.data.users.push(user);
    this.persist();
  }

  public setCurrentUser(user: User) {
    this.currentUser = user;
    this.notify();
  }

  /**
   * Tambah pengguna baru (Prompt 7 §4):
   * - Otorisasi USER_CREATE (OWNER & ADMIN)
   * - Hanya OWNER yang berhak mengangkat/memberikan role OWNER (ROLE_ASSIGN)
   */
  public createUser(params: {
    name: string;
    role: UserRole;
    phone?: string;
    actorRole: UserRole | string;
  }): { success: boolean; error?: string; user?: User } {
    // 1. Cek izin membuat user
    if (!hasPermission(params.actorRole, 'USER_CREATE')) {
      return {
        success: false,
        error: 'Akses ditolak: Hanya peran OWNER dan ADMIN yang diizinkan menambah pengguna baru.'
      };
    }

    // 2. Proteksi role OWNER (Prompt 7 §4): Hanya OWNER yang boleh memberi role OWNER
    if (params.role === 'OWNER' && !hasPermission(params.actorRole, 'ROLE_ASSIGN')) {
      return {
        success: false,
        error: 'Akses ditolak: Hanya OWNER yang berhak mengangkat atau menetapkan peran OWNER.'
      };
    }

    const trimmedName = params.name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Nama pengguna tidak boleh kosong.' };
    }

    const nextNum = this.data.users.length + 1;
    const newUserId = `USR-${String(nextNum).padStart(3, '0')}`;

    const newUser: User = {
      id: newUserId,
      name: trimmedName,
      role: params.role,
      phone: params.phone?.trim() || undefined
    };

    this.data.users.push(newUser);
    this.persist();
    return { success: true, user: newUser };
  }

  /**
   * Ubah role pengguna (Prompt 7 §2 & §4):
   * - Otorisasi ROLE_ASSIGN HANYA dimiliki oleh OWNER (ADMIN tidak berhak)
   */
  public updateUserRole(params: {
    userId: string;
    newRole: UserRole;
    actorRole: UserRole | string;
  }): { success: boolean; error?: string; user?: User } {
    if (!hasPermission(params.actorRole, 'ROLE_ASSIGN')) {
      return {
        success: false,
        error: 'Akses ditolak: Hanya peran OWNER yang memiliki hak menetapkan atau mengubah peran (ROLE_ASSIGN) pengguna.'
      };
    }

    const targetUser = this.data.users.find(u => u.id === params.userId);
    if (!targetUser) {
      return { success: false, error: 'Pengguna tidak ditemukan.' };
    }

    targetUser.role = params.newRole;

    // Jika user yang diedit sedang aktif saat ini, update juga
    if (this.currentUser.id === params.userId) {
      this.currentUser = { ...targetUser };
    }

    this.persist();
    return { success: true, user: targetUser };
  }

  // ProductDao
  public getAllProducts(): Product[] {
    return [...this.data.products];
  }

  public getProductById(id: string): Product | undefined {
    return this.data.products.find(p => p.id === id);
  }

  public insertProduct(product: Product) {
    this.data.products.unshift(product);
    this.persist();
  }

  public updateProduct(product: Product) {
    const idx = this.data.products.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      this.data.products[idx] = product;
      this.persist();
    }
  }

  // CustomerDao
  public getAllCustomers(): Customer[] {
    return [...this.data.customers];
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.data.customers.find(c => c.id === id);
  }

  public insertCustomer(customer: Customer) {
    this.data.customers.push(customer);
    this.persist();
  }

  public updateCustomer(customer: Customer) {
    const idx = this.data.customers.findIndex(c => c.id === customer.id);
    if (idx !== -1) {
      this.data.customers[idx] = customer;
      this.persist();
    }
  }

  public updateCustomerArBalance(customerId: string, deltaAmount: number) {
    const cust = this.data.customers.find(c => c.id === customerId);
    if (cust) {
      cust.arBalance += deltaAmount;
      this.persist();
    }
  }

  // SupplierDao
  public getAllSuppliers(): Supplier[] {
    return this.data.suppliers.map(s => ({
      ...s,
      isActive: s.isActive !== false
    }));
  }

  public getSupplierById(id: string): Supplier | undefined {
    const s = this.data.suppliers.find(sup => sup.id === id);
    return s ? { ...s, isActive: s.isActive !== false } : undefined;
  }

  public insertSupplier(supplier: Supplier) {
    this.data.suppliers.push({
      ...supplier,
      isActive: supplier.isActive !== false,
      createdAt: supplier.createdAt || new Date().toISOString().split('T')[0]
    });
    this.persist();
  }

  public updateSupplier(supplier: Supplier) {
    const idx = this.data.suppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      this.data.suppliers[idx] = {
        ...this.data.suppliers[idx],
        ...supplier
      };
      this.persist();
    }
  }

  public deleteSupplier(supplierId: string): { success: boolean; message?: string } {
    const supplier = this.data.suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      return { success: false, message: 'Supplier tidak ditemukan.' };
    }
    const hasPurchases = this.data.purchases.some(p => p.supplierId === supplierId);
    if (hasPurchases) {
      return { 
        success: false, 
        message: 'Supplier tidak dapat dihapus karena memiliki riwayat Purchase Order. Ubah status menjadi Nonaktif agar tidak muncul saat pembuatan PO baru.' 
      };
    }
    if (supplier.apBalance > 0) {
      return { 
        success: false, 
        message: 'Supplier masih memiliki saldo hutang (AP) yang belum lunas. Selesaikan kewajiban pembayaran terlebih dahulu.' 
      };
    }
    this.data.suppliers = this.data.suppliers.filter(s => s.id !== supplierId);
    this.persist();
    return { success: true };
  }

  public updateSupplierApBalance(supplierId: string, deltaAmount: number) {
    const supplier = this.data.suppliers.find(s => s.id === supplierId);
    if (supplier) {
      supplier.apBalance += deltaAmount;
      this.persist();
    }
  }

  // InventoryLayerDao (FIFO batch tracking)
  public getAllInventoryLayers(): InventoryLayer[] {
    return [...this.data.inventoryLayers];
  }

  public getLayersForProduct(productId: string): InventoryLayer[] {
    return this.data.inventoryLayers
      .filter(l => l.productId === productId && l.quantityRemaining > 0)
      .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()); // FIFO: paling lama di depan
  }

  public getSystemBusinessDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  public getProductCurrentStock(productId: string, location?: StockLocation): number {
    return this.data.inventoryLayers
      .filter(l => l.productId === productId && (!location || (l.location || 'GUDANG') === location))
      .reduce((sum, layer) => sum + layer.quantityRemaining, 0);
  }

  public insertInventoryLayer(layer: InventoryLayer) {
    this.data.inventoryLayers.push(layer);
    this.persist();
  }

  // AccountDao (Chart of Accounts)
  public getAllAccounts(): Account[] {
    return [...this.data.accounts];
  }

  public getAccountByCode(code: string): Account | undefined {
    return this.data.accounts.find(a => a.code === code);
  }

  public insertAccount(account: Account) {
    if (!this.data.accounts.some(a => a.code === account.code)) {
      this.data.accounts.push(account);
      this.persist();
    }
  }

  // SaleDao & SaleLineDao
  public getAllSales(): Sale[] {
    return [...this.data.sales];
  }

  public getAllSaleLines(): SaleLine[] {
    return [...this.data.saleLines];
  }

  public insertSale(sale: Sale, lines: SaleLine[]) {
    this.data.sales.unshift(sale);
    this.data.saleLines.push(...lines);
    this.persist();
  }

  // JournalDao & JournalLineDao
  public getAllJournals(): Journal[] {
    return [...this.data.journals];
  }

  public getAllJournalLines(): JournalLine[] {
    return [...this.data.journalLines];
  }

  public insertJournal(journal: Journal, lines: JournalLine[]) {
    this.data.journals.unshift(journal);
    this.data.journalLines.push(...lines);
    this.persist();
  }

  // §8. Atomic Room Transaction for Sale commit
  public commitAtomicSaleTransaction(params: {
    sale: Sale;
    saleLines: SaleLine[];
    updatedLayers: InventoryLayer[];
    journal: Journal;
    journalLines: JournalLine[];
    arTransaction?: ArTransaction;
  }) {
    // 1. Update InventoryLayers (FIFO quantityRemaining reduced)
    this.data.inventoryLayers = params.updatedLayers;
    // 2. Add Sale (COMMITTED)
    this.data.sales.unshift(params.sale);
    // 3. Add SaleLines
    this.data.saleLines.push(...params.saleLines);
    // 4. Add Journal
    this.data.journals.unshift(params.journal);
    // 5. Add JournalLines (Balanced Double-Entry)
    this.data.journalLines.push(...params.journalLines);

    // 6. Prompt 4: Efek kredit pada Customer.arBalance & ArTransaction
    if (params.sale.paymentMethod === 'CREDIT' && params.sale.customerId) {
      const cust = this.data.customers.find(c => c.id === params.sale.customerId);
      if (cust) {
        cust.arBalance += params.sale.grandTotal;
      }
      if (params.arTransaction) {
        this.data.arTransactions.unshift(params.arTransaction);
      }
    }

    // 7. Clear checkout cart
    this.kasirCart = [];

    // Prompt 14: Catat idempotency key secara atomik jika ada
    if (params.sale.clientSaleKey) {
      this.recordIdempotencyKey(params.sale.clientSaleKey, 'SALE', params.sale.id);
    }

    // 8. Persist atomically dalam satu IDBTransaction yang mencakup seluruh object store terkait
    const affectedStores = [
      IDB_STORES.INVENTORY_LAYERS,
      IDB_STORES.SALES,
      IDB_STORES.SALE_LINES,
      IDB_STORES.JOURNALS,
      IDB_STORES.JOURNAL_LINES,
      IDB_STORES.CUSTOMERS,
      IDB_STORES.AR_TRANSACTIONS,
      IDB_STORES.IDEMPOTENCY_KEYS
    ];
    this.persist(this.data, affectedStores);
  }

  // ==========================================
  // PROMPT 3: PURCHASE DAO & STATE MACHINE
  // ==========================================

  public getAllPurchases(): Purchase[] {
    return [...this.data.purchases].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getPurchaseById(id: string): Purchase | undefined {
    return this.data.purchases.find(p => p.id === id);
  }

  public getPurchaseLines(purchaseId: string): PurchaseLine[] {
    return this.data.purchaseLines.filter(pl => pl.purchaseId === purchaseId);
  }

  public getAllPurchaseLines(): PurchaseLine[] {
    return [...this.data.purchaseLines];
  }

  public getPurchaseReceipts(purchaseId?: string): PurchaseReceipt[] {
    if (purchaseId) {
      return this.data.purchaseReceipts
        .filter(r => r.purchaseId === purchaseId)
        .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    }
    return [...this.data.purchaseReceipts].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  }

  public getAllPurchaseReceipts(purchaseId?: string): PurchaseReceipt[] {
    return this.getPurchaseReceipts(purchaseId);
  }

  // Bikin PO baru (Status: DRAFT)
  public insertPurchase(purchase: Purchase, lines: PurchaseLine[]): { success: boolean; error?: string } {
    if (lines.length === 0) {
      return { success: false, error: 'PO harus memiliki minimal 1 item produk' };
    }
    for (const l of lines) {
      if (l.qtyOrdered <= 0) {
        return { success: false, error: 'Jumlah pesanan (Qty) harus lebih dari 0' };
      }
      if (l.poPrice < 0) {
        return { success: false, error: 'Harga beli (PO Price) tidak boleh negatif' };
      }
    }
    this.data.purchases.unshift(purchase);
    this.data.purchaseLines.push(...lines);
    this.persist();
    return { success: true };
  }

  // Approve PO (DRAFT -> APPROVED) - SoD: OWNER & ADMIN only
  public approvePurchase(
    purchaseId: string,
    approvedBy: string,
    userRole: string
  ): { success: boolean; error?: string } {
    const purchase = this.data.purchases.find(p => p.id === purchaseId);
    if (!purchase) {
      return { success: false, error: 'PO tidak ditemukan' };
    }
    if (purchase.status !== 'DRAFT') {
      return { success: false, error: `PO berstatus ${purchase.status}, tidak bisa di-approve lagi` };
    }
    if (!hasPermission(userRole, 'PO_APPROVE')) {
      return {
        success: false,
        error: 'Akses ditolak: Peran Anda tidak memiliki izin menyetujui PO (PO_APPROVE). Hanya OWNER dan ADMIN.'
      };
    }
    const lines = this.getPurchaseLines(purchaseId);
    if (lines.length === 0) {
      return { success: false, error: 'PO tidak memiliki baris item barang' };
    }

    purchase.status = 'APPROVED';
    purchase.approvedBy = approvedBy;
    purchase.approvedAt = new Date().toISOString();
    this.persist();
    return { success: true };
  }

  // §4 & §5: Terima Barang (APPROVED/RECEIVING -> RECEIVING/RECEIVED)
  public receiveGoods(params: {
    purchaseId: string;
    userRole: string;
    receivedBy: string;
    businessDate: string;
    notes?: string;
    items: { lineId: string; qtyReceived: number }[];
  }): {
    success: boolean;
    error?: string;
    receipt?: PurchaseReceipt;
    createdLayers?: InventoryLayer[];
    journal?: Journal;
    journalLines?: JournalLine[];
    grandTotalPortion?: number;
  } {
    if (!hasPermission(params.userRole, 'PO_RECEIVE')) {
      return {
        success: false,
        error: 'Akses ditolak: Peran Anda tidak memiliki hak akses menerima barang (PO_RECEIVE).'
      };
    }

    const purchase = this.data.purchases.find(p => p.id === params.purchaseId);
    if (!purchase) {
      return { success: false, error: 'PO tidak ditemukan' };
    }
    if (purchase.status !== 'APPROVED' && purchase.status !== 'RECEIVING') {
      return {
        success: false,
        error: purchase.status === 'DRAFT'
          ? 'PO masih DRAFT, wajib disetujui (APPROVED) oleh OWNER/ADMIN terlebih dahulu'
          : 'PO sudah berstatus RECEIVED (lengkap), tidak dapat menerima barang lagi'
      };
    }

    const lines = this.data.purchaseLines.filter(l => l.purchaseId === params.purchaseId);
    let totalQtyReceivedThisEvent = 0;

    // 1. Validasi per line: qtyDiterimaSekarang + qtyReceivedCumulative <= qtyOrdered
    for (const item of params.items) {
      if (item.qtyReceived < 0) {
        return { success: false, error: 'Qty diterima tidak boleh minus' };
      }
      if (item.qtyReceived > 0) {
        const line = lines.find(l => l.id === item.lineId);
        if (!line) {
          return { success: false, error: 'Item baris PO tidak valid' };
        }
        if (item.qtyReceived + line.qtyReceivedCumulative > line.qtyOrdered) {
          return { success: false, error: 'Qty diterima melebihi pesanan' };
        }
        totalQtyReceivedThisEvent += item.qtyReceived;
      }
    }

    if (totalQtyReceivedThisEvent <= 0) {
      return { success: false, error: 'Masukkan kuantitas barang yang diterima (> 0)' };
    }

    // 2. Buat InventoryLayer baru & update akumulasi line
    const createdLayers: InventoryLayer[] = [];
    const receiptItems: {
      lineId: string;
      productId: string;
      qtyReceived: number;
      poPrice: number;
      layerId: string;
    }[] = [];
    let grandTotalPortion = 0;

    const receiptTimestamp = new Date().toISOString();
    const receiptId = `RC-${Date.now()}`;

    for (const item of params.items) {
      if (item.qtyReceived <= 0) continue;
      const line = lines.find(l => l.id === item.lineId)!;
      const layerId = `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      // InventoryLayer baru dengan unitCost sesuai PO price terkunci
      const newLayer: InventoryLayer = {
        id: layerId,
        productId: line.productId,
        quantityRemaining: item.qtyReceived,
        unitCost: line.poPrice,
        receivedAt: receiptTimestamp,
        sourcePurchaseId: purchase.id,
        sourceReceiptId: receiptId
      };

      createdLayers.push(newLayer);
      line.qtyReceivedCumulative += item.qtyReceived;
      const lineAmount = item.qtyReceived * line.poPrice;
      grandTotalPortion += lineAmount;

      receiptItems.push({
        lineId: line.id,
        productId: line.productId,
        qtyReceived: item.qtyReceived,
        poPrice: line.poPrice,
        layerId: layerId
      });
    }

    // 3. Status Purchase Update (§3):
    // Kalau semua line sudah qtyReceivedCumulative == qtyOrdered -> RECEIVED. Belum -> RECEIVING.
    const allLinesCompleted = lines.every(l => l.qtyReceivedCumulative >= l.qtyOrdered);
    purchase.status = allLinesCompleted ? 'RECEIVED' : 'RECEIVING';

    // 4. Record PurchaseReceipt
    const receipt: PurchaseReceipt = {
      id: receiptId,
      purchaseId: purchase.id,
      receivedAt: receiptTimestamp,
      businessDate: params.businessDate,
      receivedBy: params.receivedBy,
      notes: params.notes,
      itemsReceived: receiptItems
    };

    // 5. Journal Pembelian (§5 - Double-Entry seimbang per porsi yang baru diterima)
    const journalId = `JRN-${Date.now()}`;
    const journal: Journal = {
      id: journalId,
      refType: 'PURCHASE',
      refId: purchase.id,
      businessDate: params.businessDate
    };

    const journalLines: JournalLine[] = [];
    // Dr 1310 PERSEDIAAN = grandTotalPortion
    journalLines.push({
      id: `${journalId}-1`,
      journalId,
      accountCode: '1310',
      side: 'DEBIT',
      amount: grandTotalPortion
    });

    if (purchase.paymentMethod === 'CASH') {
      // Cr 1110 KAS = grandTotalPortion
      journalLines.push({
        id: `${journalId}-2`,
        journalId,
        accountCode: '1110',
        side: 'CREDIT',
        amount: grandTotalPortion
      });
    } else {
      // Cr 2110 HUTANG_USAHA = grandTotalPortion
      journalLines.push({
        id: `${journalId}-2`,
        journalId,
        accountCode: '2110',
        side: 'CREDIT',
        amount: grandTotalPortion
      });
      // Efek hutang supplier bertambah
      const supplier = this.data.suppliers.find(s => s.id === purchase.supplierId);
      if (supplier) {
        supplier.apBalance += grandTotalPortion;
      }
    }

    // Verifikasi mutlak keseimbangan Double-Entry
    const debitSum = journalLines.filter(j => j.side === 'DEBIT').reduce((s, j) => s + j.amount, 0);
    const creditSum = journalLines.filter(j => j.side === 'CREDIT').reduce((s, j) => s + j.amount, 0);
    if (debitSum !== creditSum) {
      return { success: false, error: `Jurnal tidak balance! Debit=${debitSum}, Kredit=${creditSum}` };
    }

    // Atomically commit into database via IDBTransaction
    this.data.inventoryLayers.push(...createdLayers);
    this.data.purchaseReceipts.unshift(receipt);
    this.data.journals.unshift(journal);
    this.data.journalLines.push(...journalLines);

    this.persist(this.data, [
      IDB_STORES.INVENTORY_LAYERS,
      IDB_STORES.PURCHASE_RECEIPTS,
      IDB_STORES.JOURNALS,
      IDB_STORES.JOURNAL_LINES,
      IDB_STORES.PURCHASES,
      IDB_STORES.SUPPLIERS
    ]);

    return {
      success: true,
      receipt,
      createdLayers,
      journal,
      journalLines,
      grandTotalPortion
    };
  }

  // ==========================================
  // PROMPT 4: PIUTANG USAHA (AR) DAO & SETTLEMENT
  // ==========================================

  public getAllArTransactions(customerId?: string): ArTransaction[] {
    if (customerId) {
      return this.data.arTransactions
        .filter(t => t.customerId === customerId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return [...this.data.arTransactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public insertArTransaction(tx: ArTransaction) {
    this.data.arTransactions.unshift(tx);
    this.persist();
  }

  /**
   * Menghitung status pelunasan setiap Sale kredit milik pelanggan
   * Termasuk alokasi FIFO dari seluruh transaksi pelunasan (AR_SETTLE)
   */
  public getCustomerCreditSalesWithSettlement(customerId: string) {
    const creditSales = this.data.sales
      .filter(s => s.customerId === customerId && s.paymentMethod === 'CREDIT' && s.status === 'COMMITTED')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Tertua duluan (FIFO)

    const settles = this.data.arTransactions
      .filter(t => t.customerId === customerId && t.type === 'AR_SETTLE')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Alokasi pelunasan ke sale (prioritas direct refSaleId, sisanya FIFO ke sale yang belum lunas)
    const saleSettledMap = new Map<string, number>();
    let poolSettle = 0;

    for (const st of settles) {
      if (st.refSaleId && creditSales.some(s => s.id === st.refSaleId)) {
        const cur = saleSettledMap.get(st.refSaleId) || 0;
        saleSettledMap.set(st.refSaleId, cur + st.amount);
      } else {
        poolSettle += st.amount;
      }
    }

    // Alokasikan pool FIFO
    for (const sale of creditSales) {
      const direct = saleSettledMap.get(sale.id) || 0;
      const needed = Math.max(0, sale.grandTotal - direct);
      if (needed > 0 && poolSettle > 0) {
        const take = Math.min(needed, poolSettle);
        saleSettledMap.set(sale.id, direct + take);
        poolSettle -= take;
      }
    }

    return creditSales.map(sale => {
      const settledAmount = saleSettledMap.get(sale.id) || 0;
      const remainingBalance = Math.max(0, sale.grandTotal - settledAmount);
      const isFullyPaid = remainingBalance <= 0;
      const isOverdue = sale.dueDate ? isDateOverdue(sale.dueDate) : false;
      const dueInfo = sale.dueDate ? getDaysRemainingOrOverdue(sale.dueDate) : null;

      return {
        sale,
        grandTotal: sale.grandTotal,
        settledAmount,
        remainingBalance,
        isFullyPaid,
        dueDate: sale.dueDate,
        isOverdue,
        dueInfo
      };
    });
  }

  /**
   * Pelunasan Piutang (AR Settlement):
   * 1. Cek customer dan validasi saldo: amount <= customer.arBalance (kembalian DITOLAK)
   * 2. Kurangi Customer.arBalance -= amount
   * 3. Buat ArTransaction (type = 'AR_SETTLE', amount)
   * 4. Journal:
   *    Dr 1110 KAS = amount
   *    Cr 1210 PIUTANG_USAHA = amount
   * 5. Eksekusi atomik dalam 1 transaksi
   */
  public settleArPayment(params: {
    customerId: string;
    amount: number;
    businessDate: string;
    cashierName: string;
    userRole?: string;
    notes?: string;
    selectedSaleId?: string;
  }): {
    success: boolean;
    errorMessage?: string;
    arTransaction?: ArTransaction;
    journal?: Journal;
    journalLines?: JournalLine[];
    newArBalance?: number;
  } {
    if (params.userRole && !hasPermission(params.userRole, 'AR_SETTLE')) {
      return {
        success: false,
        errorMessage: 'Akses ditolak: Peran Anda tidak memiliki hak akses pelunasan piutang (AR_SETTLE).'
      };
    }

    const customer = this.getCustomerById(params.customerId);
    if (!customer) {
      return { success: false, errorMessage: 'Pelanggan tidak ditemukan' };
    }

    if (params.amount <= 0) {
      return { success: false, errorMessage: 'Jumlah bayar harus lebih dari Rp 0' };
    }

    // Aturan Prompt 4 §5: Kembalian tidak diperbolehkan!
    if (params.amount > customer.arBalance) {
      return { 
        success: false, 
        errorMessage: `Jumlah bayar melebihi piutang yang dipilih (Piutang saat ini: Rp ${customer.arBalance.toLocaleString('id-ID')}, Dibayar: Rp ${params.amount.toLocaleString('id-ID')})` 
      };
    }

    // Update saldo piutang pelanggan
    customer.arBalance -= params.amount;

    // Buat ArTransaction
    const arTxId = `AR-${Date.now()}`;
    const arTx: ArTransaction = {
      id: arTxId,
      customerId: params.customerId,
      type: 'AR_SETTLE',
      amount: params.amount,
      businessDate: params.businessDate,
      refSaleId: params.selectedSaleId || undefined,
      notes: params.notes || `Pelunasan piutang oleh ${customer.name}`,
      createdAt: new Date().toISOString()
    };

    // Buat Jurnal Pelunasan Piutang:
    // Dr 1110 KAS = amount
    // Cr 1210 PIUTANG_USAHA = amount
    const journalId = `JRN-AR-${Date.now()}`;
    const journal: Journal = {
      id: journalId,
      refType: 'AR_SETTLE',
      refId: arTxId,
      businessDate: params.businessDate
    };

    const journalLines: JournalLine[] = [
      {
        id: `${journalId}-1`,
        journalId,
        accountCode: '1110', // KAS
        side: 'DEBIT',
        amount: params.amount
      },
      {
        id: `${journalId}-2`,
        journalId,
        accountCode: '1210', // PIUTANG_USAHA
        side: 'CREDIT',
        amount: params.amount
      }
    ];

    // Verifikasi mutlak Double-Entry Seimbang
    const totalDebit = journalLines.filter(l => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0);
    const totalCredit = journalLines.filter(l => l.side === 'CREDIT').reduce((s, l) => s + l.amount, 0);
    if (totalDebit !== totalCredit) {
      throw new Error(`Jurnal pelunasan tidak seimbang! Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    // Simpan atomik via IDBTransaction
    this.data.arTransactions.unshift(arTx);
    this.data.journals.unshift(journal);
    this.data.journalLines.push(...journalLines);

    this.persist(this.data, [
      IDB_STORES.AR_TRANSACTIONS,
      IDB_STORES.CUSTOMERS,
      IDB_STORES.JOURNALS,
      IDB_STORES.JOURNAL_LINES
    ]);

    return {
      success: true,
      arTransaction: arTx,
      journal,
      journalLines,
      newArBalance: customer.arBalance
    };
  }

  // ==========================================
  // PROMPT 5: VOID SALE (§3)
  // Batalkan transaksi jual COMMITTED secara penuh
  // Hanya OWNER dan ADMIN
  // ==========================================
  public voidSale(params: {
    saleId: string;
    userRole: UserRole;
    businessDate: string;
    reason?: string;
  }): {
    success: boolean;
    error?: string;
    sale?: Sale;
    journal?: Journal;
    journalLines?: JournalLine[];
    restoredLayers?: InventoryLayer[];
  } {
    // RBAC: Hanya OWNER dan ADMIN
    if (!hasPermission(params.userRole, 'VOID_SALE')) {
      return { success: false, error: 'Akses ditolak: Hanya peran OWNER dan ADMIN yang diizinkan melakukan Void penjualan.' };
    }

    const sale = this.data.sales.find(s => s.id === params.saleId);
    if (!sale) {
      return { success: false, error: 'Transaksi penjualan tidak ditemukan.' };
    }

    // Status check
    if (sale.status === 'REVERSED') {
      return { success: false, error: 'Transaksi ini sudah pernah di-void (dibatalkan).' };
    }
    if (sale.status === 'RETURNED' || sale.status === 'PARTIALLY_RETURNED') {
      return { success: false, error: 'Transaksi yang sudah pernah diretur tidak dapat di-void. Gunakan fitur Retur untuk mengembalikan sisa barang.' };
    }
    if (sale.status !== 'COMMITTED') {
      return { success: false, error: `Hanya transaksi berstatus COMMITTED yang dapat di-void (status saat ini: ${sale.status}).` };
    }

    const lines = this.data.saleLines.filter(l => l.saleId === sale.id);
    if (lines.length === 0) {
      return { success: false, error: 'Baris transaksi penjualan tidak ditemukan.' };
    }

    // Cek apakah ada line yang sudah diretur
    const hasAnyReturn = lines.some(l => (l.returnedQty || 0) > 0);
    if (hasAnyReturn) {
      return { success: false, error: 'Sebagian barang pada transaksi ini sudah pernah diretur, tidak dapat di-void.' };
    }

    // 1. Kembalikan stok: Buat InventoryLayer baru untuk setiap baris
    // receivedAt = businessDate Sale asli (BUKAN waktu void sekarang) — urutan FIFO tetap adil (§3)
    const restoredLayers: InventoryLayer[] = [];
    const restoredAt = sale.createdAt || `${sale.businessDate}T00:00:00.000Z`;
    let totalHppAsli = 0;

    for (const line of lines) {
      totalHppAsli += line.hppLine;
      const unitCost = line.qty > 0 ? Math.round(line.hppLine / line.qty) : 0;
      const newLayer: InventoryLayer = {
        id: `INV-VOID-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        productId: line.productId,
        quantityRemaining: line.qty,
        unitCost,
        receivedAt: restoredAt
      };
      restoredLayers.push(newLayer);
    }

    // 2. Jurnal Pembalik (Reversing Entry):
    // Dr 4110 PENJUALAN     = subtotal asli
    // Dr 2210 PPN_KELUARAN  = ppnAmount asli (jika > 0)
    // Dr 1310 PERSEDIAAN    = hppTotal asli
    // Cr 1110 KAS (atau Cr 1210 PIUTANG_USAHA kalau CREDIT) = grandTotal asli
    // Cr 5110 HPP           = hppTotal asli
    const journalId = `JRN-VOID-${Date.now()}`;
    const journal: Journal = {
      id: journalId,
      refType: 'VOID_SALE',
      refId: sale.id,
      businessDate: params.businessDate
    };

    const journalLines: JournalLine[] = [];

    // Dr 4110 PENJUALAN
    journalLines.push({
      id: `${journalId}-1`,
      journalId,
      accountCode: '4110',
      side: 'DEBIT',
      amount: sale.subtotal
    });

    // Dr 2210 PPN_KELUARAN (jika ada)
    if (sale.ppnAmount > 0) {
      journalLines.push({
        id: `${journalId}-2`,
        journalId,
        accountCode: '2210',
        side: 'DEBIT',
        amount: sale.ppnAmount
      });
    }

    // Dr 1310 PERSEDIAAN
    journalLines.push({
      id: `${journalId}-3`,
      journalId,
      accountCode: '1310',
      side: 'DEBIT',
      amount: totalHppAsli
    });

    // Cr 1110 KAS atau Cr 1210 PIUTANG_USAHA
    const creditAccount = sale.paymentMethod === 'CREDIT' ? '1210' : '1110';
    journalLines.push({
      id: `${journalId}-4`,
      journalId,
      accountCode: creditAccount,
      side: 'CREDIT',
      amount: sale.grandTotal
    });

    // Cr 5110 HPP
    journalLines.push({
      id: `${journalId}-5`,
      journalId,
      accountCode: '5110',
      side: 'CREDIT',
      amount: totalHppAsli
    });

    // Verifikasi Double-Entry balance
    const sumDebit = journalLines.filter(l => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0);
    const sumCredit = journalLines.filter(l => l.side === 'CREDIT').reduce((s, l) => s + l.amount, 0);
    if (sumDebit !== sumCredit) {
      return { success: false, error: `Jurnal pembalik tidak seimbang! Debit: ${sumDebit}, Credit: ${sumCredit}` };
    }

    // 3. Jika Sale asli adalah CREDIT, balik efek ke Customer.arBalance & buat ArTransaction
    if (sale.paymentMethod === 'CREDIT' && sale.customerId) {
      const customer = this.getCustomerById(sale.customerId);
      if (customer) {
        customer.arBalance = Math.max(0, customer.arBalance - sale.grandTotal);
        const arTx: ArTransaction = {
          id: `AR-VOID-${Date.now()}`,
          customerId: customer.id,
          type: 'SALE_CREDIT',
          amount: -sale.grandTotal, // nominal negatif membalik piutang
          businessDate: params.businessDate,
          refSaleId: sale.id,
          notes: `Void Penjualan ${sale.id}${params.reason ? `: ${params.reason}` : ''}`,
          createdAt: new Date().toISOString()
        };
        this.data.arTransactions.unshift(arTx);
      }
    }

    // 4. Update status Sale menjadi REVERSED
    sale.status = 'REVERSED';

    // 5. Simpan mutasi atomik via IDBTransaction
    this.data.inventoryLayers.unshift(...restoredLayers);
    this.data.journals.unshift(journal);
    this.data.journalLines.push(...journalLines);

    this.persist(this.data, [
      IDB_STORES.SALES,
      IDB_STORES.INVENTORY_LAYERS,
      IDB_STORES.JOURNALS,
      IDB_STORES.JOURNAL_LINES,
      IDB_STORES.CUSTOMERS,
      IDB_STORES.AR_TRANSACTIONS
    ]);

    return {
      success: true,
      sale,
      journal,
      journalLines,
      restoredLayers
    };
  }

  // ==========================================
  // PROMPT 5: RETURN SALE (§4)
  // Retur sebagian atau seluruh barang dari transaksi jual
  // Hanya OWNER dan ADMIN
  // ==========================================
  public returnSale(params: {
    saleId: string;
    userRole: UserRole;
    businessDate: string;
    reason?: string;
    items: { lineId: string; qty: number }[];
  }): {
    success: boolean;
    error?: string;
    sale?: Sale;
    saleReturn?: SaleReturn;
    journal?: Journal;
    journalLines?: JournalLine[];
    restoredLayers?: InventoryLayer[];
  } {
    // RBAC: Hanya OWNER dan ADMIN
    if (!hasPermission(params.userRole, 'RETURN_SALE')) {
      return { success: false, error: 'Akses ditolak: Hanya peran OWNER dan ADMIN yang diizinkan melakukan Retur penjualan.' };
    }

    const sale = this.data.sales.find(s => s.id === params.saleId);
    if (!sale) {
      return { success: false, error: 'Transaksi penjualan tidak ditemukan.' };
    }

    if (sale.status === 'REVERSED') {
      return { success: false, error: 'Transaksi berstatus REVERSED (void) tidak dapat diretur.' };
    }
    if (sale.status === 'RETURNED') {
      return { success: false, error: 'Semua barang pada transaksi ini sudah diretur penuh (RETURNED).' };
    }
    if (sale.status !== 'COMMITTED' && sale.status !== 'PARTIALLY_RETURNED') {
      return { success: false, error: `Status transaksi tidak valid untuk retur (Status: ${sale.status}).` };
    }

    const lines = this.data.saleLines.filter(l => l.saleId === sale.id);
    if (lines.length === 0) {
      return { success: false, error: 'Baris item penjualan tidak ditemukan.' };
    }

    // Validasi item yang diretur
    const validItems = params.items.filter(i => i.qty > 0);
    if (validItems.length === 0) {
      return { success: false, error: 'Pilih minimal satu item dengan kuantitas retur lebih dari 0.' };
    }

    for (const item of validItems) {
      const line = lines.find(l => l.id === item.lineId);
      if (!line) {
        return { success: false, error: `Item penjualan ID ${item.lineId} tidak ditemukan.` };
      }
      const alreadyReturned = line.returnedQty || 0;
      const availableToReturn = line.qty - alreadyReturned;
      if (item.qty > availableToReturn) {
        const prod = this.getProductById(line.productId);
        return {
          success: false,
          error: `Qty retur untuk ${prod?.name || 'produk'} (${item.qty}) melebihi sisa yang dapat diretur (${availableToReturn}).`
        };
      }
    }

    // Hitung proporsi nilai retur sesuai Aturan Prompt 5 (§4 & §6)
    // returnSubtotal_i = round(subtotal_i * q / Q)
    // returnPpn_i = round(ppn_i * q / Q)
    // returnHpp_i = round(hpp_i * q / Q)
    // unitCost = returnHpp_i / q
    const restoredLayers: InventoryLayer[] = [];
    const returnItemDetails: SaleReturn['items'] = [];
    let sumReturnSubtotal = 0;
    let sumReturnPpn = 0;
    let sumReturnHpp = 0;

    const restoredAt = sale.createdAt || `${sale.businessDate}T00:00:00.000Z`;

    for (const item of validItems) {
      const line = lines.find(l => l.id === item.lineId)!;
      const q = item.qty;
      const Q = line.qty;

      const lineSubtotal = line.unitPrice * line.qty;
      const linePpn = line.ppnLine || 0;
      const lineHpp = line.hppLine;

      const returnSubtotal_i = (q === Q && (line.returnedQty || 0) === 0)
        ? lineSubtotal
        : Math.round((lineSubtotal * q) / Q);

      const returnPpn_i = linePpn > 0
        ? ((q === Q && (line.returnedQty || 0) === 0) ? linePpn : Math.round((linePpn * q) / Q))
        : 0;

      const returnHpp_i = (q === Q && (line.returnedQty || 0) === 0)
        ? lineHpp
        : Math.round((lineHpp * q) / Q);

      const unitCost = q > 0 ? Math.round(returnHpp_i / q) : 0;
      const layerId = `INV-RET-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const newLayer: InventoryLayer = {
        id: layerId,
        productId: line.productId,
        quantityRemaining: q,
        unitCost,
        receivedAt: restoredAt
      };

      restoredLayers.push(newLayer);
      line.returnedQty = (line.returnedQty || 0) + q;

      sumReturnSubtotal += returnSubtotal_i;
      sumReturnPpn += returnPpn_i;
      sumReturnHpp += returnHpp_i;

      returnItemDetails.push({
        lineId: line.id,
        productId: line.productId,
        qtyReturned: q,
        returnSubtotal: returnSubtotal_i,
        returnPpn: returnPpn_i,
        returnHpp: returnHpp_i,
        newLayerId: layerId
      });
    }

    const totalRefund = sumReturnSubtotal + sumReturnPpn;

    // 2. Buat Jurnal Retur Penjualan (§4):
    // Dr 4110 PENJUALAN     = sumReturnSubtotal
    // Dr 2210 PPN_KELUARAN  = sumReturnPpn (jika > 0)
    // Dr 1310 PERSEDIAAN    = sumReturnHpp
    // Cr 1110 KAS (atau Cr 1210 PIUTANG_USAHA kalau CREDIT) = totalRefund
    // Cr 5110 HPP           = sumReturnHpp
    const journalId = `JRN-RET-${Date.now()}`;
    const journal: Journal = {
      id: journalId,
      refType: 'RETURN_SALE',
      refId: sale.id,
      businessDate: params.businessDate
    };

    const journalLines: JournalLine[] = [];

    // Dr 4110 PENJUALAN
    journalLines.push({
      id: `${journalId}-1`,
      journalId,
      accountCode: '4110',
      side: 'DEBIT',
      amount: sumReturnSubtotal
    });

    // Dr 2210 PPN_KELUARAN (jika > 0)
    if (sumReturnPpn > 0) {
      journalLines.push({
        id: `${journalId}-2`,
        journalId,
        accountCode: '2210',
        side: 'DEBIT',
        amount: sumReturnPpn
      });
    }

    // Dr 1310 PERSEDIAAN
    journalLines.push({
      id: `${journalId}-3`,
      journalId,
      accountCode: '1310',
      side: 'DEBIT',
      amount: sumReturnHpp
    });

    // Cr 1110 KAS atau Cr 1210 PIUTANG_USAHA
    const creditAccount = sale.paymentMethod === 'CREDIT' ? '1210' : '1110';
    journalLines.push({
      id: `${journalId}-4`,
      journalId,
      accountCode: creditAccount,
      side: 'CREDIT',
      amount: totalRefund
    });

    // Cr 5110 HPP
    journalLines.push({
      id: `${journalId}-5`,
      journalId,
      accountCode: '5110',
      side: 'CREDIT',
      amount: sumReturnHpp
    });

    // Verifikasi Double-Entry balance
    const sumDebit = journalLines.filter(l => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0);
    const sumCredit = journalLines.filter(l => l.side === 'CREDIT').reduce((s, l) => s + l.amount, 0);
    if (sumDebit !== sumCredit) {
      return { success: false, error: `Jurnal retur tidak seimbang! Debit: ${sumDebit}, Credit: ${sumCredit}` };
    }

    // 3. Jika Sale asli adalah CREDIT, kurangi piutang pelanggan
    if (sale.paymentMethod === 'CREDIT' && sale.customerId) {
      const customer = this.getCustomerById(sale.customerId);
      if (customer) {
        customer.arBalance = Math.max(0, customer.arBalance - totalRefund);
        const arTx: ArTransaction = {
          id: `AR-RET-${Date.now()}`,
          customerId: customer.id,
          type: 'SALE_CREDIT',
          amount: -totalRefund,
          businessDate: params.businessDate,
          refSaleId: sale.id,
          notes: `Retur Penjualan ${sale.id}${params.reason ? `: ${params.reason}` : ''}`,
          createdAt: new Date().toISOString()
        };
        this.data.arTransactions.unshift(arTx);
      }
    }

    // 4. Update status Sale:
    // RETURNED kalau seluruh baris sudah 100% diretur, atau PARTIALLY_RETURNED kalau masih ada sisa
    const allLinesFullyReturned = lines.every(l => (l.returnedQty || 0) >= l.qty);
    sale.status = allLinesFullyReturned ? 'RETURNED' : 'PARTIALLY_RETURNED';

    // 5. Catat SaleReturn
    const returnId = `SR-${Date.now()}`;
    const saleReturn: SaleReturn = {
      id: returnId,
      saleId: sale.id,
      businessDate: params.businessDate,
      returnedBy: params.userRole,
      reason: params.reason,
      totalSubtotal: sumReturnSubtotal,
      totalPpn: sumReturnPpn,
      totalHpp: sumReturnHpp,
      totalRefund,
      items: returnItemDetails,
      journalId,
      createdAt: new Date().toISOString()
    };

    // 6. Simpan mutasi
    this.data.saleReturns.unshift(saleReturn);
    this.data.inventoryLayers.unshift(...restoredLayers);
    this.data.journals.unshift(journal);
    this.data.journalLines.push(...journalLines);

    this.persist();

    return {
      success: true,
      sale,
      saleReturn,
      journal,
      journalLines,
      restoredLayers
    };
  }

  // ==========================================
  // PROMPT 5: RETURN PURCHASE (§5)
  // Kembalikan barang ke supplier dari PO yang sudah RECEIVED
  // Hanya OWNER dan ADMIN
  // ==========================================
  public returnPurchase(params: {
    purchaseId: string;
    userRole: UserRole;
    businessDate: string;
    reason?: string;
    items: { lineId: string; qty: number }[];
  }): {
    success: boolean;
    error?: string;
    purchase?: Purchase;
    purchaseReturn?: PurchaseReturn;
    journal?: Journal;
    journalLines?: JournalLine[];
  } {
    // RBAC: Hanya OWNER dan ADMIN
    if (!hasPermission(params.userRole, 'RETURN_PURCHASE')) {
      return { success: false, error: 'Akses ditolak: Hanya peran OWNER dan ADMIN yang diizinkan melakukan Retur pembelian ke supplier.' };
    }

    const purchase = this.data.purchases.find(p => p.id === params.purchaseId);
    if (!purchase) {
      return { success: false, error: 'Purchase Order (PO) tidak ditemukan.' };
    }

    if (purchase.status === 'RETURNED') {
      return { success: false, error: 'Barang dari PO ini sudah seluruhnya diretur ke supplier.' };
    }
    if (purchase.status !== 'RECEIVED') {
      return { success: false, error: `Retur ke supplier hanya berlaku untuk Purchase berstatus RECEIVED (status saat ini: ${purchase.status}).` };
    }

    const lines = this.data.purchaseLines.filter(l => l.purchaseId === purchase.id);
    if (lines.length === 0) {
      return { success: false, error: 'Baris PO tidak ditemukan.' };
    }

    const receipts = this.data.purchaseReceipts.filter(r => r.purchaseId === purchase.id);

    const validItems = params.items.filter(i => i.qty > 0);
    if (validItems.length === 0) {
      return { success: false, error: 'Pilih minimal satu barang dengan kuantitas retur lebih dari 0.' };
    }

    // 1. Validasi & Kurangi Stok dari Specific InventoryLayer PO ini (§5 item 1)
    // "ambil dari InventoryLayer yang dibuat oleh Purchase itu (bukan FIFO umum — harus spesifik layer dari PO ini, karena barang yang dikembalikan adalah barang dari PO ini).
    // Kalau qty retur melebihi quantityRemaining layer itu (karena sebagian sudah kejual), tolak dengan pesan:
    // 'Barang sudah terjual sebagian, tidak bisa retur qty ini'"
    const returnItems: PurchaseReturn['items'] = [];
    let totalReturnAmount = 0;

    for (const item of validItems) {
      const line = lines.find(l => l.id === item.lineId);
      if (!line) {
        return { success: false, error: `Baris PO ${item.lineId} tidak valid.` };
      }

      const alreadyReturned = line.qtyReturned || 0;
      const maxReturnableFromLine = line.qtyReceivedCumulative - alreadyReturned;
      if (item.qty > maxReturnableFromLine) {
        const prod = this.getProductById(line.productId);
        return {
          success: false,
          error: `Qty retur untuk ${prod?.name || 'produk'} (${item.qty}) melebihi kuantitas yang pernah diterima (${maxReturnableFromLine}).`
        };
      }

      // Cari layer yang dibuat oleh PO ini
      let candidateLayers: InventoryLayer[] = [];
      for (const rc of receipts) {
        if (rc.itemsReceived) {
          for (const itemRc of rc.itemsReceived) {
            if (itemRc.lineId === line.id || itemRc.productId === line.productId) {
              const layer = this.data.inventoryLayers.find(l => l.id === itemRc.layerId);
              if (layer && !candidateLayers.some(cl => cl.id === layer.id)) {
                candidateLayers.push(layer);
              }
            }
          }
        }
      }

      // Fallback via sourcePurchaseId atau productId + matching unitCost
      if (candidateLayers.length === 0) {
        candidateLayers = this.data.inventoryLayers.filter(l => 
          l.productId === line.productId && 
          (l.sourcePurchaseId === purchase.id || l.unitCost === line.poPrice)
        );
      }

      const totalStockRemainingInLayers = candidateLayers.reduce((s, l) => s + l.quantityRemaining, 0);

      if (totalStockRemainingInLayers < item.qty) {
        return {
          success: false,
          error: 'Barang sudah terjual sebagian, tidak bisa retur qty ini'
        };
      }

      // Kurangi stok dari layer spesifik ini
      let qtyToDeduct = item.qty;
      let primaryLayerId = '';
      for (const layer of candidateLayers) {
        if (qtyToDeduct <= 0) break;
        if (layer.quantityRemaining > 0) {
          primaryLayerId = layer.id;
          const take = Math.min(layer.quantityRemaining, qtyToDeduct);
          layer.quantityRemaining -= take;
          qtyToDeduct -= take;
        }
      }

      line.qtyReturned = (line.qtyReturned || 0) + item.qty;
      const lineReturnAmount = item.qty * line.poPrice;
      totalReturnAmount += lineReturnAmount;

      returnItems.push({
        lineId: line.id,
        productId: line.productId,
        qtyReturned: item.qty,
        poPrice: line.poPrice,
        layerId: primaryLayerId || 'PO-LAYER'
      });
    }

    // 2. Jurnal Retur Pembelian (§5 item 2):
    // Dr 2110 HUTANG_USAHA (kalau PURCHASE tadinya CREDIT) atau Dr 1110 KAS (kalau tadinya CASH)
    // Cr 1310 PERSEDIAAN
    const debitAccount = purchase.paymentMethod === 'CREDIT' ? '2110' : '1110';
    const journalId = `JRN-RET-PO-${Date.now()}`;
    const journal: Journal = {
      id: journalId,
      refType: 'RETURN_PURCHASE',
      refId: purchase.id,
      businessDate: params.businessDate
    };

    const journalLines: JournalLine[] = [
      {
        id: `${journalId}-1`,
        journalId,
        accountCode: debitAccount,
        side: 'DEBIT',
        amount: totalReturnAmount
      },
      {
        id: `${journalId}-2`,
        journalId,
        accountCode: '1310',
        side: 'CREDIT',
        amount: totalReturnAmount
      }
    ];

    // 3. Update Hutang Supplier (§5 item 3):
    // Kurangi Supplier.apBalance sejumlah nominal retur jika pembelian tempo
    if (purchase.paymentMethod === 'CREDIT') {
      const supplier = this.getSupplierById(purchase.supplierId);
      if (supplier) {
        supplier.apBalance = Math.max(0, supplier.apBalance - totalReturnAmount);
      }
    }

    // 4. Update status Purchase jika seluruh barang sudah dikembalikan
    const allItemsReturned = lines.every(l => (l.qtyReturned || 0) >= l.qtyReceivedCumulative);
    if (allItemsReturned) {
      purchase.status = 'RETURNED';
    }

    // 5. Catat PurchaseReturn record
    const returnId = `PR-${Date.now()}`;
    const purchaseReturn: PurchaseReturn = {
      id: returnId,
      purchaseId: purchase.id,
      supplierId: purchase.supplierId,
      businessDate: params.businessDate,
      returnedBy: params.userRole,
      reason: params.reason,
      totalAmount: totalReturnAmount,
      items: returnItems,
      journalId,
      createdAt: new Date().toISOString()
    };

    // 6. Simpan mutasi
    this.data.purchaseReturns.unshift(purchaseReturn);
    this.data.journals.unshift(journal);
    this.data.journalLines.push(...journalLines);

    this.persist();

    return {
      success: true,
      purchase,
      purchaseReturn,
      journal,
      journalLines
    };
  }

  // Getters untuk Sale Returns & Purchase Returns
  public getAllSaleReturns(): SaleReturn[] {
    return [...this.data.saleReturns];
  }

  public getSaleReturnsBySaleId(saleId: string): SaleReturn[] {
    return this.data.saleReturns.filter(r => r.saleId === saleId);
  }

  public getAllPurchaseReturns(): PurchaseReturn[] {
    return [...this.data.purchaseReturns];
  }

  public getPurchaseReturnsByPurchaseId(purchaseId: string): PurchaseReturn[] {
    return this.data.purchaseReturns.filter(r => r.purchaseId === purchaseId);
  }

  // Cart operations (Kasir Tab)
  public addToCart(productId: string, unitPrice: number) {
    const existing = this.kasirCart.find(i => i.productId === productId);
    if (existing) {
      existing.qty += 1;
    } else {
      this.kasirCart.push({ productId, qty: 1, unitPrice });
    }
    this.notify();
  }

  public updateCartItemQty(productId: string, newQty: number) {
    if (newQty <= 0) {
      this.kasirCart = this.kasirCart.filter(i => i.productId !== productId);
    } else {
      const item = this.kasirCart.find(i => i.productId === productId);
      if (item) {
        item.qty = newQty;
      }
    }
    this.notify();
  }

  public clearCart() {
    this.kasirCart = [];
    this.notify();
  }

  // ==========================================
  // PROMPT 8: SESI KASIR (SHIFT & REKONSILIASI)
  // ==========================================

  public getAllCashSessions(): CashSession[] {
    return [...(this.data.cashSessions || [])];
  }

  public getCashSessionById(id: string): CashSession | undefined {
    return (this.data.cashSessions || []).find(s => s.id === id);
  }

  public getActiveCashSession(userId: string): CashSession | undefined {
    return (this.data.cashSessions || []).find(s => s.userId === userId && s.status === 'OPEN');
  }

  /**
   * Buka Sesi Kasir Baru (Prompt 8 §3)
   * - Role yang boleh: OWNER, ADMIN, KASIR
   * - Invariant wajib: 1 user hanya boleh punya maksimal 1 CashSession berstatus OPEN
   * - Input: openingFloat (nominal modal awal, boleh 0)
   * - Tidak ada jurnal saat buka sesi
   */
  public openCashSession(params: {
    userId: string;
    openingFloat: number;
    notes?: string;
  }): {
    success: boolean;
    session?: CashSession;
    error?: string;
  } {
    const user = this.getUserById(params.userId);
    if (!user) {
      return { success: false, error: 'Pengguna kasir tidak ditemukan.' };
    }

    if (!hasPermission(user.role, 'CASH_SESSION_OPEN')) {
      return { success: false, error: 'Akses ditolak: Peran Anda tidak memiliki izin membuka sesi kasir.' };
    }

    // Invariant: 1 user hanya boleh punya 1 sesi OPEN
    const existingOpen = this.getActiveCashSession(params.userId);
    if (existingOpen) {
      return {
        success: false,
        error: `Kasir "${user.name}" sudah memiliki sesi kasir aktif (${existingOpen.id}). Harap tutup sesi lama terlebih dahulu sebelum membuka sesi baru.`
      };
    }

    const floatNum = Number(params.openingFloat);
    if (isNaN(floatNum) || floatNum < 0) {
      return { success: false, error: 'Nominal modal awal tidak valid (minimal Rp 0).' };
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const count = (this.data.cashSessions?.length || 0) + 1;
    const sessionId = `CS-${dateStr}-${String(count).padStart(4, '0')}`;

    const newSession: CashSession = {
      id: sessionId,
      storeId: this.data.stores[0]?.id || 'STR-001',
      userId: params.userId,
      status: 'OPEN',
      openedAt: now.toISOString(),
      openingFloat: Math.round(floatNum),
      notes: params.notes?.trim() || undefined
    };

    if (!this.data.cashSessions) {
      this.data.cashSessions = [];
    }
    this.data.cashSessions.unshift(newSession);
    this.persist();

    return { success: true, session: newSession };
  }

  /**
   * Menghitung systemExpectedCash (Prompt 8 §4)
   * systemExpectedCash = openingFloat
   *                    + Σ(grandTotal Sale CASH yang commit selama sesi ini terbuka)
   *                    - Σ(grandTotal Sale CASH yang di-void/retur selama sesi ini terbuka)
   *                    + Σ(jumlahBayar AR_SETTLE metode tunai selama sesi ini terbuka)
   */
  public calculateCashSessionExpected(sessionId: string): {
    openingFloat: number;
    cashSalesTotal: number;
    cashSalesCount: number;
    voidSalesTotal: number;
    voidSalesCount: number;
    cashReturnsTotal: number;
    cashReturnsCount: number;
    totalDeductions: number;
    arSettleTotal: number;
    arSettleCount: number;
    systemExpectedCash: number;
  } {
    const session = this.getCashSessionById(sessionId);
    if (!session) {
      throw new Error(`Sesi kasir ID ${sessionId} tidak ditemukan`);
    }

    const openingFloat = session.openingFloat || 0;
    const startTime = new Date(session.openedAt).getTime();
    const endTime = session.closedAt ? new Date(session.closedAt).getTime() : Date.now();
    const sessionUser = this.getUserById(session.userId);

    // 1. Sale CASH yang dicatat oleh kasir sesi ini selama rentang waktu sesi
    const cashSalesDuringSession = (this.data.sales || []).filter(s => {
      if (s.paymentMethod !== 'CASH') return false;
      const isUserMatch = (s.userId && s.userId === session.userId) || 
                          (sessionUser && s.cashierName === sessionUser.name);
      if (!isUserMatch) return false;
      const t = new Date(s.createdAt).getTime();
      return t >= startTime && t <= endTime;
    });

    const cashSalesTotal = cashSalesDuringSession.reduce((sum, s) => sum + s.grandTotal, 0);
    const cashSalesCount = cashSalesDuringSession.length;

    // 2. Void Sale CASH yang dibatalkan
    const voidedSalesDuringSession = cashSalesDuringSession.filter(s => s.status === 'REVERSED');
    const voidSalesTotal = voidedSalesDuringSession.reduce((sum, s) => sum + s.grandTotal, 0);
    const voidSalesCount = voidedSalesDuringSession.length;

    // 3. Retur Penjualan Tunai (SaleReturn pada Sale CASH)
    const cashReturnsDuringSession = (this.data.saleReturns || []).filter(sr => {
      const t = new Date(sr.createdAt).getTime();
      if (t < startTime || t > endTime) return false;
      const parentSale = (this.data.sales || []).find(s => s.id === sr.saleId);
      if (!parentSale || parentSale.paymentMethod !== 'CASH') return false;
      const isUserMatch = (parentSale.userId && parentSale.userId === session.userId) || 
                          (sessionUser && parentSale.cashierName === sessionUser.name) ||
                          (sr.returnedByUserId && sr.returnedByUserId === session.userId);
      return isUserMatch;
    });

    const cashReturnsTotal = cashReturnsDuringSession.reduce((sum, sr) => sum + sr.totalRefund, 0);
    const cashReturnsCount = cashReturnsDuringSession.length;

    const totalDeductions = voidSalesTotal + cashReturnsTotal;

    // 4. Pelunasan Piutang Tunai (AR_SETTLE)
    const arSettleDuringSession = (this.data.arTransactions || []).filter(ar => {
      if (ar.type !== 'AR_SETTLE') return false;
      const t = new Date(ar.createdAt).getTime();
      if (t < startTime || t > endTime) return false;
      const isUserMatch = !ar.userId || ar.userId === session.userId;
      return isUserMatch;
    });

    const arSettleTotal = arSettleDuringSession.reduce((sum, ar) => sum + ar.amount, 0);
    const arSettleCount = arSettleDuringSession.length;

    const systemExpectedCash = openingFloat + cashSalesTotal - totalDeductions + arSettleTotal;

    return {
      openingFloat,
      cashSalesTotal,
      cashSalesCount,
      voidSalesTotal,
      voidSalesCount,
      cashReturnsTotal,
      cashReturnsCount,
      totalDeductions,
      arSettleTotal,
      arSettleCount,
      systemExpectedCash
    };
  }

  /**
   * Tutup Sesi Kasir & Rekonsiliasi (Prompt 8 §5)
   * - Role yang boleh: OWNER, ADMIN, KASIR (kasir tutup sesinya sendiri, OWNER/ADMIN darurat)
   * - Input actualCash (hitung fisik laci)
   * - Hitung variance = actualCash - systemExpectedCash
   * - variance == 0 -> Tidak buat jurnal
   * - variance < 0 (kurang): Dr 5910 SELISIH_KAS | Cr 1110 KAS
   * - variance > 0 (lebih): Dr 1110 KAS | Cr 5910 SELISIH_KAS
   * - Status CLOSED bersifat immutable
   */
  public closeCashSession(params: {
    sessionId: string;
    actualCash: number;
    closedByUserId: string;
    notes?: string;
  }): {
    success: boolean;
    session?: CashSession;
    journal?: Journal;
    error?: string;
    calculation?: ReturnType<AppDatabase['calculateCashSessionExpected']>;
  } {
    const closedByUser = this.getUserById(params.closedByUserId);
    if (!closedByUser) {
      return { success: false, error: 'Pengguna penutup sesi tidak ditemukan.' };
    }

    if (!hasPermission(closedByUser.role, 'CASH_SESSION_CLOSE')) {
      return { success: false, error: 'Akses ditolak: Peran Anda tidak memiliki izin menutup sesi kasir.' };
    }

    const session = this.getCashSessionById(params.sessionId);
    if (!session) {
      return { success: false, error: 'Sesi kasir tidak ditemukan.' };
    }

    if (session.status === 'CLOSED') {
      return { success: false, error: 'Sesi kasir ini sudah berstatus CLOSED dan tidak dapat diubah lagi.' };
    }

    // Kasir menutup sesinya sendiri; OWNER/ADMIN bisa menutup sesi siapa pun
    if (session.userId !== params.closedByUserId && !['OWNER', 'ADMIN'].includes(closedByUser.role)) {
      return {
        success: false,
        error: 'Kasir hanya boleh menutup sesinya sendiri. Penutupan sesi kasir lain membutuhkan izin OWNER atau ADMIN.'
      };
    }

    const actualCashNum = Number(params.actualCash);
    if (isNaN(actualCashNum) || actualCashNum < 0) {
      return { success: false, error: 'Nominal hitung fisik uang tidak valid (minimal Rp 0).' };
    }

    const calc = this.calculateCashSessionExpected(session.id);
    const actualCash = Math.round(actualCashNum);
    const variance = actualCash - calc.systemExpectedCash;

    let journal: Journal | undefined = undefined;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Jika ada selisih (variance != 0), buat jurnal penyesuaian selisih kas (5910)
    if (variance !== 0) {
      const journalId = `JRN-CS-${Date.now()}`;
      journal = {
        id: journalId,
        refType: 'ADJUSTMENT',
        refId: session.id,
        businessDate: dateStr
      };

      const absVariance = Math.abs(variance);
      const journalLines: JournalLine[] = [];

      if (variance < 0) {
        // Variance negatif (uang fisik KURANG dari seharusnya):
        // Dr 5910 SELISIH_KAS = |variance|
        // Cr 1110 KAS         = |variance|
        journalLines.push(
          {
            id: `${journalId}-1`,
            journalId,
            accountCode: '5910', // SELISIH_KAS (BEBAN)
            side: 'DEBIT',
            amount: absVariance
          },
          {
            id: `${journalId}-2`,
            journalId,
            accountCode: '1110', // KAS (ASET berkurang)
            side: 'CREDIT',
            amount: absVariance
          }
        );
      } else {
        // Variance positif (uang fisik LEBIH dari seharusnya):
        // Dr 1110 KAS         = variance
        // Cr 5910 SELISIH_KAS = variance
        journalLines.push(
          {
            id: `${journalId}-1`,
            journalId,
            accountCode: '1110', // KAS (ASET bertambah)
            side: 'DEBIT',
            amount: variance
          },
          {
            id: `${journalId}-2`,
            journalId,
            accountCode: '5910', // SELISIH_KAS (KONTRA-BEBAN / PENDAPATAN LAIN)
            side: 'CREDIT',
            amount: variance
          }
        );
      }

      // Verifikasi Double-Entry seimbang
      const sumDebit = journalLines.filter(l => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0);
      const sumCredit = journalLines.filter(l => l.side === 'CREDIT').reduce((s, l) => s + l.amount, 0);
      if (sumDebit !== sumCredit) {
        throw new Error(`Jurnal selisih kas tidak seimbang! Debit: ${sumDebit}, Credit: ${sumCredit}`);
      }

      this.data.journals.unshift(journal);
      this.data.journalLines.push(...journalLines);
      session.journalId = journalId;
    }

    // Update sesi menjadi CLOSED (immutable)
    session.status = 'CLOSED';
    session.closedAt = now.toISOString();
    session.systemExpectedCash = calc.systemExpectedCash;
    session.actualCash = actualCash;
    session.variance = variance;
    session.closedByUserId = params.closedByUserId;
    if (params.notes?.trim()) {
      session.notes = session.notes ? `${session.notes} | ${params.notes.trim()}` : params.notes.trim();
    }

    this.persist();

    return {
      success: true,
      session,
      journal,
      calculation: calc
    };
  }

  // =========================================================================
  // PROMPT 10: STOCK OPNAME & TRANSFER LOKASI
  // =========================================================================

  public getAllStockOpnames(): StockOpname[] {
    return [...this.data.stockOpnames].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getStockOpnameById(id: string): StockOpname | undefined {
    return this.data.stockOpnames.find(o => o.id === id);
  }

  public getAllStockOpnameLines(): StockOpnameLine[] {
    return [...this.data.stockOpnameLines];
  }

  public getStockOpnameLines(opnameId: string): StockOpnameLine[] {
    return this.data.stockOpnameLines.filter(l => l.opnameId === opnameId);
  }

  public getAllStockTransfers(): StockTransfer[] {
    return [...this.data.stockTransfers].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getStockTransferById(id: string): StockTransfer | undefined {
    return this.data.stockTransfers.find(t => t.id === id);
  }

  public getAllStockTransferLines(): StockTransferLine[] {
    return [...this.data.stockTransferLines];
  }

  public getStockTransferLines(transferId: string): StockTransferLine[] {
    return this.data.stockTransferLines.filter(l => l.transferId === transferId);
  }

  /**
   * Hitung stok produk per lokasi atau breakdown
   */
  public getProductStockByLocation(productId: string, location?: StockLocation): number {
    return this.data.inventoryLayers
      .filter(l => l.productId === productId && (!location || (l.location || 'GUDANG') === location))
      .reduce((sum, layer) => sum + layer.quantityRemaining, 0);
  }

  public getProductStockBreakdown(productId: string): { gudang: number; toko: number; total: number } {
    let gudang = 0;
    let toko = 0;
    this.data.inventoryLayers
      .filter(l => l.productId === productId && l.quantityRemaining > 0)
      .forEach(l => {
        const loc = l.location || 'GUDANG';
        if (loc === 'TOKO') {
          toko += l.quantityRemaining;
        } else {
          gudang += l.quantityRemaining;
        }
      });
    return { gudang, toko, total: gudang + toko };
  }

  /**
   * Buat DRAFT Stock Opname
   */
  public createStockOpname(params: {
    businessDate: string;
    userId: string;
    location: StockLocation;
    notes?: string;
    lines: Array<{ productId: string; physicalQty: number }>;
  }): StockOpname {
    const now = new Date();
    const dateStr = params.businessDate.replace(/-/g, '');
    const count = this.data.stockOpnames.length + 1;
    const opnameId = `OPN-${dateStr}-${String(count).padStart(4, '0')}`;

    const opname: StockOpname = {
      id: opnameId,
      businessDate: params.businessDate,
      userId: params.userId,
      location: params.location,
      status: 'DRAFT',
      notes: params.notes,
      createdAt: now.toISOString()
    };

    const lines: StockOpnameLine[] = params.lines.map((line, idx) => ({
      id: `${opnameId}-${idx + 1}`,
      opnameId,
      productId: line.productId,
      physicalQty: Math.max(0, Math.floor(line.physicalQty)),
      location: params.location
    }));

    this.data.stockOpnames.unshift(opname);
    this.data.stockOpnameLines.push(...lines);
    this.persist();

    return opname;
  }

  /**
   * Commit Stock Opname (Prompt 10 §3)
   * Hanya OWNER dan ADMIN yang dapat melakukan commit (RBAC: STOCK_OPNAME_COMMIT)
   */
  public commitStockOpname(params: {
    opnameId: string;
    committedByUserId: string;
  }): {
    success: boolean;
    opname: StockOpname;
    journal?: Journal;
    lines: StockOpnameLine[];
  } {
    const opname = this.getStockOpnameById(params.opnameId);
    if (!opname) throw new Error(`Stock Opname ${params.opnameId} tidak ditemukan!`);
    if (opname.status === 'COMMITTED') {
      throw new Error(`Stock Opname ${params.opnameId} sudah di-commit sebelumnya!`);
    }

    const lines = this.data.stockOpnameLines.filter(l => l.opnameId === opname.id);
    if (lines.length === 0) {
      throw new Error(`Stock Opname ${opname.id} tidak memiliki rincian produk!`);
    }

    const now = new Date();
    let totalLebihValue = 0;
    let totalKurangValue = 0;
    const newLayersToInsert: InventoryLayer[] = [];

    // Evaluasi tiap line terhadap stok sistem live
    lines.forEach(line => {
      const activeLayers = this.data.inventoryLayers.filter(
        l => l.productId === line.productId &&
             (l.location || 'GUDANG') === opname.location &&
             l.quantityRemaining > 0
      );

      const systemQtyLive = activeLayers.reduce((s, l) => s + l.quantityRemaining, 0);
      const varianceQty = line.physicalQty - systemQtyLive;

      // Hitung unitCostRata2
      let unitCostRata2 = 0;
      if (systemQtyLive > 0) {
        const totalVal = activeLayers.reduce((s, l) => s + (l.quantityRemaining * l.unitCost), 0);
        unitCostRata2 = Math.round(totalVal / systemQtyLive);
      } else {
        const product = this.data.products.find(p => p.id === line.productId);
        unitCostRata2 = product?.sellPrice || 0;
      }

      const varianceVal = Math.abs(varianceQty) * unitCostRata2;

      line.systemQtyLive = systemQtyLive;
      line.varianceQty = varianceQty;
      line.unitCostAvg = unitCostRata2;
      line.varianceValue = varianceVal;

      if (varianceQty > 0) {
        // LEBIH (fisik > sistem): Buat InventoryLayer baru
        totalLebihValue += varianceVal;
        newLayersToInsert.push({
          id: `INV-OPN-${now.getTime()}-${line.id}`,
          productId: line.productId,
          quantityRemaining: varianceQty,
          unitCost: unitCostRata2,
          receivedAt: now.toISOString(),
          location: opname.location,
          sourceReceiptId: `OPNAME-${opname.id}`
        });
      } else if (varianceQty < 0) {
        // KURANG (fisik < sistem): Kurangi quantityRemaining dari layer aktif di lokasi tersebut (FIFO tertua)
        let qtyToDeduct = Math.abs(varianceQty);
        activeLayers.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

        let actualDeductedValue = 0;
        for (const layer of activeLayers) {
          if (qtyToDeduct <= 0) break;
          const deduct = Math.min(layer.quantityRemaining, qtyToDeduct);
          layer.quantityRemaining -= deduct;
          actualDeductedValue += (deduct * layer.unitCost);
          qtyToDeduct -= deduct;
        }
        totalKurangValue += actualDeductedValue;
      }
    });

    if (newLayersToInsert.length > 0) {
      this.data.inventoryLayers.push(...newLayersToInsert);
    }

    // Pembuatan Jurnal jika ada selisih
    let journal: Journal | undefined = undefined;
    const hasVariance = totalLebihValue > 0 || totalKurangValue > 0;

    if (hasVariance) {
      const journalId = `JRN-OPN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(this.data.journals.length + 1).padStart(4, '0')}`;
      journal = {
        id: journalId,
        refType: 'STOCK_OPNAME',
        refId: opname.id,
        businessDate: opname.businessDate
      };

      const journalLines: JournalLine[] = [];
      let lineCounter = 1;

      // Lebih:
      // Dr 1310 PERSEDIAAN = Σ lebih
      // Cr 5900 SELISIH_PERSEDIAAN = Σ lebih
      if (totalLebihValue > 0) {
        journalLines.push(
          {
            id: `${journalId}-${lineCounter++}`,
            journalId,
            accountCode: '1310', // PERSEDIAAN
            side: 'DEBIT',
            amount: totalLebihValue
          },
          {
            id: `${journalId}-${lineCounter++}`,
            journalId,
            accountCode: '5900', // SELISIH_PERSEDIAAN (Beban kredit = pengurang beban / pendapatan penyesuaian)
            side: 'CREDIT',
            amount: totalLebihValue
          }
        );
      }

      // Kurang:
      // Dr 5900 SELISIH_PERSEDIAAN = Σ kurang
      // Cr 1310 PERSEDIAAN = Σ kurang
      if (totalKurangValue > 0) {
        journalLines.push(
          {
            id: `${journalId}-${lineCounter++}`,
            journalId,
            accountCode: '5900', // SELISIH_PERSEDIAAN (Beban bertambah)
            side: 'DEBIT',
            amount: totalKurangValue
          },
          {
            id: `${journalId}-${lineCounter++}`,
            journalId,
            accountCode: '1310', // PERSEDIAAN (Aset berkurang)
            side: 'CREDIT',
            amount: totalKurangValue
          }
        );
      }

      // Validasi balance
      const sumDr = journalLines.filter(l => l.side === 'DEBIT').reduce((s, l) => s + l.amount, 0);
      const sumCr = journalLines.filter(l => l.side === 'CREDIT').reduce((s, l) => s + l.amount, 0);
      if (sumDr !== sumCr) {
        throw new Error(`Jurnal Opname tidak seimbang! Dr: ${sumDr}, Cr: ${sumCr}`);
      }

      this.data.journals.unshift(journal);
      this.data.journalLines.push(...journalLines);
      opname.journalId = journalId;
    }

    opname.status = 'COMMITTED';
    opname.committedAt = now.toISOString();
    opname.totalVarianceValueLebih = totalLebihValue;
    opname.totalVarianceValueKurang = totalKurangValue;

    this.persist();

    return {
      success: true,
      opname,
      journal,
      lines
    };
  }

  /**
   * Buat DRAFT Transfer Lokasi (Prompt 10 §4)
   */
  public createStockTransfer(params: {
    fromLocation: StockLocation;
    toLocation: StockLocation;
    businessDate: string;
    userId: string;
    notes?: string;
    lines: Array<{ productId: string; qtyRequested: number }>;
  }): StockTransfer {
    if (params.fromLocation === params.toLocation) {
      throw new Error('Lokasi asal dan lokasi tujuan tidak boleh sama!');
    }

    const validLines = params.lines.filter(l => l.qtyRequested > 0);
    if (validLines.length === 0) {
      throw new Error('Harus menyertakan minimal 1 produk dengan kuantitas > 0!');
    }

    const now = new Date();
    const dateStr = params.businessDate.replace(/-/g, '');
    const count = this.data.stockTransfers.length + 1;
    const transferId = `TRF-${dateStr}-${String(count).padStart(4, '0')}`;

    const transfer: StockTransfer = {
      id: transferId,
      transferNumber: transferId,
      fromLocation: params.fromLocation,
      toLocation: params.toLocation,
      status: 'DRAFT',
      businessDate: params.businessDate,
      userId: params.userId,
      notes: params.notes,
      createdAt: now.toISOString()
    };

    const transferLines: StockTransferLine[] = validLines.map((line, idx) => ({
      id: `${transferId}-${idx + 1}`,
      transferId,
      productId: line.productId,
      qtyRequested: Math.floor(line.qtyRequested),
      qtyReceivedCumulative: 0
    }));

    this.data.stockTransfers.unshift(transfer);
    this.data.stockTransferLines.push(...transferLines);
    this.persist();

    return transfer;
  }

  /**
   * Approve Stock Transfer (Prompt 10 §4)
   * Mengecek stok di lokasi asal mencukupi permintaan
   */
  public approveStockTransfer(params: {
    transferId: string;
    approvedBy: string;
  }): StockTransfer {
    const transfer = this.getStockTransferById(params.transferId);
    if (!transfer) throw new Error(`Transfer ${params.transferId} tidak ditemukan!`);
    if (transfer.status !== 'DRAFT') {
      throw new Error(`Transfer berstatus ${transfer.status}, hanya status DRAFT yang dapat disetujui!`);
    }

    const lines = this.getStockTransferLines(transfer.id);
    for (const line of lines) {
      const availableStock = this.getProductStockByLocation(line.productId, transfer.fromLocation);
      if (availableStock < line.qtyRequested) {
        const product = this.data.products.find(p => p.id === line.productId);
        throw new Error(
          `Stok produk "${product?.name || line.productId}" di ${transfer.fromLocation} tidak mencukupi! Tersedia: ${availableStock}, diminta: ${line.qtyRequested}`
        );
      }
    }

    transfer.status = 'APPROVED';
    transfer.approvedBy = params.approvedBy;
    this.persist();

    return transfer;
  }

  /**
   * Receive Stock Transfer (Prompt 10 §4)
   * Mendukung partial receive. Memindahkan layer FIFO dengan unitCost sama persis dan receivedAt asli.
   * Tanpa jurnal akuntansi.
   */
  public receiveStockTransfer(params: {
    transferId: string;
    userId: string;
    items: Array<{ productId: string; qtyReceived: number }>;
  }): StockTransfer {
    const transfer = this.getStockTransferById(params.transferId);
    if (!transfer) throw new Error(`Transfer ${params.transferId} tidak ditemukan!`);
    if (transfer.status !== 'APPROVED' && transfer.status !== 'RECEIVING') {
      throw new Error(`Transfer berstatus ${transfer.status}, tidak siap menerima barang!`);
    }

    const lines = this.getStockTransferLines(transfer.id);
    const newLayers: InventoryLayer[] = [];
    const now = new Date();

    for (const item of params.items) {
      if (item.qtyReceived <= 0) continue;

      const line = lines.find(l => l.productId === item.productId);
      if (!line) {
        throw new Error(`Produk ${item.productId} tidak ada dalam dokumen transfer ini!`);
      }

      const remainingAllowed = line.qtyRequested - line.qtyReceivedCumulative;
      if (item.qtyReceived > remainingAllowed) {
        throw new Error(
          `Jumlah diterima (${item.qtyReceived}) melebihi sisa yang belum diterima (${remainingAllowed}) untuk produk ${item.productId}!`
        );
      }

      // Ambil layer aktif di lokasi asal (FIFO)
      const fromLayers = this.data.inventoryLayers
        .filter(l => l.productId === item.productId &&
                     (l.location || 'GUDANG') === transfer.fromLocation &&
                     l.quantityRemaining > 0)
        .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

      let qtyToTake = item.qtyReceived;
      for (const layer of fromLayers) {
        if (qtyToTake <= 0) break;
        const taken = Math.min(layer.quantityRemaining, qtyToTake);
        layer.quantityRemaining -= taken;
        qtyToTake -= taken;

        // Buat layer baru di lokasi tujuan dengan unitCost SAMA PERSIS dan receivedAt ASLI!
        newLayers.push({
          id: `INV-TRF-${now.getTime()}-${Math.random().toString(36).substr(2, 5)}`,
          productId: item.productId,
          quantityRemaining: taken,
          unitCost: layer.unitCost, // UnitCost sama persis
          receivedAt: layer.receivedAt, // ReceivedAt asli (mempertahankan umur FIFO)
          location: transfer.toLocation,
          sourceReceiptId: `TRF-${transfer.id}`
        });
      }

      if (qtyToTake > 0) {
        throw new Error(
          `Stok di ${transfer.fromLocation} telah berubah dan tidak mencukupi untuk menerima ${item.qtyReceived} unit produk ${item.productId}!`
        );
      }

      line.qtyReceivedCumulative += item.qtyReceived;
    }

    this.data.inventoryLayers.push(...newLayers);

    // Cek apakah semua line sudah selesai diterima penuh
    const allCompleted = lines.every(l => l.qtyReceivedCumulative >= l.qtyRequested);
    if (allCompleted) {
      transfer.status = 'COMPLETED';
      transfer.completedAt = now.toISOString();
    } else {
      transfer.status = 'RECEIVING';
    }

    this.persist();

    return transfer;
  }

  // ==========================================
  // PROMPT 15: GOOGLE SIGN-IN & BACKUP/RESTORE
  // ==========================================

  public getGoogleAccountLink(): GoogleAccountLink | null {
    if (!this.data.googleAccountLinks || this.data.googleAccountLinks.length === 0) {
      return null;
    }
    return this.data.googleAccountLinks[0];
  }

  public linkGoogleAccount(params: {
    userId?: string;
    googleEmail: string;
    googleDisplayName: string;
    googlePhotoUrl?: string;
    actorRole: UserRole;
  }): { success: boolean; link?: GoogleAccountLink; error?: string } {
    if (!hasPermission(params.actorRole, 'GOOGLE_CONNECT')) {
      return { success: false, error: 'Hanya peran OWNER dan ADMIN yang diizinkan menautkan akun Google.' };
    }

    const link: GoogleAccountLink = {
      userId: params.userId || this.currentUser.id,
      googleEmail: params.googleEmail,
      googleDisplayName: params.googleDisplayName,
      googlePhotoUrl: params.googlePhotoUrl,
      connectedAt: new Date().toISOString(),
      isConnected: true
    };

    this.data.googleAccountLinks = [link];
    this.persist();
    return { success: true, link };
  }

  public unlinkGoogleAccount(actorRole?: UserRole): { success: boolean; error?: string } {
    const role = actorRole || this.currentUser.role;
    if (!hasPermission(role, 'GOOGLE_CONNECT')) {
      return { success: false, error: 'Hanya peran OWNER dan ADMIN yang diizinkan memutuskan koneksi Google.' };
    }

    this.data.googleAccountLinks = [];
    this.persist();
    return { success: true };
  }

  public getAllBackupConfigs(): BackupConfig[] {
    return [...(this.data.backupConfigs || [])];
  }

  public getBackupConfig(): BackupConfig | null {
    if (!this.data.backupConfigs || this.data.backupConfigs.length === 0) {
      return null;
    }
    const config = this.data.backupConfigs[0];
    if (config.schemaVersion === undefined) config.schemaVersion = 1;
    if (config.googleEmail === undefined) {
      const link = this.getGoogleAccountLink();
      config.googleEmail = link?.googleEmail || '';
    }
    return config;
  }

  public saveBackupConfig(config: BackupConfig): void {
    const link = this.getGoogleAccountLink();
    const sanitized: BackupConfig = {
      ...config,
      googleEmail: config.googleEmail ?? link?.googleEmail ?? '',
      schemaVersion: config.schemaVersion ?? 1
    };
    this.data.backupConfigs = [sanitized];
    this.persist();
  }

  public updateBackupTimestamp(
    lastBackupAt: string,
    extra?: { fileId?: string; googleEmail?: string; schemaVersion?: number; fileName?: string }
  ): void {
    const existing = this.getBackupConfig();
    const link = this.getGoogleAccountLink();
    if (existing) {
      existing.lastBackupAt = lastBackupAt;
      if (extra?.fileId) existing.fileId = extra.fileId;
      if (extra?.googleEmail !== undefined) existing.googleEmail = extra.googleEmail;
      else if (!existing.googleEmail && link?.googleEmail) existing.googleEmail = link.googleEmail;
      if (extra?.schemaVersion !== undefined) existing.schemaVersion = extra.schemaVersion;
      else if (existing.schemaVersion === undefined) existing.schemaVersion = 1;
      if (extra?.fileName) existing.fileName = extra.fileName;
      this.saveBackupConfig(existing);
    } else if (extra?.fileId) {
      this.saveBackupConfig({
        id: 'DEFAULT',
        googleEmail: extra.googleEmail || link?.googleEmail || '',
        fileId: extra.fileId,
        fileName: extra.fileName || 'Backup Omah Sembako Sehati',
        lastBackupAt,
        schemaVersion: extra.schemaVersion || 1
      });
    }
  }

  /**
   * Atomik Restore dari snapshot tables (Prompt 15 §4).
   * Menimpa seluruh entitas IndexedDB dalam satu kali commit aman.
   */
  public restoreFromSnapshot(newDbData: DatabaseSchema, actorRole: UserRole): { success: boolean; error?: string } {
    if (!hasPermission(actorRole, 'RESTORE_RUN')) {
      return { success: false, error: 'Akses ditolak: Hanya peran OWNER yang memiliki wewenang menjalankan Restore database!' };
    }

    try {
      // Pastikan struktur minimum valid
      if (!newDbData.accounts || newDbData.accounts.length < 8) {
        throw new Error('Data backup tidak memiliki kelengkapan Chart of Accounts (COA) yang sah.');
      }

      // PENTING (Prompt 15b §2.4 & §2.5):
      // Pertahankan konfigurasi teknis lokal perangkat (tidak boleh ditimpa dari backup):
      // - googleAccountLinks (koneksi akun Google lokal device)
      // - backupConfigs (ID file Drive lokal & config lokal)
      // - idempotencyKeys (pencegah dobel-klik lokal per-sesi)
      const currentGoogleLink = this.getGoogleAccountLink();
      const currentBackupConfig = this.getBackupConfig();
      const currentIdempotencyKeys = this.data.idempotencyKeys || [];

      // Sanitasi data snapshot
      const sanitized = this.sanitizeDatabaseSchema(newDbData);

      this.data = {
        ...sanitized,
        googleAccountLinks: currentGoogleLink ? [currentGoogleLink] : [],
        backupConfigs: currentBackupConfig ? [currentBackupConfig] : [],
        idempotencyKeys: currentIdempotencyKeys
      };

      // Catat waktu restore pada config lokal
      const activeConfig = this.getBackupConfig();
      if (activeConfig) {
        activeConfig.lastRestoreAt = new Date().toISOString();
        this.data.backupConfigs = [activeConfig];
      }

      // Pastikan currentUser valid
      if (this.data.users.length > 0) {
        const found = this.data.users.find(u => u.id === this.currentUser.id);
        if (found) {
          this.currentUser = found;
        } else {
          // Cari user dengan role OWNER
          const owner = this.data.users.find(u => u.role === 'OWNER') || this.data.users[0];
          this.currentUser = owner;
        }
      }

      // Tulis atomik ke seluruh 29 store IndexedDB
      this.persist();
      return { success: true };
    } catch (e: any) {
      console.error('Gagal menjalankan restoreFromSnapshot:', e);
      return { success: false, error: e.message || 'Terjadi kesalahan sistem saat menulis data restore.' };
    }
  }

  // Debug export / raw inspector access
  public getRawDatabase(): DatabaseSchema {
    return JSON.parse(JSON.stringify(this.data));
  }

  // ==========================================
  // OPERATIONAL EXPENSES (Layar Operasional)
  // ==========================================
  public getAllOperationalExpenses(): OperationalExpense[] {
    return [...(this.data.operationalExpenses || [])];
  }

  public recordOperationalExpense(params: {
    category: string;
    amount: number;
    businessDate: string;
    notes?: string;
    receiptNumber?: string;
    userId?: string;
    createdByName?: string;
  }): { expense: OperationalExpense; journal: Journal } {
    if (!this.data.operationalExpenses) {
      this.data.operationalExpenses = [];
    }
    const seq = String(this.data.operationalExpenses.length + 1).padStart(4, '0');
    const cleanDate = params.businessDate.replace(/-/g, '');
    const expenseId = `EXP-${cleanDate}-${seq}`;
    const journalId = `JRN-${expenseId}`;

    const expense: OperationalExpense = {
      id: expenseId,
      category: params.category,
      amount: Math.round(Math.max(0, params.amount)),
      businessDate: params.businessDate,
      notes: params.notes || '',
      receiptNumber: params.receiptNumber || '',
      userId: params.userId || this.currentUser.id,
      createdByName: params.createdByName || this.currentUser.name,
      journalId,
      createdAt: new Date().toISOString()
    };

    const journal: Journal = {
      id: journalId,
      refType: 'EXPENSE',
      refId: expenseId,
      businessDate: params.businessDate
    };

    const lines: JournalLine[] = [
      {
        id: `${journalId}-1`,
        journalId,
        accountCode: '5200', // BEBAN_OPERASIONAL
        side: 'DEBIT',
        amount: expense.amount
      },
      {
        id: `${journalId}-2`,
        journalId,
        accountCode: '1110', // KAS
        side: 'CREDIT',
        amount: expense.amount
      }
    ];

    this.data.operationalExpenses.unshift(expense);
    this.data.journals.unshift(journal);
    this.data.journalLines.push(...lines);
    this.persist();

    return { expense, journal };
  }

  public deleteOperationalExpense(id: string): boolean {
    if (!this.data.operationalExpenses) return false;
    const exp = this.data.operationalExpenses.find(e => e.id === id);
    if (!exp) return false;

    this.data.operationalExpenses = this.data.operationalExpenses.filter(e => e.id !== id);
    this.data.journals = this.data.journals.filter(j => j.id !== exp.journalId);
    this.data.journalLines = this.data.journalLines.filter(jl => jl.journalId !== exp.journalId);
    this.persist();
    return true;
  }

  // ==========================================
  // JURNAL UMUM (TRANSAKSI NON-KASIR)
  // ==========================================

  public getAllGeneralJournals(): GeneralJournalTransaction[] {
    return [...(this.data.generalJournals || [])];
  }

  public getGeneralJournalById(id: string): GeneralJournalTransaction | undefined {
    return (this.data.generalJournals || []).find(g => g.id === id);
  }

  public recordGeneralJournal(params: {
    businessDate: string;
    description: string;
    refNumber?: string;
    category: GeneralJournalCategory;
    lines: {
      accountCode: string;
      side: 'DEBIT' | 'CREDIT';
      amount: number;
      description?: string;
    }[];
    userId?: string;
    createdByName?: string;
  }): { transaction: GeneralJournalTransaction; journal: Journal } {
    if (!this.data.generalJournals) {
      this.data.generalJournals = [];
    }

    if (!params.lines || params.lines.length < 2) {
      throw new Error('Jurnal umum memerlukan minimal 2 baris transaksi (satu Debit dan satu Kredit)!');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    params.lines.forEach((l, index) => {
      const amt = Math.round(Math.max(0, l.amount));
      if (amt <= 0) {
        throw new Error(`Nominal baris ke-${index + 1} harus lebih dari 0!`);
      }
      if (l.side === 'DEBIT') totalDebit += amt;
      else if (l.side === 'CREDIT') totalCredit += amt;
    });

    if (totalDebit !== totalCredit) {
      throw new Error(
        `Jurnal tidak seimbang! Total Debit (Rp ${totalDebit.toLocaleString('id-ID')}) tidak sama dengan Total Kredit (Rp ${totalCredit.toLocaleString('id-ID')}). Selisih: Rp ${Math.abs(totalDebit - totalCredit).toLocaleString('id-ID')}`
      );
    }

    const seq = String(this.data.generalJournals.length + 1).padStart(4, '0');
    const cleanDate = params.businessDate.replace(/-/g, '');
    const gjId = `GJ-${cleanDate}-${seq}`;
    const journalId = `JRN-${gjId}`;

    const lineItems: GeneralJournalLineItem[] = params.lines.map((l, idx) => ({
      id: `${gjId}-L${idx + 1}`,
      accountCode: l.accountCode,
      side: l.side,
      amount: Math.round(Math.max(0, l.amount)),
      description: l.description || ''
    }));

    const transaction: GeneralJournalTransaction = {
      id: gjId,
      businessDate: params.businessDate,
      description: params.description,
      refNumber: params.refNumber || '',
      category: params.category,
      lines: lineItems,
      totalAmount: totalDebit,
      userId: params.userId || this.currentUser.id,
      createdByName: params.createdByName || this.currentUser.name,
      journalId,
      createdAt: new Date().toISOString()
    };

    const journal: Journal = {
      id: journalId,
      refType: 'GENERAL_JOURNAL',
      refId: gjId,
      businessDate: params.businessDate
    };

    const journalLines: JournalLine[] = lineItems.map((l, idx) => ({
      id: `${journalId}-${idx + 1}`,
      journalId,
      accountCode: l.accountCode,
      side: l.side,
      amount: l.amount
    }));

    this.data.generalJournals.unshift(transaction);
    this.data.journals.unshift(journal);
    this.data.journalLines.push(...journalLines);
    this.persist();

    return { transaction, journal };
  }

  public deleteGeneralJournal(id: string): boolean {
    if (!this.data.generalJournals) return false;
    const gj = this.data.generalJournals.find(g => g.id === id);
    if (!gj) return false;

    this.data.generalJournals = this.data.generalJournals.filter(g => g.id !== id);
    this.data.journals = this.data.journals.filter(j => j.id !== gj.journalId);
    this.data.journalLines = this.data.journalLines.filter(jl => jl.journalId !== gj.journalId);
    this.persist();
    return true;
  }

  // =========================================================================
  // Promotion DAO (Modul Promosi & Diskon Kasir)
  // =========================================================================
  public getAllPromotions(): Promotion[] {
    return this.data.promotions ? [...this.data.promotions] : [];
  }

  public getActivePromotions(): Promotion[] {
    const today = new Date().toISOString().split('T')[0];
    return this.getAllPromotions().filter(p => {
      if (!p.isActive) return false;
      if (p.startDate && p.startDate > today) return false;
      if (p.endDate && p.endDate < today) return false;
      return true;
    });
  }

  public getPromotionByCode(code: string): Promotion | undefined {
    if (!code) return undefined;
    const clean = code.trim().toUpperCase();
    return this.getAllPromotions().find(p => p.code.toUpperCase() === clean);
  }

  public insertPromotion(promotion: Promotion): void {
    if (!this.data.promotions) {
      this.data.promotions = [];
    }
    const cleanCode = promotion.code.trim().toUpperCase();
    const existingIdx = this.data.promotions.findIndex(p => p.code.toUpperCase() === cleanCode);
    if (existingIdx !== -1) {
      this.data.promotions[existingIdx] = { ...promotion, code: cleanCode };
    } else {
      this.data.promotions.unshift({
        ...promotion,
        code: cleanCode,
        createdAt: promotion.createdAt || new Date().toISOString()
      });
    }
    this.persist();
  }

  public updatePromotion(promotion: Promotion): void {
    if (!this.data.promotions) return;
    const idx = this.data.promotions.findIndex(p => p.id === promotion.id);
    if (idx !== -1) {
      this.data.promotions[idx] = { ...promotion, code: promotion.code.trim().toUpperCase() };
      this.persist();
    }
  }

  public deletePromotion(id: string): boolean {
    if (!this.data.promotions) return false;
    this.data.promotions = this.data.promotions.filter(p => p.id !== id);
    this.persist();
    return true;
  }

  public incrementPromotionUsage(code?: string): void {
    if (!code || !this.data.promotions) return;
    const clean = code.trim().toUpperCase();
    const promo = this.data.promotions.find(p => p.code.toUpperCase() === clean);
    if (promo) {
      promo.usageCount = (promo.usageCount || 0) + 1;
      this.persist();
    }
  }
}

export const db = new AppDatabase();
