import React, { useState } from 'react';
import { useAppDatabase } from '../database/useAppDatabase';
import { formatRupiah } from '../utils/formatters';
import { 
  Truck, 
  Phone, 
  Plus, 
  ShoppingBag, 
  Clock, 
  Building2, 
  CheckCircle2,
  FileText,
  Search,
  Filter,
  PackageCheck,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Layers,
  Database,
  RotateCcw,
  Edit,
  Trash2,
  Mail,
  MapPin,
  MessageCircle,
  User as UserIcon,
  ExternalLink
} from 'lucide-react';
import { Supplier, Purchase, PurchaseLine, InventoryLayer, PurchaseReceipt, Journal, JournalLine } from '../types/erp';
import { CreatePurchaseModal } from '../components/beli/CreatePurchaseModal';
import { PurchaseDetailModal } from '../components/beli/PurchaseDetailModal';
import { ReceiveGoodsModal } from '../components/beli/ReceiveGoodsModal';
import { ReceiveReceiptAuditModal } from '../components/beli/ReceiveReceiptAuditModal';
import { ReturnPurchaseModal } from '../components/beli/ReturnPurchaseModal';
import { SupplierFormModal } from '../components/beli/SupplierFormModal';
import { SupplierHistoryModal } from '../components/beli/SupplierHistoryModal';
import { hasPermission } from '../rbac/permissions';

interface BeliScreenProps {
  onOpenInspector?: () => void;
}

