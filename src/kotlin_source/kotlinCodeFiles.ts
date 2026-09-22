export interface KotlinCodeFile {
  filename: string;
  path: string;
  description: string;
  code: string;
}

export const KOTLIN_FILES: KotlinCodeFile[] = [
  {
    filename: 'Entities.kt',
    path: 'app/src/main/java/com/omahsembako/erp/data/local/entity/Entities.kt',
    description: '11 Room Entities sesuai §4 spesifikasi Omah Sembako Sehati',
    code: `package com.omahsembako.erp.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * ATURAN BISNIS NON-NEGOSIASI:
 * 1. Immutable after commit (Sale, Journal, InventoryLayer tidak pernah di-UPDATE/DELETE).
 * 2. Double-entry wajib seimbang (Dr == Cr, integer Rupiah).
 * 3. FIFO untuk biaya stok (InventoryLayer tertua dikonsumsi duluan).
 * 4. Rounding per baris, bukan per total.
 * 5. Role-based access (5 role).
 */

enum class UserRole {
    OWNER, ADMIN, BOOKKEEPER, KASIR, GUDANG
}

enum class ItemType {
    EQT, KNS, AFL
}

enum class AccountType {
    ASET, LIABILITAS, EKUITAS, PENDAPATAN, KONTRA_PENDAPATAN, BEBAN
}

enum class JournalSide {
    DEBIT, CREDIT
}

enum class SaleStatus {
    DRAFT, VALIDATED, COMMITTED
}

// 1. Store (id, name) — single store, 1 row aktif
@Entity(tableName = "stores")
data class StoreEntity(
    @PrimaryKey val id: String,
    val name: String
)

// 2. User (id, name, role)
@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val name: String,
    val role: UserRole
)

// 3. Product (id, name, unit, sellPrice: Long, itemType: EQT)
@Entity(tableName = "products")
data class ProductEntity(
    @PrimaryKey val id: String,
    val name: String,
    val unit: String,
    val sellPrice: Long, // Satuan Rupiah (Long, integer)
    val itemType: ItemType = ItemType.EQT,
    val category: String = "Sembako Utama",
    val minStockAlert: Int = 10
)

// 4. Customer (id, name, phone, arBalance: Long)
@Entity(tableName = "customers")
data class CustomerEntity(
    @PrimaryKey val id: String,
    val name: String,
    val phone: String,
    val arBalance: Long // Piutang usaha (Long Rupiah)
)

// 5. Supplier (id, name, phone, apBalance: Long)
@Entity(tableName = "suppliers")
data class SupplierEntity(
    @PrimaryKey val id: String,
    val name: String,
    val phone: String,
    val apBalance: Long // Hutang usaha (Long Rupiah)
)

// 6. InventoryLayer (id, productId, quantityRemaining, unitCost: Long, receivedAt)
@Entity(
    tableName = "inventory_layers",
    foreignKeys = [
        ForeignKey(
            entity = ProductEntity::class,
            parentColumns = ["id"],
            childColumns = ["productId"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [Index(value = ["productId"]), Index(value = ["receivedAt"])]
)
data class InventoryLayerEntity(
    @PrimaryKey val id: String,
    val productId: String,
    val quantityRemaining: Int, // Unit tersisa dalam layer
    val unitCost: Long, // HPP per unit (Long Rupiah)
    val receivedAt: Long // Epoch timestamp (FIFO order)
)

// 7. Sale (id, customerId?, status, subtotal: Long, ppnAmount: Long, grandTotal: Long, businessDate)
@Entity(
    tableName = "sales",
    foreignKeys = [
        ForeignKey(
            entity = CustomerEntity::class,
            parentColumns = ["id"],
            childColumns = ["customerId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["customerId"]), 
        Index(value = ["businessDate"]),
        Index(value = ["clientSaleKey"], unique = true)
    ]
)
data class SaleEntity(
    @PrimaryKey val id: String,
    val clientSaleKey: String, // UUID untuk Idempotency (§4)
    val customerId: String?,
    val status: SaleStatus, // DRAFT -> VALIDATED -> COMMITTED (§2)
    val subtotal: Long,
    val ppnAmount: Long,
    val grandTotal: Long,
    val cashPaid: Long,
    val changeAmount: Long,
    val cashierName: String,
    val businessDate: String, // YYYY-MM-DD
    val createdAt: Long = System.currentTimeMillis()
)

// 8. SaleLine (id, saleId, productId, qty, unitPrice: Long, hppLine: Long)
@Entity(
    tableName = "sale_lines",
    foreignKeys = [
        ForeignKey(
            entity = SaleEntity::class,
            parentColumns = ["id"],
            childColumns = ["saleId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = ProductEntity::class,
            parentColumns = ["id"],
            childColumns = ["productId"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [Index(value = ["saleId"]), Index(value = ["productId"])]
)
data class SaleLineEntity(
    @PrimaryKey val id: String,
    val saleId: String,
    val productId: String,
    val qty: Int,
    val unitPrice: Long,
    val hppLine: Long // Dihitung per baris dengan FIFO
)

// 9. Journal (id, refType, refId, businessDate)
@Entity(
    tableName = "journals",
    indices = [Index(value = ["businessDate"]), Index(value = ["refType", "refId"])]
)
data class JournalEntity(
    @PrimaryKey val id: String,
    val refType: String, // e.g. "SALE", "PURCHASE"
    val refId: String,
    val businessDate: String
)

// 10. JournalLine (id, journalId, accountCode, side: DEBIT|CREDIT, amount: Long)
@Entity(
    tableName = "journal_lines",
    foreignKeys = [
        ForeignKey(
            entity = JournalEntity::class,
            parentColumns = ["id"],
            childColumns = ["journalId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = AccountEntity::class,
            parentColumns = ["code"],
            childColumns = ["accountCode"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [Index(value = ["journalId"]), Index(value = ["accountCode"])]
)
data class JournalLineEntity(
    @PrimaryKey val id: String,
    val journalId: String,
    val accountCode: String,
    val side: JournalSide,
    val amount: Long // Integer Rupiah
)

// 11. Account (code, name, type) — minimal 8 akun seed
@Entity(tableName = "accounts")
data class AccountEntity(
    @PrimaryKey val code: String,
    val name: String,
    val type: AccountType
)

// PROMPT 3: ENTITY ALUR PEMBELIAN (PURCHASE ORDER & RECEIPT)
enum class PurchaseStatus {
    DRAFT, APPROVED, RECEIVING, RECEIVED
}

enum class PurchasePaymentMethod {
    CASH, CREDIT
}

@Entity(
    tableName = "purchases",
    foreignKeys = [
        ForeignKey(
            entity = SupplierEntity::class,
            parentColumns = ["id"],
            childColumns = ["supplierId"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [Index(value = ["supplierId"])]
)
data class PurchaseEntity(
    @PrimaryKey val id: String, // e.g. "PO-202609-001"
    val supplierId: String,
    val status: PurchaseStatus,
    val paymentMethod: PurchasePaymentMethod,
    val businessDate: String,
    val subtotal: Long,
    val ppnAmount: Long,
    val grandTotal: Long,
    val createdBy: String,
    val approvedBy: String? = null,
    val createdAt: String,
    val notes: String? = null
)

@Entity(
    tableName = "purchase_lines",
    foreignKeys = [
        ForeignKey(
            entity = PurchaseEntity::class,
            parentColumns = ["id"],
            childColumns = ["purchaseId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = ProductEntity::class,
            parentColumns = ["id"],
            childColumns = ["productId"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [Index(value = ["purchaseId"]), Index(value = ["productId"])]
)
data class PurchaseLineEntity(
    @PrimaryKey val id: String,
    val purchaseId: String,
    val productId: String,
    val qtyOrdered: Int,
    val qtyReceivedCumulative: Int,
    val poPrice: Long // Modal terkunci untuk InventoryLayer
)

@Entity(
    tableName = "purchase_receipts",
    foreignKeys = [
        ForeignKey(
            entity = PurchaseEntity::class,
            parentColumns = ["id"],
            childColumns = ["purchaseId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["purchaseId"])]
)
data class PurchaseReceiptEntity(
    @PrimaryKey val id: String, // e.g. "RC-202609-001"
    val purchaseId: String,
    val receivedAt: String,
    val businessDate: String,
    val receivedBy: String,
    val notes: String? = null
)

// PROMPT 8: SESI KASIR (SHIFT & REKONSILIASI KAS FISIK)
enum class CashSessionStatus {
    OPEN, CLOSED
}

@Entity(
    tableName = "cash_sessions",
    foreignKeys = [
        ForeignKey(
            entity = UserEntity::class,
            parentColumns = ["id"],
            childColumns = ["userId"],
            onDelete = ForeignKey.RESTRICT
        ),
        ForeignKey(
            entity = JournalEntity::class,
            parentColumns = ["id"],
            childColumns = ["journalId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [Index(value = ["userId"]), Index(value = ["status"])]
)
data class CashSessionEntity(
    @PrimaryKey val id: String, // e.g. "CS-202609-001"
    val storeId: String,
    val userId: String,
    val status: CashSessionStatus,
    val openedAt: String,
    val openingFloat: Long, // Modal awal laci kasir (Rupiah integer)
    val closedAt: String? = null,
    val systemExpectedCash: Long? = null, // Dihitung sistem saat tutup shift
    val actualCash: Long? = null, // Hasil hitung fisik kasir
    val variance: Long? = null, // actualCash - systemExpectedCash
    val journalId: String? = null, // Jurnal selisih kas (5910 SELISIH_KAS)
    val notes: String? = null
)
`
  },
  {
    filename: 'Daos.kt',
    path: 'app/src/main/java/com/omahsembako/erp/data/local/dao/Daos.kt',
    description: 'Room Data Access Objects (DAO) dengan Kotlin Flow reactive queries',
    code: `package com.omahsembako.erp.data.local.dao

import androidx.room.*
import com.omahsembako.erp.data.local.entity.*
import kotlinx.coroutines.flow.Flow

@Dao
interface StoreDao {
    @Query("SELECT * FROM stores LIMIT 1")
    fun getStore(): Flow<StoreEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStore(store: StoreEntity)
}

@Dao
interface UserDao {
    @Query("SELECT * FROM users")
    fun getAllUsers(): Flow<List<UserEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: UserEntity)
}

@Dao
interface ProductDao {
    @Query("SELECT * FROM products ORDER BY name ASC")
    fun getAllProducts(): Flow<List<ProductEntity>>

    @Query("SELECT * FROM products WHERE id = :id")
    suspend fun getProductById(id: String): ProductEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProduct(product: ProductEntity)
}

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers ORDER BY name ASC")
    fun getAllCustomers(): Flow<List<CustomerEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCustomer(customer: CustomerEntity)
}

@Dao
interface SupplierDao {
    @Query("SELECT * FROM suppliers ORDER BY name ASC")
    fun getAllSuppliers(): Flow<List<SupplierEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSupplier(supplier: SupplierEntity)
}

@Dao
interface InventoryLayerDao {
    @Query("SELECT * FROM inventory_layers WHERE productId = :productId AND quantityRemaining > 0 ORDER BY receivedAt ASC")
    fun getActiveLayersFifo(productId: String): Flow<List<InventoryLayerEntity>>

    @Query("SELECT SUM(quantityRemaining) FROM inventory_layers WHERE productId = :productId")
    fun getTotalStock(productId: String): Flow<Int?>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertLayer(layer: InventoryLayerEntity)
}

@Dao
interface AccountDao {
    @Query("SELECT * FROM accounts ORDER BY code ASC")
    fun getAllAccounts(): Flow<List<AccountEntity>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAccounts(accounts: List<AccountEntity>)
}

@Dao
interface SaleDao {
    @Query("SELECT * FROM sales ORDER BY businessDate DESC")
    fun getAllSales(): Flow<List<SaleEntity>>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSale(sale: SaleEntity)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSaleLines(lines: List<SaleLineEntity>)
}

@Dao
interface JournalDao {
    @Query("SELECT * FROM journals ORDER BY businessDate DESC")
    fun getAllJournals(): Flow<List<JournalEntity>>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertJournal(journal: JournalEntity)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertJournalLines(lines: List<JournalLineEntity>)
}
`
  },
  {
    filename: 'AppDatabase.kt',
    path: 'app/src/main/java/com/omahsembako/erp/data/local/AppDatabase.kt',
    description: 'RoomDatabase dengan RoomDatabase.Callback untuk auto-seeding 8 Akun (§6)',
    code: `package com.omahsembako.erp.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.omahsembako.erp.data.local.dao.*
import com.omahsembako.erp.data.local.entity.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [
        StoreEntity::class,
        UserEntity::class,
        ProductEntity::class,
        CustomerEntity::class,
        SupplierEntity::class,
        InventoryLayerEntity::class,
        SaleEntity::class,
        SaleLineEntity::class,
        JournalEntity::class,
        JournalLineEntity::class,
        AccountEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun storeDao(): StoreDao
    abstract fun userDao(): UserDao
    abstract fun productDao(): ProductDao
    abstract fun customerDao(): CustomerDao
    abstract fun supplierDao(): SupplierDao
    abstract fun inventoryLayerDao(): InventoryLayerDao
    abstract fun accountDao(): AccountDao
    abstract fun saleDao(): SaleDao
    abstract fun journalDao(): JournalDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context, scope: CoroutineScope): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "omah_sembako_sehati.db"
                )
                .addCallback(DatabaseCallback(scope))
                .build()
                INSTANCE = instance
                instance
            }
        }
    }

    private class DatabaseCallback(
        private val scope: CoroutineScope
    ) : RoomDatabase.Callback() {
        override fun onCreate(db: SupportSQLiteDatabase) {
            super.onCreate(db)
            INSTANCE?.let { database ->
                scope.launch(Dispatchers.IO) {
                    populateInitialData(database)
                }
            }
        }

        suspend fun populateInitialData(database: AppDatabase) {
            // Seed 1: Single Store
            database.storeDao().insertStore(
                StoreEntity(id = "STR-001", name = "Omah Sembako Sehati")
            )

            // Seed 2: 8 Akun Chart of Accounts (§6)
            val seedAccounts = listOf(
                AccountEntity("1110", "KAS", AccountType.ASET),
                AccountEntity("1310", "PERSEDIAAN", AccountType.ASET),
                AccountEntity("1210", "PIUTANG_USAHA", AccountType.ASET),
                AccountEntity("2110", "HUTANG_USAHA", AccountType.LIABILITAS),
                AccountEntity("2210", "PPN_KELUARAN", AccountType.LIABILITAS),
                AccountEntity("4110", "PENJUALAN", AccountType.PENDAPATAN),
                AccountEntity("4120", "DISKON_PENJUALAN", AccountType.KONTRA_PENDAPATAN),
                AccountEntity("5110", "HPP", AccountType.BEBAN)
            )
            database.accountDao().insertAccounts(seedAccounts)

            // Seed 3: Default User
            database.userDao().insertUser(
                UserEntity("USR-001", "Pak Budi", UserRole.OWNER)
            )
        }
    }
}
`
  },
  {
    filename: 'NavGraph.kt',
    path: 'app/src/main/java/com/omahsembako/erp/ui/navigation/NavGraph.kt',
    description: 'Jetpack Navigation Compose dengan 5 Bottom Destinations & Retained State',
    code: `package com.omahsembako.erp.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Beranda : Screen("beranda", "Beranda", Icons.Default.Home)
    object Kasir : Screen("kasir", "Kasir", Icons.Default.ShoppingCart)
    object Beli : Screen("beli", "Beli", Icons.Default.ShoppingBag)
    object Stok : Screen("stok", "Stok", Icons.Default.Inventory2)
    object Operasional : Screen("operasional", "Operasional", Icons.Default.TaskAlt)
}

val bottomNavItems = listOf(
    Screen.Beranda,
    Screen.Kasir,
    Screen.Beli,
    Screen.Stok,
    Screen.Operasional
)

/**
 * Aturan Navigasi:
 * Pindah tab TIDAK BOLEH mereset state tab asal (misal keranjang di Kasir tetap ada).
 * Gunakan:
 * navController.navigate(screen.route) {
 *     popUpTo(navController.graph.findStartDestination().id) {
 *         saveState = true
 *     }
 *     launchSingleTop = true
 *     restoreState = true
 * }
 */
`
  },
  {
    filename: 'BusinessRules.kt',
    path: 'app/src/main/java/com/omahsembako/erp/domain/BusinessRules.kt',
    description: 'Dokumentasi Aturan Bisnis Non-Negosiasi & RBAC hasPermission()',
    code: `package com.omahsembako.erp.domain

import com.omahsembako.erp.data.local.entity.UserRole

/**
 * ATURAN BISNIS NON-NEGOSIASI OMAH SEMBAKO SEHATI:
 * 
 * 1. Immutable after commit:
 *    Sale, Journal, InventoryLayer TIDAK PERNAH di-UPDATE atau DELETE setelah commit.
 *    Koreksi selalu melalui transaksi pembalik/retur baru.
 * 
 * 2. Double-entry wajib seimbang:
 *    Setiap Journal, total baris DEBIT harus persis sama dengan total baris CREDIT
 *    dalam satuan integer Rupiah (Long).
 * 
 * 3. FIFO untuk biaya stok:
 *    Barang keluar (penjualan) mengonsumsi InventoryLayer paling lama lebih dulu
 *    berdasarkan receivedAt (bukan rata-rata / moving average).
 * 
 * 4. Rounding per baris, bukan per total:
 *    Tiap SaleLine dihitung dan dibulatkan sendiri-sendiri (Math.round-equivalent);
 *    Total transaksi adalah hasil penjumlahan baris yang sudah dibulatkan.
 * 
 * 5. Role-based access (RBAC):
 *    5 role: OWNER, ADMIN, BOOKKEEPER, KASIR, GUDANG.
 */

enum class UserAction {
    VIEW_DASHBOARD,
    CREATE_SALE,
    VOID_SALE,
    VIEW_COST_HPP,
    MANAGE_STOCK,
    RECEIVE_PO,
    VIEW_JOURNAL,
    MANAGE_ACCOUNTS,
    MANAGE_USERS
}

fun hasPermission(role: UserRole, action: UserAction): Boolean {
    return when (role) {
        UserRole.OWNER -> true
        UserRole.ADMIN -> action != UserAction.MANAGE_USERS
        UserRole.BOOKKEEPER -> action in listOf(
            UserAction.VIEW_DASHBOARD,
            UserAction.VIEW_COST_HPP,
            UserAction.VIEW_JOURNAL,
            UserAction.MANAGE_ACCOUNTS
        )
        UserRole.KASIR -> action in listOf(
            UserAction.VIEW_DASHBOARD,
            UserAction.CREATE_SALE
        )
        UserRole.GUDANG -> action in listOf(
            UserAction.VIEW_DASHBOARD,
            UserAction.MANAGE_STOCK,
            UserAction.RECEIVE_PO
        )
    }
}
`
  },
  {
    filename: 'CashSaleUseCase.kt',
    path: 'app/src/main/java/com/omahsembako/erp/domain/usecase/CashSaleUseCase.kt',
    description: 'Prompt 2: Alur Jual Tunai End-to-End, FIFO, Idempotency, & Jurnal Seimbang',
    code: `package com.omahsembako.erp.domain.usecase

import androidx.room.withTransaction
import com.omahsembako.erp.data.local.AppDatabase
import com.omahsembako.erp.data.local.entity.*
import java.util.UUID
import kotlin.math.roundToLong

/**
 * PROMPT 2: ALUR JUAL TUNAI END-TO-END
 * 
 * Aturan Bisnis Terpenuhi:
 * 1. Preconditions P1-P4
 * 2. Idempotency via clientSaleKey
 * 3. Konsumsi Stok FIFO (InventoryLayer paling lama lebih dulu)
 * 4. PPN 11% Toggle opsional (default bebas PPN sembako)
 * 5. Double-Entry Jurnal seimbang (SUM Debit == SUM Credit)
 * 6. Atomic Room Transaction
 */

data class CartItem(
    val product: ProductEntity,
    val qty: Int,
    val unitPrice: Long
)

data class CashSaleRequest(
    val clientSaleKey: String = UUID.randomUUID().toString(),
    val currentUser: UserEntity,
    val items: List<CartItem>,
    val applyPpn: Boolean = false,
    val cashPaid: Long,
    val businessDate: String
)

sealed class CashSaleResult {
    data class Success(val sale: SaleEntity, val journal: JournalEntity) : CashSaleResult()
    data class Error(val message: String) : CashSaleResult()
}

class CashSaleUseCase(private val db: AppDatabase) {

    suspend fun execute(request: CashSaleRequest): CashSaleResult {
        // §4. IDEMPOTENCY CHECK
        val existingSale = db.saleDao().getSaleByClientKey(request.clientSaleKey)
        if (existingSale != null && existingSale.status == SaleStatus.COMMITTED) {
            val journal = db.journalDao().getJournalByRef("SALE", existingSale.id)!!
            return CashSaleResult.Success(existingSale, journal)
        }

        // §3. PRECONDITIONS
        // P1: Role user aktif
        val allowedRoles = listOf(UserRole.OWNER, UserRole.ADMIN, UserRole.KASIR)
        if (request.currentUser.role !in allowedRoles) {
            return CashSaleResult.Error("Role Anda tidak boleh melakukan penjualan")
        }

        // P4: Keranjang tidak kosong
        if (request.items.isEmpty()) {
            return CashSaleResult.Error("Keranjang kosong")
        }

        // P2 & P3: Validasi produk aktif & kecukupan stok
        for (item in request.items) {
            if (item.qty <= 0) {
                return CashSaleResult.Error("Produk tidak valid")
            }
            val availableStock = db.inventoryLayerDao().getTotalStockForProduct(item.product.id)
            if (availableStock < item.qty) {
                return CashSaleResult.Error("Stok tidak cukup")
            }
        }

        // §8. EKSEKUSI ATOMIK DALAM ROOM TRANSACTION
        return db.withTransaction {
            val saleId = "SL-\${System.currentTimeMillis()}"
            val journalId = "JRN-\${System.currentTimeMillis()}"

            var subtotalOverall = 0L
            var ppnOverall = 0L
            var hppOverall = 0L

            val saleLines = mutableListOf<SaleLineEntity>()
            val layersToUpdate = mutableListOf<InventoryLayerEntity>()

            // §5. FIFO STOCK CONSUMPTION
            for ((index, item) in request.items.withIndex()) {
                var neededQty = item.qty
                var lineHpp = 0L

                // Ambil layer terurut dari receivedAt tertua
                val productLayers = db.inventoryLayerDao().getActiveLayersFifo(item.product.id)
                for (layer in productLayers) {
                    if (neededQty <= 0) break

                    val qtyToTake = minOf(layer.quantityRemaining, neededQty)
                    val updatedLayer = layer.copy(quantityRemaining = layer.quantityRemaining - qtyToTake)
                    layersToUpdate.add(updatedLayer)

                    lineHpp += (qtyToTake * layer.unitCost)
                    neededQty -= qtyToTake
                }

                if (neededQty > 0) {
                    throw IllegalStateException("Stok tidak cukup saat konsumsi FIFO")
                }

                val lineSubtotal = (item.qty * item.unitPrice)
                val linePpn = if (request.applyPpn) (lineSubtotal * 0.11).roundToLong() else 0L

                subtotalOverall += lineSubtotal
                ppnOverall += linePpn
                hppOverall += lineHpp

                saleLines.add(
                    SaleLineEntity(
                        id = "\$saleId-\${index + 1}",
                        saleId = saleId,
                        productId = item.product.id,
                        qty = item.qty,
                        unitPrice = item.unitPrice,
                        hppLine = lineHpp
                    )
                )
            }

            val grandTotal = subtotalOverall + ppnOverall
            if (request.cashPaid < grandTotal) {
                return@withTransaction CashSaleResult.Error("Nominal tunai kurang")
            }

            val committedSale = SaleEntity(
                id = saleId,
                clientSaleKey = request.clientSaleKey,
                customerId = null,
                status = SaleStatus.COMMITTED,
                subtotal = subtotalOverall,
                ppnAmount = ppnOverall,
                grandTotal = grandTotal,
                cashPaid = request.cashPaid,
                changeAmount = request.cashPaid - grandTotal,
                cashierName = request.currentUser.name,
                businessDate = request.businessDate
            )

            // §7. MEMBANGUN JOURNAL (DOUBLE-ENTRY)
            val journal = JournalEntity(
                id = journalId,
                refType = "SALE",
                refId = saleId,
                businessDate = request.businessDate
            )

            val journalLines = mutableListOf<JournalLineEntity>()
            // Dr 1110 KAS = grandTotal
            journalLines.add(JournalLineEntity("\$journalId-1", journalId, "1110", JournalSide.DEBIT, grandTotal))
            // Dr 5110 HPP = hppOverall
            journalLines.add(JournalLineEntity("\$journalId-2", journalId, "5110", JournalSide.DEBIT, hppOverall))
            // Cr 4110 PENJUALAN = subtotalOverall
            journalLines.add(JournalLineEntity("\$journalId-3", journalId, "4110", JournalSide.CREDIT, subtotalOverall))
            // Cr 2210 PPN_KELUARAN (jika ada)
            if (request.applyPpn && ppnOverall > 0) {
                journalLines.add(JournalLineEntity("\$journalId-4", journalId, "2210", JournalSide.CREDIT, ppnOverall))
            }
            // Cr 1310 PERSEDIAAN = hppOverall
            journalLines.add(JournalLineEntity("\$journalId-5", journalId, "1310", JournalSide.CREDIT, hppOverall))

            // VERIFIKASI WAJIB DOUBLE-ENTRY BALANCE
            val totalDebit = journalLines.filter { it.side == JournalSide.DEBIT }.sumOf { it.amount }
            val totalCredit = journalLines.filter { it.side == JournalSide.CREDIT }.sumOf { it.amount }
            if (totalDebit != totalCredit) {
                throw IllegalStateException("Jurnal tidak balance! Debit=\$totalDebit, Credit=\$totalCredit")
            }

            // SIMPAN ATOMIK KE ROOM
            for (layer in layersToUpdate) {
                db.inventoryLayerDao().update(layer)
            }
            db.saleDao().insertSale(committedSale)
            db.saleDao().insertSaleLines(saleLines)
            db.journalDao().insertJournal(journal)
            db.journalDao().insertJournalLines(journalLines)

            CashSaleResult.Success(committedSale, journal)
        }
    }
}
`
  },
  {
    filename: 'PurchaseFlowUseCase.kt',
    path: 'app/src/main/java/com/omahsembako/erp/domain/usecase/PurchaseFlowUseCase.kt',
    description: 'Use case alur Beli: PO Draft -> Approve (SoD) -> Terima Barang (InventoryLayer FIFO & Jurnal Seimbang)',
    code: `package com.omahsembako.erp.domain.usecase

import androidx.room.withTransaction
import com.omahsembako.erp.data.local.AppDatabase
import com.omahsembako.erp.data.local.entity.*
import java.time.Instant
import java.util.UUID

class PurchaseFlowUseCase(private val db: AppDatabase) {

    /**
     * SoD Check: Hanya OWNER atau ADMIN yang berhak menyetujui PO.
     * Role GUDANG tidak boleh approve.
     */
    suspend fun approvePurchase(purchaseId: String, approverName: String, role: UserRole): Result<PurchaseEntity> {
        if (role != UserRole.OWNER && role != UserRole.ADMIN) {
            return Result.failure(IllegalStateException("SoD Violation: Hanya OWNER atau ADMIN yang dapat menyetujui PO"))
        }

        return db.withTransaction {
            val po = db.purchaseDao().getPurchaseById(purchaseId) 
                ?: return@withTransaction Result.failure(IllegalArgumentException("PO \$purchaseId tidak ditemukan"))
            
            if (po.status != PurchaseStatus.DRAFT) {
                return@withTransaction Result.failure(IllegalStateException("Hanya PO berstatus DRAFT yang dapat disetujui"))
            }

            val approved = po.copy(
                status = PurchaseStatus.APPROVED,
                approvedBy = approverName
            )
            db.purchaseDao().updatePurchase(approved)
            Result.success(approved)
        }
    }

    /**
     * Penerimaan Barang (Goods Receipt):
     * 1. Validasi qty <= sisa pesanan
     * 2. Buat InventoryLayer baru dengan unitCost = poPrice (locked)
     * 3. Update qtyReceivedCumulative pada PurchaseLine
     * 4. Update status PO: RECEIVING (jika parsial) atau RECEIVED (jika lengkap)
     * 5. Buat PurchaseReceipt record
     * 6. Jurnal Akuntansi Double-Entry:
     *    Dr 1310 PERSEDIAAN = grandTotalPortion
     *    Cr 1110 KAS (Cash) / Cr 2110 HUTANG_USAHA (Credit) = grandTotalPortion
     * 7. Jika Credit: tambah Supplier.apBalance
     */
    suspend fun receiveGoods(
        purchaseId: String,
        receivedBy: String,
        businessDate: String,
        notes: String?,
        receivedItems: Map<String, Int> // lineId -> qtyReceivedNow
    ): Result<GoodsReceiptResult> {
        return db.withTransaction {
            val po = db.purchaseDao().getPurchaseById(purchaseId)
                ?: return@withTransaction Result.failure(IllegalArgumentException("PO \$purchaseId tidak ditemukan"))

            if (po.status != PurchaseStatus.APPROVED && po.status != PurchaseStatus.RECEIVING) {
                return@withTransaction Result.failure(IllegalStateException("Barang hanya dapat diterima jika PO berstatus APPROVED atau RECEIVING"))
            }

            val lines = db.purchaseDao().getLinesForPurchase(purchaseId)
            var grandTotalPortion = 0L
            val createdLayers = mutableListOf<InventoryLayerEntity>()
            val nowStr = Instant.now().toString()
            val receiptId = "RC-" + System.currentTimeMillis().toString().takeLast(8)

            for (line in lines) {
                val qtyToReceive = receivedItems[line.id] ?: 0
                if (qtyToReceive <= 0) continue

                val remaining = line.qtyOrdered - line.qtyReceivedCumulative
                if (qtyToReceive > remaining) {
                    return@withTransaction Result.failure(IllegalArgumentException("Qty diterima (\$qtyToReceive) melebihi sisa pesanan (\$remaining)"))
                }

                // Update cumulative line
                val updatedLine = line.copy(qtyReceivedCumulative = line.qtyReceivedCumulative + qtyToReceive)
                db.purchaseDao().updatePurchaseLine(updatedLine)

                val linePortion = qtyToReceive * line.poPrice
                grandTotalPortion += linePortion

                // Buat batch FIFO InventoryLayer baru
                val layerId = "INV-" + UUID.randomUUID().toString().take(8).uppercase()
                val layer = InventoryLayerEntity(
                    id = layerId,
                    productId = line.productId,
                    quantityRemaining = qtyToReceive,
                    unitCost = line.poPrice,
                    receivedAt = nowStr,
                    receiptRef = receiptId
                )
                createdLayers.add(layer)
                db.inventoryLayerDao().insert(layer)
            }

            if (createdLayers.isEmpty()) {
                return@withTransaction Result.failure(IllegalArgumentException("Tidak ada item yang diterima (> 0)"))
            }

            // Cek kelengkapan PO
            val freshLines = db.purchaseDao().getLinesForPurchase(purchaseId)
            val isAllReceived = freshLines.all { it.qtyReceivedCumulative >= it.qtyOrdered }
            val newStatus = if (isAllReceived) PurchaseStatus.RECEIVED else PurchaseStatus.RECEIVING

            val updatedPo = po.copy(status = newStatus)
            db.purchaseDao().updatePurchase(updatedPo)

            // Catat Bukti Tanda Terima (Receipt)
            val receipt = PurchaseReceiptEntity(
                id = receiptId,
                purchaseId = purchaseId,
                receivedAt = nowStr,
                businessDate = businessDate,
                receivedBy = receivedBy,
                notes = notes
            )
            db.purchaseReceiptDao().insert(receipt)

            // JURNAL DOUBLE-ENTRY AKUNTANSI
            val journalId = "JRN-" + System.currentTimeMillis().toString().takeLast(8)
            val journal = JournalEntity(
                id = journalId,
                refType = "PURCHASE",
                refId = purchaseId,
                businessDate = businessDate
            )
            val creditAccount = if (po.paymentMethod == PurchasePaymentMethod.CASH) "1110" else "2110"
            val journalLines = listOf(
                JournalLineEntity("\$journalId-1", journalId, "1310", JournalSide.DEBIT, grandTotalPortion),
                JournalLineEntity("\$journalId-2", journalId, creditAccount, JournalSide.CREDIT, grandTotalPortion)
            )

            db.journalDao().insertJournal(journal)
            db.journalDao().insertJournalLines(journalLines)

            // Jika Kredit, tambah saldo hutang usaha supplier
            if (po.paymentMethod == PurchasePaymentMethod.CREDIT) {
                val supplier = db.supplierDao().getSupplierById(po.supplierId)
                if (supplier != null) {
                    val updatedSup = supplier.copy(apBalance = supplier.apBalance + grandTotalPortion)
                    db.supplierDao().updateSupplier(updatedSup)
                }
            }

            Result.success(GoodsReceiptResult(receipt, createdLayers, journal, journalLines, grandTotalPortion, newStatus))
        }
    }
}

data class GoodsReceiptResult(
    val receipt: PurchaseReceiptEntity,
    val createdLayers: List<InventoryLayerEntity>,
    val journal: JournalEntity,
    val journalLines: List<JournalLineEntity>,
    val grandTotalPortion: Long,
    val newStatus: PurchaseStatus
)
`
  }
];

