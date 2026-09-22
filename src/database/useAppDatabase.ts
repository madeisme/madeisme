import { useEffect, useState } from 'react';
import { db } from './appDatabase';
import { BackupConfig, GeneralJournalCategory, JournalSide } from '../types/erp';

export type AppDatabaseRepository = ReturnType<typeof getAppDatabaseRepository>;

export function getAppDatabaseRepository() {
  return {
    db,
    store: db.getStore(),
    currentUser: db.currentUser,
    users: db.getAllUsers(),
    products: db.getAllProducts(),
    customers: db.getAllCustomers(),
    suppliers: db.getAllSuppliers(),
    inventoryLayers: db.getAllInventoryLayers(),
    accounts: db.getAllAccounts(),
    sales: db.getAllSales(),
    saleLines: db.getAllSaleLines(),
    journals: db.getAllJournals(),
    journalLines: db.getAllJournalLines(),
    purchases: db.getAllPurchases(),
    purchaseLines: db.getAllPurchaseLines(),
    purchaseReceipts: db.getPurchaseReceipts(),
    arTransactions: db.getAllArTransactions(),
    saleReturns: db.getAllSaleReturns(),
    purchaseReturns: db.getAllPurchaseReturns(),
    cashSessions: db.getAllCashSessions(),
    stockOpnames: db.getAllStockOpnames(),
    stockOpnameLines: db.getAllStockOpnameLines(),
    stockTransfers: db.getAllStockTransfers(),
    stockTransferLines: db.getAllStockTransferLines(),
    googleAccountLink: db.getGoogleAccountLink(),
    backupConfig: db.getBackupConfig(),
    backupConfigs: db.getAllBackupConfigs(),
    operationalExpenses: db.getAllOperationalExpenses(),
    generalJournals: db.getAllGeneralJournals(),
    promotions: db.getAllPromotions(),
    taxInvoiceNumbers: db.getAllTaxInvoiceNumbers(),
    idempotencyKeys: db.getAllIdempotencyKeys(),
    isReady: db.isReady,
    getRawDatabase: () => db.getRawDatabase(),
    restoreFromSnapshot: (tablesData: any, actorRole: string) => db.restoreFromSnapshot(tablesData, actorRole),
    recordGeneralJournal: (params: {
      businessDate: string;
      description: string;
      refNumber?: string;
      category: GeneralJournalCategory;
      lines: {
        accountCode: string;
        side: JournalSide;
        amount: number;
        description?: string;
      }[];
      userId?: string;
      createdByName?: string;
    }) => db.recordGeneralJournal(params),
    deleteGeneralJournal: (id: string) => db.deleteGeneralJournal(id),
    recordOperationalExpense: (params: {
      category: string;
      amount: number;
      businessDate: string;
      notes?: string;
      receiptNumber?: string;
      userId?: string;
      createdByName?: string;
    }) => db.recordOperationalExpense(params),
    deleteOperationalExpense: (id: string) => db.deleteOperationalExpense(id),
    saveBackupConfig: (config: BackupConfig) => db.saveBackupConfig(config),
    updateBackupTimestamp: (
      lastBackupAt: string,
      extra?: { fileId?: string; googleEmail?: string; schemaVersion?: number; fileName?: string }
    ) => db.updateBackupTimestamp(lastBackupAt, extra),
    kasirCart: db.kasirCart,
    getStockForProduct: (id: string, location?: any) => db.getProductCurrentStock(id, location),
    getProductStockBreakdown: (id: string) => db.getProductStockBreakdown(id),
    getLayersForProduct: (id: string) => db.getLayersForProduct(id),
    getCustomerCreditSalesWithSettlement: (customerId: string) => db.getCustomerCreditSalesWithSettlement(customerId),
  };
}

export function useAppDatabase(): AppDatabaseRepository {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setTick(t => t + 1);
    });
    return unsubscribe;
  }, []);

  return getAppDatabaseRepository();
}

