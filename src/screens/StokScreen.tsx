import React, { useState } from 'react';
import { useAppDatabase } from '../database/useAppDatabase';
import { formatRupiah, formatDateIndo } from '../utils/formatters';
import { 
  Boxes, 
  Search, 
  Plus, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  Tag,
  Clock,
  ClipboardCheck,
  Truck,
  MapPin
} from 'lucide-react';
import { Product, InventoryLayer, StockLocation } from '../types/erp';
import { StockOpnameTab } from '../components/stok/StockOpnameTab';
import { StockTransferTab } from '../components/stok/StockTransferTab';

export type StokSubTab = 'KATALOG' | 'OPNAME' | 'TRANSFER';

export const StokScreen: React.FC = () => {
  const { 
    products, 
    inventoryLayers, 
    stockOpnames,
    stockTransfers,
    getStockForProduct, 
    getProductStockBreakdown,
    getLayersForProduct, 
    db 
  } = useAppDatabase();

  const [activeTab, setActiveTab] = useState<StokSubTab>('KATALOG');
  const [search, setSearch] = useState(db.stokSearchQuery);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  // Form states for new product
  const [newProductName, setNewProductName] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('kg');
  const [newProductPrice, setNewProductPrice] = useState<number>(15000);
  const [newProductCategory, setNewProductCategory] = useState('Sembako Utama');
  const [initialQty, setInitialQty] = useState<number>(10);
  const [initialCost, setInitialCost] = useState<number>(12000);
  const [initialLocation, setInitialLocation] = useState<StockLocation>('GUDANG');

  const draftOpnamesCount = stockOpnames.filter(o => o.status === 'DRAFT').length;
  const activeTransfersCount = stockTransfers.filter(t => t.status === 'DRAFT' || t.status === 'APPROVED' || t.status === 'RECEIVING').length;

  const handleSearchChange = (val: string) => {
    setSearch(val);
    db.stokSearchQuery = val;
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const newId = `PRD-${String(products.length + 1).padStart(3, '0')}`;
    const newProduct: Product = {
      id: newId,
      name: newProductName.trim(),
      unit: newProductUnit.trim(),
      sellPrice: Math.round(Number(newProductPrice)), // Long integer Rupiah
      itemType: 'EQT',
      category: newProductCategory,
      minStockAlert: 5
    };

    // Insert Product via DAO
    db.insertProduct(newProduct);

    // If initial stock provided, create initial InventoryLayer (FIFO Batch 1)
    if (initialQty > 0) {
      const initialLayer: InventoryLayer = {
        id: `INV-${String(inventoryLayers.length + 1).padStart(3, '0')}`,
        productId: newId,
        quantityRemaining: Math.round(Number(initialQty)),
        unitCost: Math.round(Number(initialCost)), // Long integer HPP
        receivedAt: new Date().toISOString(),
        location: initialLocation
      };
      db.insertInventoryLayer(initialLayer);
    }

    // Reset & close
    setNewProductName('');
    setShowAddProductModal(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedProductId(expandedProductId === id ? null : id);
  };

  return (
    <div className="p-4 sm:p-5 space-y-4 pb-12">
      {/* Header & Sub-Tabs Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            <span>Manajemen Persediaan & Stok Multilokasi</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pelacakan Batch FIFO • Pemisahan Lokasi Fisik (Toko & Gudang) • Stock Opname • Transfer Stok
          </p>
        </div>

        {/* Sub-Tab Navigation Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl flex-wrap">
          <button
            onClick={() => setActiveTab('KATALOG')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'KATALOG'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Katalog & Batch FIFO</span>
          </button>

          <button
            onClick={() => setActiveTab('OPNAME')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'OPNAME'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Stock Opname</span>
            {draftOpnamesCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {draftOpnamesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('TRANSFER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'TRANSFER'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Transfer Lokasi</span>
            {activeTransfersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center">
                {activeTransfersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: KATALOG & BATCH FIFO */}
      {activeTab === 'KATALOG' && (
        <div className="space-y-3">
          {/* Action Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Cari produk berdasarkan nama atau kode..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800"
              />
            </div>

            <button
              onClick={() => setShowAddProductModal(true)}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Produk Baru</span>
            </button>
          </div>

          {/* Product & FIFO Layer List */}
          <div className="space-y-2.5">
            {filteredProducts.map(product => {
              const breakdown = getProductStockBreakdown(product.id);
              const layers = getLayersForProduct(product.id);
              const isExpanded = expandedProductId === product.id;
              const isLow = breakdown.total <= (product.minStockAlert || 5);

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition"
                >
                  {/* Product Header Row */}
                  <div 
                    onClick={() => toggleExpand(product.id)}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {product.id}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {product.category}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                          Jual: {formatRupiah(product.sellPrice)} / {product.unit}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-1 truncate">
                        {product.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Breakdown Per Location Badges */}
                      <div className="flex items-center gap-1.5 text-right">
                        <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                          Toko: {breakdown.toko} {product.unit}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                          Gudang: {breakdown.gudang} {product.unit}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          isLow
                            ? 'bg-rose-100 text-rose-900 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}>
                          Total: {breakdown.total} {product.unit}
                        </span>
                      </div>

                      <div className="text-slate-400 ml-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* FIFO Inventory Layers Drilldown */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-200 p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600 font-semibold text-[11px]">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-emerald-600" />
                          Rincian Batch FIFO Aktif (Urutan konsumsi tertua lebih dulu):
                        </span>
                        <span>ItemType: <code className="font-mono text-emerald-800">{product.itemType}</code></span>
                      </div>

                      {layers.length === 0 ? (
                        <p className="text-slate-400 text-center py-2.5 italic text-[11px]">
                          Belum ada batch persediaan aktif untuk produk ini di toko maupun gudang.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {layers.map((layer, idx) => (
                            <div
                              key={layer.id}
                              className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                                  {idx + 1}
                                </span>
                                <div>
                                  <span className="font-mono font-bold text-slate-800">{layer.id}</span>
                                  <span className="text-slate-400 ml-2">
                                    Masuk: {formatDateIndo(layer.receivedAt)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 self-end sm:self-auto">
                                {/* Location Badge */}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  (layer.location || 'GUDANG') === 'TOKO'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  LOKASI: {layer.location || 'GUDANG'}
                                </span>

                                <div>
                                  <span className="text-slate-400">HPP/Unit: </span>
                                  <span className="font-semibold text-slate-800">{formatRupiah(layer.unitCost)}</span>
                                </div>

                                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                  Tersisa: {layer.quantityRemaining} {product.unit}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: STOCK OPNAME */}
      {activeTab === 'OPNAME' && (
        <StockOpnameTab />
      )}

      {/* SUB-TAB 3: TRANSFER ANTAR LOKASI */}
      {activeTab === 'TRANSFER' && (
        <StockTransferTab />
      )}

      {/* Modal Tambah Produk Baru */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Tambah Produk Sembako</h3>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nama Produk</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Garam Dapur Beryodium 250g"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Satuan</label>
                  <select
                    value={newProductUnit}
                    onChange={e => setNewProductUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 bg-white"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="sak">sak (Karung)</option>
                    <option value="pouch">pouch</option>
                    <option value="liter">liter</option>
                    <option value="dus">dus / karton</option>
                    <option value="pcs">pcs</option>
                    <option value="kaleng">kaleng</option>
                    <option value="pack">pack</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Harga Jual (Rupiah)</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    required
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Kategori Sembako</label>
                <input
                  type="text"
                  value={newProductCategory}
                  onChange={e => setNewProductCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Batch Persediaan Awal (FIFO Layer 1):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Jumlah Stok Awal</label>
                    <input
                      type="number"
                      min="0"
                      value={initialQty}
                      onChange={e => setInitialQty(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">HPP Awal (Rp/unit)</label>
                    <input
                      type="number"
                      min="0"
                      value={initialCost}
                      onChange={e => setInitialCost(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Lokasi Simpan Awal</label>
                  <select
                    value={initialLocation}
                    onChange={e => setInitialLocation(e.target.value as StockLocation)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white text-xs"
                  >
                    <option value="GUDANG">GUDANG (Penyimpanan Belakang)</option>
                    <option value="TOKO">TOKO (Display Kasir Depan)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
