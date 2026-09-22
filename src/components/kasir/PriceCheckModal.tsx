import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '../../types/erp';
import { formatRupiah } from '../../utils/formatters';
import { 
  Search, 
  X, 
  Tag, 
  Copy, 
  Check, 
  Plus, 
  Minus, 
  ShoppingCart, 
  ArrowUpDown, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  Layers,
  Sparkles
} from 'lucide-react';

interface PriceCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  getStockForProduct: (productId: string) => number;
  onAddToCart?: (productId: string, price: number) => void;
  onUpdateCartQty?: (productId: string, qty: number) => void;
  cartItems?: { productId: string; qty: number; unitPrice: number }[];
}

type SortOption = 'name_asc' | 'price_asc' | 'price_desc' | 'stock_desc';

export const PriceCheckModal: React.FC<PriceCheckModalProps> = ({
  isOpen,
  onClose,
  products,
  getStockForProduct,
  onAddToCart,
  onUpdateCartQty,
  cartItems = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Autofocus input saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery('');
      setSelectedCategory('Semua');
    }
  }, [isOpen]);

  // Daftar kategori unik
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['Semua', ...Array.from(set)];
  }, [products]);

  // Filter & Urutkan Produk
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        p.name.toLowerCase().includes(q) || 
        p.id.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q));
      
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      return matchQuery && matchCat;
    });

    // Pengurutan
    result = [...result].sort((a, b) => {
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name, 'id');
      }
      if (sortBy === 'price_asc') {
        return a.sellPrice - b.sellPrice;
      }
      if (sortBy === 'price_desc') {
        return b.sellPrice - a.sellPrice;
      }
      if (sortBy === 'stock_desc') {
        return getStockForProduct(b.id) - getStockForProduct(a.id);
      }
      return 0;
    });

    return result;
  }, [products, searchQuery, selectedCategory, sortBy, getStockForProduct]);

  // Handle Copy Harga ke Clipboard
  const handleCopyPrice = (product: Product) => {
    const textToCopy = `${product.name}: ${formatRupiah(product.sellPrice)}/${product.unit}`;
    navigator.clipboard?.writeText(textToCopy).catch(() => {});
    setCopiedId(product.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-price-check-overlay"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        id="modal-price-check-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Daftar Harga Jual & Cek Harga Cepat
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 hidden sm:inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Real-Time ERP
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Lihat harga barang dan ketersediaan stok seketika tanpa perlu menambahkannya ke keranjang kasir
              </p>
            </div>
          </div>

          <button
            id="btn-close-price-check-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Control Bar */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Input Pencarian Cepat */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-price-check-search"
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama produk, kategori, atau ID barang (mis: beras, telur, minyak)..."
                className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 text-slate-900 font-medium placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  id="btn-clear-price-search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Pengurutan */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-500 font-medium hidden sm:inline">Urutkan:</span>
                <select
                  id="select-price-check-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="name_asc">Nama (A-Z)</option>
                  <option value="price_asc">Harga Terendah</option>
                  <option value="price_desc">Harga Tertinggi</option>
                  <option value="stock_desc">Stok Terbanyak</option>
                </select>
              </div>
            </div>
          </div>

          {/* Kategori Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {categories.map(cat => (
              <button
                key={cat}
                id={`btn-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Ringkasan Jumlah Hasil */}
        <div className="px-4 sm:px-5 py-2 bg-slate-50 border-b border-slate-200 text-xs flex items-center justify-between text-slate-600">
          <span>
            Menampilkan <strong className="text-slate-900">{filteredProducts.length}</strong> produk dari total {products.length} barang
          </span>
          <span className="text-[11px] text-slate-500">
            Klik tombol <strong className="text-emerald-700">Salin</strong> untuk menyalin info harga
          </span>
        </div>

        {/* Daftar Produk / Price Table List */}
        <div 
          id="list-price-check-products"
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 divide-y divide-slate-100"
        >
          {filteredProducts.map(product => {
            const stock = getStockForProduct(product.id);
            const inCart = cartItems.find(i => i.productId === product.id);
            const isLowStock = stock <= (product.minStockAlert || 5) && stock > 0;
            const isOutOfStock = stock <= 0;
            const isCopied = copiedId === product.id;

            return (
              <div
                key={product.id}
                id={`product-price-row-${product.id}`}
                className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition"
              >
                {/* Info Produk */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm sm:text-base text-slate-900">
                      {product.name}
                    </span>
                    {product.category && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        {product.category}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {product.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>Satuan: <strong className="text-slate-700 font-medium">{product.unit}</strong></span>
                    <span>•</span>
                    {/* Status Stok Real-Time */}
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        isOutOfStock 
                          ? 'bg-rose-500' 
                          : isLowStock 
                            ? 'bg-amber-500 animate-pulse' 
                            : 'bg-emerald-500'
                      }`} />
                      <span className={`font-semibold ${
                        isOutOfStock 
                          ? 'text-rose-700' 
                          : isLowStock 
                            ? 'text-amber-800' 
                            : 'text-emerald-800'
                      }`}>
                        Stok: {stock} {product.unit} {isOutOfStock ? '(Habis)' : isLowStock ? '(Menipis)' : '(Tersedia)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Harga Jual & Aksi Cepat */}
                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* Tampilan Harga Jual Satuan yang Besar & Jelas */}
                  <div className="text-left sm:text-right">
                    <div className="text-xs text-slate-500 font-medium">Harga Jual Satuan</div>
                    <div className="text-lg sm:text-xl font-extrabold text-emerald-800 font-mono tracking-tight">
                      {formatRupiah(product.sellPrice)}
                      <span className="text-xs font-normal text-slate-500 ml-1">/{product.unit}</span>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center gap-1.5">
                    {/* Tombol Salin Harga */}
                    <button
                      id={`btn-copy-price-${product.id}`}
                      onClick={() => handleCopyPrice(product)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                        isCopied
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                      title="Salin nama dan harga produk"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span className="hidden sm:inline">Salin</span>
                        </>
                      )}
                    </button>

                    {/* Tombol Tambah ke Keranjang (Opsional jika pembeli langsung ingin beli) */}
                    {onAddToCart && (
                      inCart && onUpdateCartQty ? (
                        <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-300 rounded-lg px-2 py-1">
                          <button
                            onClick={() => onUpdateCartQty(product.id, inCart.qty - 1)}
                            className="w-5 h-5 flex items-center justify-center text-emerald-700 hover:bg-emerald-200 rounded"
                            title="Kurang Qty"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-emerald-900 min-w-5 text-center font-mono">
                            {inCart.qty}
                          </span>
                          <button
                            onClick={() => onUpdateCartQty(product.id, inCart.qty + 1)}
                            className="w-5 h-5 flex items-center justify-center text-emerald-700 hover:bg-emerald-200 rounded"
                            title="Tambah Qty"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          id={`btn-add-cart-${product.id}`}
                          onClick={() => onAddToCart(product.id, product.sellPrice)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition"
                          title="Masukkan ke keranjang kasir"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Beli</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">Tidak ditemukan produk sesuai pencarian</p>
              <p className="text-xs text-slate-400">
                Coba kata kunci lain atau pilih kategori &apos;Semua&apos; untuk melihat seluruh daftar harga
              </p>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Harga jual tertera adalah harga resmi yang berlaku pada struk kasir saat ini.</span>
          </div>

          <button
            id="btn-close-price-check-bottom"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition ml-auto"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
