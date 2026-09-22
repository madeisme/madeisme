/**
 * COMMIT CASH SALE USE CASE — Omah Sembako Sehati ERP
 * 
 * Mengimplementasikan seluruh aturan Prompt 2:
 * 1. Status: DRAFT -> VALIDATED -> COMMITTED
 * 2. Preconditions P1 - P4
 * 3. Idempotency via clientSaleKey
 * 4. FIFO Stock Consumption (InventoryLayer tertua duluan)
 * 5. PPN 11% (default OFF, pembulatan per baris)
 * 6. Pembuatan Jurnal Akuntansi Berpasangan (Double-Entry Seimbang)
 * 7. Eksekusi atomik dalam 1 transaksi
 */

import { db } from '../../database/appDatabase';
import { hasPermission } from '../../rbac/permissions';
import { 
  User, 
  Sale, 
  SaleLine, 
  Journal, 
  JournalLine, 
  InventoryLayer,
  CartItem,
  Product,
  ArTransaction
} from '../../types/erp';
import { calculateLineTotal, addDaysToDate } from '../../utils/formatters';

export interface CommitCashSaleRequest {
  clientSaleKey: string;
  currentUser: User;
  cart: CartItem[];
  applyPpn: boolean;
  paymentMethod?: 'CASH' | 'CREDIT';
  cashPaid?: number; // Rupiah yang diserahkan pembeli (wajib jika CASH)
  customerId?: string; // Wajib jika CREDIT
  creditOverride?: boolean; // Override limit kredit oleh OWNER/ADMIN
  dueDate?: string; // YYYY-MM-DD custom tanggal jatuh tempo (opsional)
  notes?: string;
  discountCode?: string;
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: number;
  discountAmount?: number;
}

export interface CommitCashSaleResult {
  success: boolean;
  errorMessage?: string;
  sale?: Sale;
  saleLines?: SaleLine[];
  journal?: Journal;
  journalLines?: JournalLine[];
  arTransaction?: ArTransaction;
  changeAmount?: number;
}

