import React, { useState } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { KOTLIN_FILES } from '../../kotlin_source/kotlinCodeFiles';
import { 
  Database, 
  Table, 
  Code, 
  RotateCcw, 
  X, 
  Check, 
  Copy, 
  FileCode, 
  Sparkles,
  Search
} from 'lucide-react';

interface DatabaseInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TableName = 
  | 'stores'
  | 'users'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'inventory_layers'
  | 'purchases'
  | 'purchase_lines'
  | 'purchase_receipts'
  | 'purchase_returns'
  | 'sales'
  | 'sale_lines'
  | 'sale_returns'
  | 'journals'
  | 'journal_lines'
  | 'accounts'
  | 'cash_sessions';

export const DatabaseInspectorModal: React.FC<DatabaseInspectorModalProps> = ({
  isOpen,
  onClose
}) => {
  const { 
    db, 
    store, 
    users, 
    products, 
    customers, 
    suppliers, 
    inventoryLayers, 
    purchases,
    purchaseLines,
    purchaseReceipts,
    purchaseReturns,
    sales, 
    saleLines, 
    saleReturns,
    journals, 
    journalLines, 
    accounts 
  } = useAppDatabase();

  const [activeTab, setActiveTab] = useState<'inspector' | 'kotlin'>('inspector');
  const [selectedTable, setSelectedTable] = useState<TableName>('accounts');
  const [selectedKotlinIndex, setSelectedKotlinIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  const tables: { id: TableName; label: string; count: number; description: string }[] = [
    { id: 'accounts', label: 'accounts', count: accounts.length, description: '8 Akun Standar (§6 Chart of Accounts)' },
    { id: 'stores', label: 'stores', count: 1, description: 'Toko Tunggal (Single store)' },
    { id: 'users', label: 'users', count: users.length, description: 'Pengguna & 5 Role (RBAC)' },
    { id: 'products', label: 'products', count: products.length, description: 'Daftar Produk Sembako' },
    { id: 'customers', label: 'customers', count: customers.length, description: 'Pelanggan & Piutang (AR)' },
    { id: 'suppliers', label: 'suppliers', count: suppliers.length, description: 'Pemasok & Hutang (AP)' },
    { id: 'purchases', label: 'purchases', count: purchases.length, description: 'Header Purchase Order (Prompt 3)' },
    { id: 'purchase_lines', label: 'purchase_lines', count: purchaseLines.length, description: 'Baris Item Pemesanan PO (Prompt 3)' },
    { id: 'purchase_receipts', label: 'purchase_receipts', count: purchaseReceipts.length, description: 'Bukti Penerimaan Barang (Goods Receipt)' },
    { id: 'purchase_returns', label: 'purchase_returns', count: purchaseReturns.length, description: 'Retur Pembelian ke Supplier (Prompt 5)' },
    { id: 'inventory_layers', label: 'inventory_layers', count: inventoryLayers.length, description: 'Batch Persediaan FIFO' },
    { id: 'sales', label: 'sales', count: sales.length, description: 'Header Penjualan (Prompt 2)' },
    { id: 'sale_lines', label: 'sale_lines', count: saleLines.length, description: 'Baris Item Penjualan (Prompt 2)' },
    { id: 'sale_returns', label: 'sale_returns', count: saleReturns.length, description: 'Retur Penjualan Pelanggan (Prompt 5)' },
    { id: 'cash_sessions', label: 'cash_sessions', count: db.getAllCashSessions().length, description: 'Sesi Kasir & Rekonsiliasi (Prompt 8)' },
    { id: 'journals', label: 'journals', count: journals.length, description: 'Header Jurnal Akuntansi' },
    { id: 'journal_lines', label: 'journal_lines', count: journalLines.length, description: 'Baris Debit/Kredit Double-Entry' },
  ];

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetSeed = () => {
    if (window.confirm('Reset database ke data awal (Seed 8 Akun & Sembako)?')) {
      db.resetToSeed();
    }
  };

  // Render dynamic table rows
  const renderTableData = () => {
    switch (selectedTable) {
      case 'accounts':
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">code (PK)</th>
                <th className="p-2.5">name</th>
                <th className="p-2.5">type</th>
                <th className="p-2.5">Status Seed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {accounts.map(acc => (
                <tr key={acc.code} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-emerald-800">{acc.code}</td>
                  <td className="p-2.5 text-slate-800">{acc.name}</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
                      {acc.type}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-500 text-[10px]">§6 Seed Auto-Populated ✓</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'stores':
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              <tr className="hover:bg-slate-50/80">
                <td className="p-2.5 font-bold text-emerald-800">{store.id}</td>
                <td className="p-2.5 text-slate-800">{store.name}</td>
              </tr>
            </tbody>
          </table>
        );

      case 'users':
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">name</th>
                <th className="p-2.5">role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-emerald-800">{u.id}</td>
                  <td className="p-2.5 text-slate-800">{u.name}</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'products':
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">name</th>
                <th className="p-2.5">unit</th>
                <th className="p-2.5">sellPrice (Long)</th>
                <th className="p-2.5">itemType</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-emerald-800">{p.id}</td>
                  <td className="p-2.5 font-sans font-medium text-slate-900">{p.name}</td>
                  <td className="p-2.5 text-slate-600">{p.unit}</td>
                  <td className="p-2.5 font-bold text-slate-800">{formatRupiah(p.sellPrice)}</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                      {p.itemType}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'inventory_layers':
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">productId (FK)</th>
                <th className="p-2.5">quantityRemaining</th>
                <th className="p-2.5">unitCost (Long HPP)</th>
                <th className="p-2.5">receivedAt (FIFO order)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {inventoryLayers.map(l => (
                <tr key={l.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-emerald-800">{l.id}</td>
                  <td className="p-2.5 text-slate-700">{l.productId}</td>
                  <td className="p-2.5 font-bold text-blue-700">{l.quantityRemaining}</td>
                  <td className="p-2.5 text-slate-800">{formatRupiah(l.unitCost)}</td>
                  <td className="p-2.5 text-slate-500 text-[11px]">{formatDateIndo(l.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'customers':
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">name</th>
                <th className="p-2.5">phone</th>
                <th className="p-2.5">arBalance (Piutang)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-emerald-800">{c.id}</td>
                  <td className="p-2.5 font-sans font-medium text-slate-900">{c.name}</td>
                  <td className="p-2.5 text-slate-600">{c.phone}</td>
                  <td className="p-2.5 font-bold text-slate-800">{formatRupiah(c.arBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'suppliers':
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">name</th>
                <th className="p-2.5">phone</th>
                <th className="p-2.5">apBalance (Hutang)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-emerald-800">{s.id}</td>
                  <td className="p-2.5 font-sans font-medium text-slate-900">{s.name}</td>
                  <td className="p-2.5 text-slate-600">{s.phone}</td>
                  <td className="p-2.5 font-bold text-amber-800">{formatRupiah(s.apBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'sales':
        if (sales.length === 0) {
          return (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Table className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">Tabel `sales` Kosong (0 baris)</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Belum ada transaksi jual tunai. Lakukan penjualan di tab Kasir untuk melihat data ter-commit di sini.
              </p>
            </div>
          );
        }
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">status</th>
                <th className="p-2.5">subtotal</th>
                <th className="p-2.5">ppnAmount</th>
                <th className="p-2.5">grandTotal</th>
                <th className="p-2.5">cashPaid</th>
                <th className="p-2.5">change</th>
                <th className="p-2.5">cashier</th>
                <th className="p-2.5">clientSaleKey (§4 UUID)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {sales.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-emerald-800">{s.id}</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {s.status}
                    </span>
                  </td>
                  <td className="p-2.5 font-sans font-medium">{formatRupiah(s.subtotal)}</td>
                  <td className="p-2.5 font-sans text-slate-500">{formatRupiah(s.ppnAmount)}</td>
                  <td className="p-2.5 font-sans font-bold text-emerald-700">{formatRupiah(s.grandTotal)}</td>
                  <td className="p-2.5 font-sans text-slate-700">{formatRupiah(s.cashPaid)}</td>
                  <td className="p-2.5 font-sans text-slate-700">{formatRupiah(s.changeAmount)}</td>
                  <td className="p-2.5 font-sans text-slate-600">{s.cashierName}</td>
                  <td className="p-2.5 text-[10px] text-slate-400 truncate max-w-[120px]" title={s.clientSaleKey}>
                    {s.clientSaleKey}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'sale_lines':
        if (saleLines.length === 0) {
          return (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Table className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">Tabel `sale_lines` Kosong (0 baris)</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Baris item penjualan akan terisi otomatis saat transaksi kasir di-commit.
              </p>
            </div>
          );
        }
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">saleId (FK)</th>
                <th className="p-2.5">productId (FK)</th>
                <th className="p-2.5">qty</th>
                <th className="p-2.5">unitPrice</th>
                <th className="p-2.5">hppLine (FIFO Cost)</th>
                <th className="p-2.5">ppnLine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {saleLines.map(sl => (
                <tr key={sl.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-emerald-800">{sl.id}</td>
                  <td className="p-2.5 text-slate-600">{sl.saleId}</td>
                  <td className="p-2.5 text-slate-800">{sl.productId}</td>
                  <td className="p-2.5 font-bold text-blue-700">{sl.qty}</td>
                  <td className="p-2.5 font-sans">{formatRupiah(sl.unitPrice)}</td>
                  <td className="p-2.5 font-sans font-bold text-amber-800">{formatRupiah(sl.hppLine)}</td>
                  <td className="p-2.5 font-sans text-slate-500">{formatRupiah(sl.ppnLine || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'journals':
        if (journals.length === 0) {
          return (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Table className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">Tabel `journals` Kosong (0 baris)</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Header jurnal akuntansi umum akan ter-generate otomatis saat transaksi penjualan dikomit.
              </p>
            </div>
          );
        }
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">refType</th>
                <th className="p-2.5">refId</th>
                <th className="p-2.5">businessDate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {journals.map(j => (
                <tr key={j.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-purple-800">{j.id}</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                      {j.refType}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-700">{j.refId}</td>
                  <td className="p-2.5 text-slate-500">{j.businessDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'journal_lines':
        if (journalLines.length === 0) {
          return (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Table className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">Tabel `journal_lines` Kosong (0 baris)</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Baris debit & kredit akuntansi berpasangan (Double-Entry) akan muncul di sini setelah transaksi kasir.
              </p>
            </div>
          );
        }
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">journalId (FK)</th>
                <th className="p-2.5">accountCode (FK)</th>
                <th className="p-2.5">side</th>
                <th className="p-2.5">amount (Long Rupiah)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {journalLines.map(jl => (
                <tr key={jl.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-purple-800">{jl.id}</td>
                  <td className="p-2.5 text-slate-600">{jl.journalId}</td>
                  <td className="p-2.5 font-bold text-slate-900">{jl.accountCode}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      jl.side === 'DEBIT' 
                        ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {jl.side}
                    </span>
                  </td>
                  <td className="p-2.5 font-sans font-bold text-slate-800">
                    {formatRupiah(jl.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'purchases':
        if (purchases.length === 0) {
          return (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Table className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">Tabel `purchases` Kosong (0 baris)</p>
            </div>
          );
        }
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">supplierId (FK)</th>
                <th className="p-2.5">status</th>
                <th className="p-2.5">paymentMethod</th>
                <th className="p-2.5">businessDate</th>
                <th className="p-2.5 text-right">grandTotal</th>
                <th className="p-2.5">createdBy</th>
                <th className="p-2.5">approvedBy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {purchases.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-blue-700">{p.id}</td>
                  <td className="p-2.5 text-slate-700">{p.supplierId}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800' :
                      p.status === 'RECEIVING' ? 'bg-orange-100 text-orange-800' :
                      p.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-2.5 font-semibold text-slate-800">{p.paymentMethod}</td>
                  <td className="p-2.5 text-slate-600">{p.businessDate}</td>
                  <td className="p-2.5 text-right font-bold text-emerald-800 font-sans">
                    {formatRupiah(p.grandTotal)}
                  </td>
                  <td className="p-2.5 text-slate-600 text-[11px] font-sans">{p.createdBy}</td>
                  <td className="p-2.5 text-slate-600 text-[11px] font-sans">{p.approvedBy || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'purchase_lines':
        if (purchaseLines.length === 0) {
          return (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Table className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">Tabel `purchase_lines` Kosong (0 baris)</p>
            </div>
          );
        }
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">purchaseId (FK)</th>
                <th className="p-2.5">productId (FK)</th>
                <th className="p-2.5 text-center">qtyOrdered</th>
                <th className="p-2.5 text-center">qtyReceivedCumulative</th>
                <th className="p-2.5 text-right">poPrice (Modal FIFO)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {purchaseLines.map(pl => (
                <tr key={pl.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-slate-800">{pl.id}</td>
                  <td className="p-2.5 text-blue-700">{pl.purchaseId}</td>
                  <td className="p-2.5 text-slate-900 font-bold">{pl.productId}</td>
                  <td className="p-2.5 text-center font-bold text-slate-800">{pl.qtyOrdered}</td>
                  <td className="p-2.5 text-center font-bold text-emerald-700">{pl.qtyReceivedCumulative}</td>
                  <td className="p-2.5 text-right font-sans font-semibold text-slate-800">
                    {formatRupiah(pl.poPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'purchase_receipts':
        if (purchaseReceipts.length === 0) {
          return (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Table className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">Tabel `purchase_receipts` Kosong (0 baris)</p>
            </div>
          );
        }
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">purchaseId (FK)</th>
                <th className="p-2.5">businessDate</th>
                <th className="p-2.5">receivedAt</th>
                <th className="p-2.5">receivedBy</th>
                <th className="p-2.5">notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {purchaseReceipts.map(rc => (
                <tr key={rc.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-emerald-800">{rc.id}</td>
                  <td className="p-2.5 text-blue-700">{rc.purchaseId}</td>
                  <td className="p-2.5 text-slate-700">{rc.businessDate}</td>
                  <td className="p-2.5 text-slate-500 text-[11px]">{new Date(rc.receivedAt).toLocaleString('id-ID')}</td>
                  <td className="p-2.5 text-slate-800 font-sans font-semibold">{rc.receivedBy}</td>
                  <td className="p-2.5 text-slate-600 font-sans text-[11px]">{rc.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'sale_returns':
        if (saleReturns.length === 0) {
          return (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Table className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">Tabel `sale_returns` Kosong (0 baris)</p>
              <p className="text-[11px] text-slate-400">Belum ada retur penjualan yang dicatat.</p>
            </div>
          );
        }
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">saleId (FK)</th>
                <th className="p-2.5">totalRefund</th>
                <th className="p-2.5">journalId (FK)</th>
                <th className="p-2.5">reason</th>
                <th className="p-2.5">returnedBy</th>
                <th className="p-2.5">createdAt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {saleReturns.map(sr => (
                <tr key={sr.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-amber-900">{sr.id}</td>
                  <td className="p-2.5 text-blue-700">{sr.saleId}</td>
                  <td className="p-2.5 font-sans font-bold text-slate-900">{formatRupiah(sr.totalRefund)}</td>
                  <td className="p-2.5 text-purple-700">{sr.journalId}</td>
                  <td className="p-2.5 font-sans text-slate-600 text-[11px]">{sr.reason || '-'}</td>
                  <td className="p-2.5 font-sans text-slate-700 font-medium">{sr.returnedBy}</td>
                  <td className="p-2.5 text-slate-500 text-[11px]">{new Date(sr.createdAt).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'purchase_returns':
        if (purchaseReturns.length === 0) {
          return (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Table className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">Tabel `purchase_returns` Kosong (0 baris)</p>
              <p className="text-[11px] text-slate-400">Belum ada retur pembelian ke supplier yang dicatat.</p>
            </div>
          );
        }
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">purchaseId (FK)</th>
                <th className="p-2.5">totalAmount</th>
                <th className="p-2.5">journalId (FK)</th>
                <th className="p-2.5">reason</th>
                <th className="p-2.5">returnedBy</th>
                <th className="p-2.5">createdAt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {purchaseReturns.map(pr => (
                <tr key={pr.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-purple-900">{pr.id}</td>
                  <td className="p-2.5 text-blue-700">{pr.purchaseId}</td>
                  <td className="p-2.5 font-sans font-bold text-slate-900">{formatRupiah(pr.totalAmount)}</td>
                  <td className="p-2.5 text-purple-700">{pr.journalId}</td>
                  <td className="p-2.5 font-sans text-slate-600 text-[11px]">{pr.reason || '-'}</td>
                  <td className="p-2.5 font-sans text-slate-700 font-medium">{pr.returnedBy}</td>
                  <td className="p-2.5 text-slate-500 text-[11px]">{new Date(pr.createdAt).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'cash_sessions':
        const allCashSessions = db.getAllCashSessions();
        if (allCashSessions.length === 0) {
          return (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Table className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">Tabel `cash_sessions` Kosong (0 baris)</p>
              <p className="text-[11px] text-slate-400">Belum ada sesi kasir (shift) yang dibuka. Buka sesi di menu Kasir.</p>
            </div>
          );
        }
        return (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">id (PK)</th>
                <th className="p-2.5">userId (FK)</th>
                <th className="p-2.5">status</th>
                <th className="p-2.5">openingFloat</th>
                <th className="p-2.5">systemExpected</th>
                <th className="p-2.5">actualCash</th>
                <th className="p-2.5">variance</th>
                <th className="p-2.5">journalId (FK)</th>
                <th className="p-2.5">openedAt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {allCashSessions.map(cs => (
                <tr key={cs.id} className="hover:bg-slate-50/80">
                  <td className="p-2.5 font-bold text-emerald-800">{cs.id}</td>
                  <td className="p-2.5 text-slate-700">{cs.userId}</td>
                  <td className="p-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      cs.status === 'OPEN' 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}>
                      {cs.status}
                    </span>
                  </td>
                  <td className="p-2.5 font-sans font-bold text-slate-800">{formatRupiah(cs.openingFloat)}</td>
                  <td className="p-2.5 font-sans text-slate-700">{cs.systemExpectedCash !== undefined ? formatRupiah(cs.systemExpectedCash) : '-'}</td>
                  <td className="p-2.5 font-sans text-slate-700">{cs.actualCash !== undefined ? formatRupiah(cs.actualCash) : '-'}</td>
                  <td className="p-2.5 font-sans font-bold">
                    {cs.variance !== undefined ? (
                      <span className={cs.variance === 0 ? 'text-emerald-600' : cs.variance < 0 ? 'text-rose-600' : 'text-amber-600'}>
                        {cs.variance === 0 ? 'Rp 0' : `${cs.variance > 0 ? '+' : ''}${formatRupiah(cs.variance)}`}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-2.5 text-purple-700">{cs.journalId || '-'}</td>
                  <td className="p-2.5 text-slate-500 text-[11px]">{new Date(cs.openedAt).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[88vh] shadow-2xl flex flex-col overflow-hidden border border-slate-700/20 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Window Bar */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-tight">Android Studio Database Inspector</h3>
                <span className="text-[10px] font-mono bg-emerald-900 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-700">
                  SQLite Room DB • {tables.length} Tabel
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Database: omah_sembako_sehati.db • 100% Offline-First
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetSeed}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
              title="Reset ke Seed Data Awal"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Reset Seed</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Header Tabs: Live DB Tables vs Kotlin Code */}
        <div className="bg-slate-850 px-4 py-2 flex items-center justify-between border-b border-slate-800 text-xs bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('inspector')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'inspector'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Live Database Tables ({tables.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('kotlin')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'kotlin'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Native Android Kotlin Code</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 hidden md:block">
            {activeTab === 'inspector' 
              ? 'Inspeksi skema Room DAO & 8 akun seed' 
              : 'Kode sumber Kotlin/Compose siap build APK'}
          </span>
        </div>

        {/* Content Body */}
        {activeTab === 'inspector' ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Tables Sidebar */}
            <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 overflow-y-auto p-2.5 space-y-1 flex-shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 block">
                Tabel Room (§4 Spesifikasi)
              </span>
              {tables.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTable(t.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                    selectedTable === t.id
                      ? 'bg-white text-emerald-950 font-bold shadow-xs border border-emerald-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <span className="font-mono block truncate">{t.label}</span>
                    <span className="text-[10px] font-normal text-slate-400 block truncate">{t.description}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    t.count > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Table Viewer Pane */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              {/* Table Info Bar */}
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-300">
                    TABLE: {selectedTable}
                  </span>
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    {tables.find(t => t.id === selectedTable)?.description}
                  </span>
                </div>

                <span className="text-xs font-semibold text-emerald-700">
                  {tables.find(t => t.id === selectedTable)?.count} baris tercatat
                </span>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-auto">
                {renderTableData()}
              </div>
            </div>
          </div>
        ) : (
          /* Kotlin Code Files Viewer */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-950 text-slate-100 font-mono text-xs">
            {/* Kotlin Files List */}
            <div className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-2.5 space-y-1 overflow-y-auto flex-shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 block">
                File Sumber Android
              </span>
              {KOTLIN_FILES.map((file, idx) => (
                <button
                  key={file.filename}
                  onClick={() => setSelectedKotlinIndex(idx)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition ${
                    selectedKotlinIndex === idx
                      ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
                      : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                  }`}
                >
                  <span className="block">{file.filename}</span>
                  <span className="text-[10px] font-normal text-slate-500 block truncate">
                    {file.description}
                  </span>
                </button>
              ))}
            </div>

            {/* Code Display Pane */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                <span className="text-slate-400 text-[11px] truncate">
                  {KOTLIN_FILES[selectedKotlinIndex].path}
                </span>
                <button
                  onClick={() => handleCopyCode(KOTLIN_FILES[selectedKotlinIndex].code)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Kode'}</span>
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 text-[11px] leading-relaxed select-text">
                <pre className="text-emerald-300">
                  <code>{KOTLIN_FILES[selectedKotlinIndex].code}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Room Database Engine: Ready for Prompt 2 (01_CASH_SALE)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition"
          >
            Tutup Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