export const BeliScreen: React.FC<BeliScreenProps> = ({ onOpenInspector }) => {
  const { suppliers, purchases, products, currentUser, db } = useAppDatabase();

  const [activeSubTab, setActiveSubTab] = useState<'po' | 'supplier' | 'receipts'>('po');
  const [poStatusFilter, setPoStatusFilter] = useState<'ALL' | 'DRAFT' | 'APPROVED' | 'RECEIVING' | 'RECEIVED' | 'RETURNED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Supplier Module State
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<'ALL' | 'ACTIVE' | 'HAS_AP'>('ALL');
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [showSupplierFormModal, setShowSupplierFormModal] = useState(false);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Supplier | null>(null);
  const [reorderSupplierId, setReorderSupplierId] = useState<string | undefined>(undefined);
  const [reorderLines, setReorderLines] = useState<Array<{ productId: string; qtyOrdered: number; poPrice: number }> | undefined>(undefined);

  const [showCreatePOModal, setShowCreatePOModal] = useState(false);

  // Detail Modal State
  const [selectedPO, setSelectedPO] = useState<Purchase | null>(null);

  // Return Modal State (Prompt 5)
  const [returnTargetPO, setReturnTargetPO] = useState<Purchase | null>(null);

  // Receive Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveTargetPO, setReceiveTargetPO] = useState<{
    purchase: Purchase;
    lines: PurchaseLine[];
  } | null>(null);

  // Audit Modal State
  const [auditData, setAuditData] = useState<{
    isOpen: boolean;
    receipt: PurchaseReceipt | null;
    purchase: Purchase | null;
    createdLayers: InventoryLayer[];
    journal: Journal | null;
    journalLines: JournalLine[];
    grandTotalPortion: number;
    newStatus: string;
  }>({
    isOpen: false,
    receipt: null,
    purchase: null,
    createdLayers: [],
    journal: null,
    journalLines: [],
    grandTotalPortion: 0,
    newStatus: ''
  });

  const handleDeleteSupplier = (supplier: Supplier) => {
    if (supplier.apBalance > 0) {
      alert(`Supplier ${supplier.name} masih memiliki saldo hutang aktif sebesar ${formatRupiah(supplier.apBalance)}. Lunasi hutang terlebih dahulu.`);
      return;
    }
    const hasActivePo = purchases.some(p => p.supplierId === supplier.id && ['APPROVED', 'RECEIVING'].includes(p.status));
    if (hasActivePo) {
      alert(`Supplier ${supplier.name} masih memiliki PO aktif yang sedang berjalan.`);
      return;
    }
    if (window.confirm(`Hapus kontak supplier "${supplier.name}" (${supplier.id})?`)) {
      db.deleteSupplier(supplier.id);
    }
  };

  const handleOpenRepeatOrder = (supplierId: string, items?: Array<{ productId: string; qtyOrdered: number; poPrice: number }>) => {
    setReorderSupplierId(supplierId);
    setReorderLines(items);
    setShowCreatePOModal(true);
  };

  // Open Receive Goods Dialog
  const handleOpenReceive = (purchase: Purchase, lines: PurchaseLine[]) => {
    setSelectedPO(null); // Close detail modal first if open
    setReceiveTargetPO({ purchase, lines });
    setIsReceiveModalOpen(true);
  };

  // On Goods Received Success
  const handleReceiveSuccess = (data: {
    receipt: PurchaseReceipt;
    createdLayers: InventoryLayer[];
    journal: Journal;
    journalLines: JournalLine[];
    grandTotalPortion: number;
    newStatus: string;
  }) => {
    setIsReceiveModalOpen(false);
    const updatedPurchase = db.getPurchaseById(data.receipt.purchaseId);
    setAuditData({
      isOpen: true,
      receipt: data.receipt,
      purchase: updatedPurchase || receiveTargetPO?.purchase || null,
      createdLayers: data.createdLayers,
      journal: data.journal,
      journalLines: data.journalLines,
      grandTotalPortion: data.grandTotalPortion,
      newStatus: data.newStatus
    });
    setReceiveTargetPO(null);
  };

  // Filtered Suppliers
  const filteredSuppliers = suppliers.filter(s => {
    if (supplierFilter === 'ACTIVE' && s.isActive === false) return false;
    if (supplierFilter === 'HAS_AP' && (s.apBalance || 0) <= 0) return false;
    if (!supplierSearchQuery.trim()) return true;
    const q = supplierSearchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q)) ||
      s.id.toLowerCase().includes(q)
    );
  });

  // Filtered POs
  const filteredPOs = purchases.filter(po => {
    if (poStatusFilter !== 'ALL' && po.status !== poStatusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const sup = suppliers.find(s => s.id === po.supplierId);
      const matchesId = po.id.toLowerCase().includes(q);
      const matchesSup = sup ? sup.name.toLowerCase().includes(q) : false;
      return matchesId || matchesSup;
    }
    return true;
  });

  const allReceipts = db.getPurchaseReceipts();
  const totalHutangUsaha = suppliers.reduce((sum, s) => sum + s.apBalance, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            DRAFT
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
            APPROVED
          </span>
        );
      case 'RECEIVING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-300">
            RECEIVING
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            RECEIVED
          </span>
        );
      case 'RETURNED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
            <RotateCcw className="w-2.5 h-2.5" />
            <span>RETURNED</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-5 space-y-4 pb-14">
      {/* Screen Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            <span>Pengadaan & Pembelian (PO)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Purchase Order → Persetujuan SoD → Terima Barang (FIFO Layer & Jurnal Seimbang)
          </p>
        </div>

        {/* Action Button */}
        {hasPermission(currentUser.role, 'PO_CREATE') && (
          <button
            onClick={() => setShowCreatePOModal(true)}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Buat PO Baru</span>
          </button>
        )}
      </div>

      {/* Sub-Tabs: PO, Supplier, Receipts */}
      <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1 text-xs">
        <button
          onClick={() => setActiveSubTab('po')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition ${
            activeSubTab === 'po'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Purchase Orders ({purchases.length})
        </button>
        <button
          onClick={() => setActiveSubTab('supplier')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition ${
            activeSubTab === 'supplier'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Supplier & Hutang ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveSubTab('receipts')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition ${
            activeSubTab === 'receipts'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Riwayat Terima ({allReceipts.length})
        </button>
      </div>

      {/* ======================================================== */}
      {/* SUB-TAB 1: PURCHASE ORDERS LIST                          */}
      {/* ======================================================== */}
      {activeSubTab === 'po' && (
        <div className="space-y-3">
          {/* Search and Status Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nomor PO atau nama supplier..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
              {(['ALL', 'DRAFT', 'APPROVED', 'RECEIVING', 'RECEIVED', 'RETURNED'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setPoStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap text-[11px] transition ${
                    poStatusFilter === st
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {st === 'ALL' ? 'Semua' : st}
                </button>
              ))}
            </div>
          </div>

          {/* List of PO Cards */}
          {filteredPOs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 space-y-2">
              <FileText className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-700">Tidak ada Purchase Order</p>
              <p className="text-[11px] text-slate-400">
                {searchQuery || poStatusFilter !== 'ALL'
                  ? 'Tidak ada PO yang cocok dengan filter pencarian.'
                  : 'Klik tombol "+ Buat PO Baru" di atas untuk membuat pesanan ke supplier.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredPOs.map(po => {
                const sup = suppliers.find(s => s.id === po.supplierId);
                const lines = db.getPurchaseLines(po.id);
                const totalOrdered = lines.reduce((sum, l) => sum + l.qtyOrdered, 0);
                const totalReceived = lines.reduce((sum, l) => sum + l.qtyReceivedCumulative, 0);

                return (
                  <div
                    key={po.id}
                    className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs hover:border-blue-300 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{po.id}</span>
                        {getStatusBadge(po.status)}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                          {po.paymentMethod}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">{po.businessDate}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{sup?.name || po.supplierId}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {lines.length} jenis barang • Progress: <strong className="text-slate-700">{totalReceived}/{totalOrdered} unit</strong> ({Math.round(totalOrdered > 0 ? (totalReceived/totalOrdered)*100 : 0)}%)
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 block">Total Nilai PO</span>
                        <span className="text-xs font-bold text-emerald-700 font-mono">
                          {formatRupiah(po.grandTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar per Card */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        Dibuat: {po.createdBy}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {/* Quick Receive Button if APPROVED or RECEIVING */}
                        {(po.status === 'APPROVED' || po.status === 'RECEIVING') && (
                          <button
                            onClick={() => handleOpenReceive(po, lines)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 transition"
                          >
                            <Truck className="w-3 h-3 text-emerald-600" />
                            <span>Terima</span>
                          </button>
                        )}

                        {/* Quick Return Button if RECEIVED and user has PURCHASE_RETURN permission */}
                        {po.status === 'RECEIVED' && hasPermission(currentUser.role, 'PURCHASE_RETURN') && (
                          <button
                            type="button"
                            onClick={() => setReturnTargetPO(po)}
                            className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-bold flex items-center gap-1 transition"
                            title="Retur Barang ke Supplier"
                          >
                            <RotateCcw className="w-3 h-3 text-purple-700" />
                            <span>Retur</span>
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedPO(po)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold flex items-center gap-1 transition"
                        >
                          <span>Buka Detail</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 2: MODUL DATA SUPPLIER & PEMESANAN ULANG         */}
      {/* ======================================================== */}
      {activeSubTab === 'supplier' && (
        <div className="space-y-3.5">
          {/* Summary & Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Modul Data Supplier & Pemesanan Ulang</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola kontak, rekening supplier, histori belanja, dan kemudahan pemesanan ulang (re-order)
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500 block text-[10px]">Total Hutang Usaha (AP 2110):</span>
                <span className="font-bold font-mono text-amber-700">{formatRupiah(totalHutangUsaha)}</span>
              </div>
              <button
                onClick={() => {
                  setSupplierToEdit(null);
                  setShowSupplierFormModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Supplier Baru</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama, telp, PIC, kota supplier..."
                value={supplierSearchQuery}
                onChange={e => setSupplierSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSupplierFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  supplierFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Semua ({suppliers.length})
              </button>
              <button
                onClick={() => setSupplierFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  supplierFilter === 'ACTIVE'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Aktif ({suppliers.filter(s => s.isActive !== false).length})
              </button>
              <button
                onClick={() => setSupplierFilter('HAS_AP')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  supplierFilter === 'HAS_AP'
                    ? 'bg-amber-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Ada Hutang AP ({suppliers.filter(s => s.apBalance > 0).length})
              </button>
            </div>
          </div>

          {/* Supplier Cards List */}
          {filteredSuppliers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 space-y-2">
              <Building2 className="w-10 h-10 mx-auto opacity-30 text-slate-500" />
              <p className="font-semibold text-sm text-slate-700">Tidak ada data supplier yang cocok</p>
              <p className="text-xs">Ubah kata kunci pencarian atau klik 'Tambah Supplier Baru' di atas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSuppliers.map(supplier => {
                const supplierPOs = purchases.filter(p => p.supplierId === supplier.id);
                const totalPoAmount = supplierPOs.reduce((sum, p) => sum + (p.grandTotal || 0), 0);
                const cleanPhone = (supplier.phone || '').replace(/[^0-9]/g, '');
                const waUrl = cleanPhone.startsWith('0') 
                  ? `https://wa.me/62${cleanPhone.slice(1)}` 
                  : cleanPhone.startsWith('62') 
                  ? `https://wa.me/${cleanPhone}` 
                  : null;

                return (
                  <div
                    key={supplier.id}
                    className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-3.5"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {supplier.id}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            supplier.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {supplier.isActive !== false ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">{supplier.name}</h4>
                        {supplier.contactPerson && (
                          <p className="text-xs text-slate-600 flex items-center gap-1">
                            <UserIcon className="w-3 h-3 text-slate-400" />
                            <span>PIC: <strong>{supplier.contactPerson}</strong></span>
                          </p>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] text-slate-400 block">Saldo Hutang (AP)</span>
                        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg ${
                          supplier.apBalance > 0 ? 'bg-amber-100 text-amber-900 font-extrabold' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {formatRupiah(supplier.apBalance)}
                        </span>
                      </div>
                    </div>

                    {/* Contacts & Bank Info Details */}
                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-mono font-semibold text-slate-800">{supplier.phone}</span>
                        </div>
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[10px] transition"
                            title="Chat WhatsApp Langsung"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-700" />
                            <span>Chat WA</span>
                          </a>
                        )}
                      </div>

                      {supplier.email && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{supplier.email}</span>
                        </div>
                      )}

                      {(supplier.address || supplier.city) && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{[supplier.address, supplier.city].filter(Boolean).join(', ')}</span>
                        </div>
                      )}

                      {supplier.bankAccountNo && (
                        <div className="flex items-center gap-1.5 text-slate-700 pt-1 border-t border-slate-200/60">
                          <CreditCard className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                          <span>{supplier.bankName || 'Bank'} <strong className="font-mono">{supplier.bankAccountNo}</strong> {supplier.bankAccountName ? `a.n ${supplier.bankAccountName}` : ''}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                        <span>Tempo: <strong>{supplier.paymentTermsDays ? `${supplier.paymentTermsDays} Hari` : 'Tunai / COD'}</strong></span>
                        <span>Histori: <strong>{supplierPOs.length} PO</strong> ({formatRupiah(totalPoAmount)})</span>
                      </div>
                    </div>

                    {/* Card Actions: Pesan Ulang, Histori, Edit, Hapus */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSupplierToEdit(supplier);
                            setShowSupplierFormModal(true);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                          title="Edit Kontak & Info Supplier"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(supplier)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          title="Hapus Supplier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedSupplierForHistory(supplier)}
                          className="px-2.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-800 font-bold text-xs flex items-center gap-1 transition"
                          title="Lihat histori pembelian dan katalog barang"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Histori</span>
                        </button>

                        <button
                          onClick={() => handleOpenRepeatOrder(supplier.id)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition"
                          title="Pesan ulang dengan supplier ini (buka PO)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Pesan Ulang</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 3: RIWAYAT PENERIMAAN BARANG (RECEIPTS)          */}
      {/* ======================================================== */}
      {activeSubTab === 'receipts' && (
        <div className="space-y-3">
          {allReceipts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 space-y-2">
              <Truck className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-700">Belum Ada Riwayat Penerimaan</p>
              <p className="text-[11px] text-slate-400">
                Penerimaan barang dari PO yang disetujui akan tercatat otomatis di sini.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {allReceipts.map(rc => {
                const po = purchases.find(p => p.id === rc.purchaseId);
                const sup = po ? suppliers.find(s => s.id === po.supplierId) : null;
                const totalItems = rc.itemsReceived?.reduce((s, i) => s + i.qtyReceived, 0) || 0;

                return (
                  <div
                    key={rc.id}
                    className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-800">{rc.id}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                          PO: {rc.purchaseId}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(rc.receivedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-slate-800">
                        Supplier: <span className="text-slate-900">{sup?.name || 'Supplier'}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Diterima oleh: <strong className="text-slate-700">{rc.receivedBy}</strong>
                        {rc.notes && ` • ${rc.notes}`}
                      </p>
                    </div>

                    {rc.itemsReceived && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[11px]">
                        {rc.itemsReceived.map((item, idx) => {
                          const prod = products.find(p => p.id === item.productId);
                          return (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-medium"
                            >
                              +{item.qtyReceived} {prod?.unit || 'unit'} {prod?.name} (@{formatRupiah(item.poPrice)})
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS                                                   */}
      {/* ======================================================== */}

      {/* 1. Modal Form Tambah / Edit Supplier */}
      <SupplierFormModal
        isOpen={showSupplierFormModal}
        supplierToEdit={supplierToEdit}
        onClose={() => {
          setShowSupplierFormModal(false);
          setSupplierToEdit(null);
        }}
        onSuccess={() => {
          setShowSupplierFormModal(false);
          setSupplierToEdit(null);
        }}
      />

      {/* 2. Modal Histori Pembelian Supplier */}
      <SupplierHistoryModal
        isOpen={!!selectedSupplierForHistory}
        supplier={selectedSupplierForHistory}
        onClose={() => setSelectedSupplierForHistory(null)}
        onRepeatOrder={(supplierId, items) => {
          setSelectedSupplierForHistory(null);
          handleOpenRepeatOrder(supplierId, items);
        }}
        onViewPoDetail={poId => {
          setSelectedSupplierForHistory(null);
          const target = db.getPurchaseById(poId);
          if (target) setSelectedPO(target);
        }}
      />

      {/* 3. Modal Buat PO Baru */}
      <CreatePurchaseModal
        isOpen={showCreatePOModal}
        onClose={() => {
          setShowCreatePOModal(false);
          setReorderSupplierId(undefined);
          setReorderLines(undefined);
        }}
        initialSupplierId={reorderSupplierId}
        initialLines={reorderLines}
        onSuccess={poNumber => {
          setShowCreatePOModal(false);
          setReorderSupplierId(undefined);
          setReorderLines(undefined);
          const created = db.getPurchaseById(poNumber);
          if (created) setSelectedPO(created);
        }}
      />

      {/* 3. Modal Detail PO */}
      <PurchaseDetailModal
        isOpen={!!selectedPO}
        purchase={selectedPO}
        onClose={() => setSelectedPO(null)}
        onOpenReceiveModal={handleOpenReceive}
      />

      {/* 4. Modal Terima Barang */}
      {receiveTargetPO && (
        <ReceiveGoodsModal
          isOpen={isReceiveModalOpen}
          purchase={receiveTargetPO.purchase}
          lines={receiveTargetPO.lines}
          onClose={() => {
            setIsReceiveModalOpen(false);
            setReceiveTargetPO(null);
          }}
          onSuccess={handleReceiveSuccess}
        />
      )}

      {/* 5. Modal Audit Penerimaan Barang */}
      {auditData.isOpen && auditData.receipt && auditData.purchase && (
        <ReceiveReceiptAuditModal
          isOpen={auditData.isOpen}
          receipt={auditData.receipt}
          purchase={auditData.purchase}
          createdLayers={auditData.createdLayers}
          journal={auditData.journal!}
          journalLines={auditData.journalLines}
          grandTotalPortion={auditData.grandTotalPortion}
          newStatus={auditData.newStatus}
          onClose={() => setAuditData(prev => ({ ...prev, isOpen: false }))}
          onOpenInspector={() => {
            setAuditData(prev => ({ ...prev, isOpen: false }));
            if (onOpenInspector) onOpenInspector();
          }}
        />
      )}

      {/* 6. Prompt 5: Modal Retur ke Supplier */}
      {returnTargetPO && (
        <ReturnPurchaseModal
          isOpen={!!returnTargetPO}
          purchase={returnTargetPO}
          lines={db.getPurchaseLines(returnTargetPO.id)}
          onClose={() => setReturnTargetPO(null)}
          onSuccess={() => setReturnTargetPO(null)}
        />
      )}
    </div>
  );
};