export class CommitCashSaleUseCase {
  public execute(request: CommitCashSaleRequest): CommitCashSaleResult {
    const { 
      clientSaleKey, 
      currentUser, 
      cart, 
      applyPpn, 
      cashPaid, 
      customerId 
    } = request;

    // =========================================================================
    // §4. IDEMPOTENCY CHECK
    // =========================================================================
    // Jika tombol bayar ditekan dobel, jangan buat Sale baru.
    const existingSale = db.getAllSales().find(s => s.clientSaleKey === clientSaleKey);
    if (existingSale && existingSale.status === 'COMMITTED') {
      const existingLines = db.getAllSaleLines().filter(l => l.saleId === existingSale.id);
      const existingJournal = db.getAllJournals().find(j => j.refId === existingSale.id && j.refType === 'SALE');
      const existingJLines = existingJournal 
        ? db.getAllJournalLines().filter(jl => jl.journalId === existingJournal.id)
        : [];
      return {
        success: true,
        sale: existingSale,
        saleLines: existingLines,
        journal: existingJournal,
        journalLines: existingJLines,
        changeAmount: existingSale.changeAmount
      };
    }

    // =========================================================================
    // §3. PRECONDITIONS CHECK
    // =========================================================================
    
    // P1: Role user aktif memiliki izin SALE_COMMIT (Prompt 7 §2: OWNER, ADMIN, KASIR)
    if (!hasPermission(currentUser.role, 'SALE_COMMIT')) {
      return {
        success: false,
        errorMessage: 'Role Anda tidak diizinkan melakukan transaksi penjualan'
      };
    }

    // P4: Keranjang tidak kosong
    if (!cart || cart.length === 0) {
      return {
        success: false,
        errorMessage: 'Keranjang kosong'
      };
    }

    const allProducts = db.getAllProducts();
    const allLayers = db.getAllInventoryLayers();

    // P2 & P3: Validasi produk aktif & kecukupan stok seluruh keranjang
    for (const item of cart) {
      const product = allProducts.find(p => p.id === item.productId);
      
      // P2: Produk ada & qty > 0
      if (!product || item.qty <= 0) {
        return {
          success: false,
          errorMessage: 'Produk tidak valid'
        };
      }

      // P3: Stok cukup (total quantityRemaining >= requested qty)
      const availableStock = allLayers
        .filter(l => l.productId === item.productId)
        .reduce((sum, l) => sum + l.quantityRemaining, 0);

      if (availableStock < item.qty) {
        return {
          success: false,
          errorMessage: `Stok tidak cukup untuk ${product.name} (Tersedia: ${availableStock} ${product.unit}, Diminta: ${item.qty} ${product.unit})`
        };
      }
    }

    // =========================================================================
    // §2. STATUS: VALIDATED
    // =========================================================================
    // Semua validasi awal lolos, mulai pemrosesan transaksi

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timestampStr = now.toISOString();
    const saleId = `SL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(db.getAllSales().length + 1).padStart(4, '0')}`;

    // Salin layer agar aman saat simulasi mutasi
    const workingLayers: InventoryLayer[] = JSON.parse(JSON.stringify(allLayers));
    const saleLinesToInsert: SaleLine[] = [];
    let subtotalOverall = 0;
    let ppnOverall = 0;
    let hppOverall = 0;

    // =========================================================================
    // §5. LOGIC KONSUMSI FIFO
    // =========================================================================
    for (let index = 0; index < cart.length; index++) {
      const item = cart[index];
      const lineId = `${saleId}-${index + 1}`;
      let remainingQtyToFulfill = item.qty;
      let hppLine = 0;
      const consumedLayersForLine: { layerId: string; qty: number; unitCost: number }[] = [];

      // 1. Ambil semua InventoryLayer milik produk yang quantityRemaining > 0, urutkan dari receivedAt paling lama
      const productLayers = workingLayers
        .filter(l => l.productId === item.productId && l.quantityRemaining > 0)
        .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

      // 2. Kurangi quantityRemaining layer tertua dulu sampai qty terpenuhi
      for (const layer of productLayers) {
        if (remainingQtyToFulfill <= 0) break;

        const qtyTaken = Math.min(layer.quantityRemaining, remainingQtyToFulfill);
        layer.quantityRemaining -= qtyTaken;
        remainingQtyToFulfill -= qtyTaken;

        // 3. hppLine = sum(qty taken * unitCost layer)
        const costChunk = qtyTaken * layer.unitCost;
        hppLine += costChunk;

        consumedLayersForLine.push({
          layerId: layer.id,
          qty: qtyTaken,
          unitCost: layer.unitCost
        });
      }

      if (remainingQtyToFulfill > 0) {
        return {
          success: false,
          errorMessage: 'Stok tidak cukup saat alokasi FIFO'
        };
      }

      // Hitung per-baris sesuai aturan §4/§6 Prompt 1 & Prompt 2
      const lineSubtotal = calculateLineTotal(item.qty, item.unitPrice);
      subtotalOverall += lineSubtotal;
      hppOverall += hppLine;

      // §6. Pajak (PPN): pembulatan per baris
      let ppnLine = 0;
      if (applyPpn) {
        ppnLine = Math.round(lineSubtotal * 0.11);
        ppnOverall += ppnLine;
      }

      saleLinesToInsert.push({
        id: lineId,
        saleId,
        productId: item.productId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        hppLine,
        ppnLine,
        consumedLayers: consumedLayersForLine
      });
    }

    // Hitung Potongan Diskon / Promosi (Akun 4120)
    const discountAmount = Math.min(subtotalOverall, Math.max(0, request.discountAmount || 0));
    const grandTotal = Math.max(0, subtotalOverall - discountAmount) + ppnOverall;
    const isCredit = (request.paymentMethod || 'CASH') === 'CREDIT';
    let customer = customerId ? db.getCustomerById(customerId) : undefined;
    let dueDate: string | undefined = undefined;
    let arTransaction: ArTransaction | undefined = undefined;
    let finalCashPaid = 0;
    let finalChangeAmount = 0;

    if (isCredit) {
      // =========================================================================
      // §3. CEK LIMIT KREDIT & TEMPO (WAJIB SEBELUM COMMIT SALE KREDIT)
      // =========================================================================
      if (!customerId || !customer) {
        return {
          success: false,
          errorMessage: 'Pelanggan wajib dipilih untuk penjualan kredit (tempo)'
        };
      }

      // Aturan: creditLimit == 0 -> tidak boleh kredit sama sekali
      if (customer.creditLimit <= 0) {
        return {
          success: false,
          errorMessage: `Pelanggan "${customer.name}" tidak memiliki fasilitas kredit (limit kredit Rp 0)`
        };
      }

      // Cek exposure: Customer.arBalance + grandTotal > creditLimit
      const exposure = customer.arBalance;
      const totalExposureAfterSale = exposure + grandTotal;

      if (totalExposureAfterSale > customer.creditLimit) {
        // Kecuali: role aktif memiliki izin CREDIT_OVERRIDE (OWNER / ADMIN) dan mencentang override
        const isAuthorizedRole = hasPermission(currentUser.role, 'CREDIT_OVERRIDE');
        if (!isAuthorizedRole || !request.creditOverride) {
          return {
            success: false,
            errorMessage: `Melebihi limit kredit pelanggan! Total piutang akan menjadi Rp ${totalExposureAfterSale.toLocaleString('id-ID')} (Limit: Rp ${customer.creditLimit.toLocaleString('id-ID')}). Dibutuhkan persetujuan Owner/Admin.`
          };
        }
      }

      const termsDays = customer.creditTermsDays || 30;
      dueDate = request.dueDate || addDaysToDate(dateStr, termsDays);
      finalCashPaid = 0;
      finalChangeAmount = 0;

      // ArTransaction untuk mencatat penambahan piutang
      const arTxId = `AR-${Date.now()}`;
      arTransaction = {
        id: arTxId,
        customerId: customer.id,
        type: 'SALE_CREDIT',
        amount: grandTotal,
        businessDate: dateStr,
        refSaleId: saleId,
        notes: request.notes || `Penjualan tempo ${termsDays} hari (Jatuh tempo: ${dueDate})${request.creditOverride ? ' [Otorisasi Override Limit]' : ''}`,
        createdAt: timestampStr
      };
    } else {
      // Pembayaran tunai: Validasi uang cukup
      finalCashPaid = cashPaid || 0;
      if (finalCashPaid < grandTotal) {
        return {
          success: false,
          errorMessage: `Nominal tunai kurang (Total: Rp ${grandTotal.toLocaleString('id-ID')}, Dibayar: Rp ${finalCashPaid.toLocaleString('id-ID')})`
        };
      }
      finalChangeAmount = finalCashPaid - grandTotal;
    }

    // Prompt 8: Cek apakah kasir memiliki sesi kasir OPEN
    const activeSession = db.getActiveCashSession ? db.getActiveCashSession(currentUser.id) : undefined;

    // Entity Sale final (COMMITTED)
    const committedSale: Sale = {
      id: saleId,
      clientSaleKey,
      customerId: customerId || undefined,
      status: 'COMMITTED',
      paymentMethod: isCredit ? 'CREDIT' : 'CASH',
      dueDate,
      creditOverride: isCredit ? Boolean(request.creditOverride) : undefined,
      subtotal: subtotalOverall,
      discountCode: request.discountCode || undefined,
      discountType: request.discountType || undefined,
      discountValue: request.discountValue || undefined,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      ppnAmount: ppnOverall,
      grandTotal,
      cashPaid: finalCashPaid,
      changeAmount: finalChangeAmount,
      cashierName: currentUser.name,
      userId: currentUser.id,
      cashSessionId: activeSession?.id,
      businessDate: dateStr,
      createdAt: timestampStr
    };

    // =========================================================================
    // §7. MEMBANGUN JOURNAL (DOUBLE-ENTRY WAJIB SEIMBANG)
    // =========================================================================
    const journalId = `JRN-${dateStr.replace(/-/g, '')}-${String(db.getAllJournals().length + 1).padStart(4, '0')}`;
    const journal: Journal = {
      id: journalId,
      refType: 'SALE',
      refId: saleId,
      businessDate: dateStr
    };

    const journalLines: JournalLine[] = [];
    let jlIdx = 1;

    if (isCredit) {
      // Jurnal Jual Kredit (Prompt 4 §4):
      // Dr 1210 PIUTANG_USAHA = grandTotal
      journalLines.push({
        id: `${journalId}-${jlIdx++}`,
        journalId,
        accountCode: '1210', // PIUTANG_USAHA
        side: 'DEBIT',
        amount: grandTotal
      });
    } else {
      // Jurnal Jual Tunai (Prompt 2 §7):
      // Dr 1110 KAS = grandTotal
      journalLines.push({
        id: `${journalId}-${jlIdx++}`,
        journalId,
        accountCode: '1110', // KAS
        side: 'DEBIT',
        amount: grandTotal
      });
    }

    // Dr 4120 DISKON_PENJUALAN = discountAmount (Kontra-Pendapatan)
    if (discountAmount > 0) {
      journalLines.push({
        id: `${journalId}-${jlIdx++}`,
        journalId,
        accountCode: '4120', // DISKON_PENJUALAN
        side: 'DEBIT',
        amount: discountAmount
      });
    }

    // Dr 5110 HPP = hppOverall
    journalLines.push({
      id: `${journalId}-${jlIdx++}`,
      journalId,
      accountCode: '5110', // HPP
      side: 'DEBIT',
      amount: hppOverall
    });

    // Cr 4110 PENJUALAN = subtotalOverall
    journalLines.push({
      id: `${journalId}-${jlIdx++}`,
      journalId,
      accountCode: '4110', // PENJUALAN
      side: 'CREDIT',
      amount: subtotalOverall
    });

    // Cr 2210 PPN_KELUARAN = ppnOverall (jika PPN aktif)
    if (applyPpn && ppnOverall > 0) {
      journalLines.push({
        id: `${journalId}-${jlIdx++}`,
        journalId,
        accountCode: '2210', // PPN_KELUARAN
        side: 'CREDIT',
        amount: ppnOverall
      });
    }

    // Cr 1310 PERSEDIAAN = hppOverall
    journalLines.push({
      id: `${journalId}-${jlIdx++}`,
      journalId,
      accountCode: '1310', // PERSEDIAAN
      side: 'CREDIT',
      amount: hppOverall
    });

    // =========================================================================
    // CEK WAJIB SEBELUM SIMPAN: SUM(DEBIT) == SUM(CREDIT)
    // =========================================================================
    const totalDebit = journalLines
      .filter(l => l.side === 'DEBIT')
      .reduce((sum, l) => sum + l.amount, 0);

    const totalCredit = journalLines
      .filter(l => l.side === 'CREDIT')
      .reduce((sum, l) => sum + l.amount, 0);

    if (totalDebit !== totalCredit) {
      console.error('FATAL: Jurnal tidak balance!', { totalDebit, totalCredit, journalLines });
      throw new Error(`Jurnal tidak balance! Debit = ${totalDebit}, Credit = ${totalCredit}`);
    }

    // =========================================================================
    // §8. EKSEKUSI ATOMIK DALAM DATABASE
    // =========================================================================
    db.commitAtomicSaleTransaction({
      sale: committedSale,
      saleLines: saleLinesToInsert,
      updatedLayers: workingLayers,
      journal,
      journalLines,
      arTransaction
    });

    // Catat pemakaian kode promo jika ada
    if (request.discountCode) {
      db.incrementPromotionUsage(request.discountCode);
    }

    return {
      success: true,
      sale: committedSale,
      saleLines: saleLinesToInsert,
      journal,
      journalLines,
      arTransaction,
      changeAmount: finalChangeAmount
    };
  }
}

export const commitCashSaleUseCase = new CommitCashSaleUseCase();
