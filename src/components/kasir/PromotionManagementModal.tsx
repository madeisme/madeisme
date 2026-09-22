import React, { useState } from 'react';
import { Promotion, PromotionType } from '../../types/erp';
import { useAppDatabase } from '../../database/useAppDatabase';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { 
  X, 
  Tag, 
  Plus, 
  Percent, 
  DollarSign, 
  Calendar, 
  Trash2, 
  Check, 
  Copy, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';

interface PromotionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPromoToCart?: (promo: Promotion) => void;
  cartSubtotal?: number;
}

export const PromotionManagementModal: React.FC<PromotionManagementModalProps> = ({
  isOpen,
  onClose,
  onApplyPromoToCart,
  cartSubtotal = 0
}) => {
  const { db, promotions } = useAppDatabase();

  const [isCreating, setIsCreating] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<PromotionType>('PERCENTAGE');
  const [value, setValue] = useState<number>(10);
  const [minPurchase, setMinPurchase] = useState<number>(50000);
  const [maxDiscount, setMaxDiscount] = useState<number>(15000);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    const cleanName = name.trim();

    if (!cleanCode) {
      setErrorMsg('Kode promo wajib diisi (misal: HEMAT10)');
      return;
    }
    if (!cleanName) {
      setErrorMsg('Nama promosi wajib diisi');
      return;
    }
    if (value <= 0) {
      setErrorMsg('Nilai diskon harus lebih besar dari 0');
      return;
    }
    if (type === 'PERCENTAGE' && value > 100) {
      setErrorMsg('Diskon persentase tidak boleh lebih dari 100%');
      return;
    }

    const newPromo: Promotion = {
      id: `PRM-${Date.now().toString().slice(-6)}`,
      code: cleanCode,
      name: cleanName,
      type,
      value,
      minPurchase: Math.max(0, minPurchase),
      maxDiscount: type === 'PERCENTAGE' && maxDiscount > 0 ? maxDiscount : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      isActive: true,
      usageCount: 0,
      description: description.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    db.insertPromotion(newPromo);
    setIsCreating(false);
    // Reset form
    setCode('');
    setName('');
    setValue(10);
    setMinPurchase(50000);
    setMaxDiscount(15000);
    setDescription('');
  };

  const handleToggleActive = (promo: Promotion) => {
    db.updatePromotion({
      ...promo,
      isActive: !promo.isActive
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Hapus kode promosi ini?')) {
      db.deletePromotion(id);
    }
  };

  const handleCopy = (promoCode: string) => {
    navigator.clipboard?.writeText(promoCode);
    setCopiedCode(promoCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm border border-white/30 shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Kelola Promosi & Diskon Kasir</h3>
              <p className="text-xs text-white/80">
                Buat kupon potongan persen / nominal untuk total belanja pelanggan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="bg-emerald-50/60 border-b border-emerald-100 px-5 py-3 flex items-center justify-between">
          <div className="text-xs text-emerald-950 font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Tersedia <strong>{promotions.filter(p => p.isActive).length}</strong> promo aktif untuk kasir</span>
          </div>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              isCreating
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
            }`}
          >
            {isCreating ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Batal Tambah</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Promo Baru</span>
              </>
            )}
          </button>
        </div>

        {/* Create Promo Form */}
        {isCreating && (
          <form onSubmit={handleCreatePromo} className="p-5 border-b border-slate-200 bg-slate-50/90 text-xs space-y-3.5 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>Form Buat Kode Promosi Baru</span>
              </h4>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Kode Voucher Promo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: HEMAT10, JUMATBERKAH"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono font-bold text-slate-900 tracking-wider focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Nama Promosi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Diskon Sembako 10%"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Tipe Promo */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-700">Tipe Potongan Harga</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('PERCENTAGE')}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition ${
                      type === 'PERCENTAGE'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Percent className="w-4 h-4 text-emerald-600" />
                    <span>Persentase (%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('FIXED')}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition ${
                      type === 'FIXED'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Nominal Rupiah (Rp)</span>
                  </button>
                </div>
              </div>

              {/* Nilai Potongan */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  {type === 'PERCENTAGE' ? 'Besar Persentase Diskon (%)' : 'Nominal Potongan (Rp)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={type === 'PERCENTAGE' ? 100 : 10000000}
                    value={value}
                    onChange={e => setValue(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                  <span className="absolute right-3 top-2.5 font-bold text-slate-400">
                    {type === 'PERCENTAGE' ? '%' : 'Rp'}
                  </span>
                </div>
              </div>

              {/* Min Belanja */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Syarat Minimal Belanja (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0 jika tanpa batas"
                  value={minPurchase}
                  onChange={e => setMinPurchase(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Max Discount if percentage */}
              {type === 'PERCENTAGE' && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">
                    Batas Maksimal Potongan (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Misal 20.000 (kosongkan jika tanpa batas)"
                    value={maxDiscount}
                    onChange={e => setMaxDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              )}

              {/* Periode Tanggal */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Tanggal Berakhir (Opsional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-700">Catatan / Syarat & Ketentuan</label>
                <input
                  type="text"
                  placeholder="Misal: Khusus pembelian sembako minimal Rp 50.000"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs transition"
              >
                Simpan & Aktifkan Promo
              </button>
            </div>
          </form>
        )}

        {/* Promo List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
          {promotions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Tag className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">Belum ada kode promo terdaftar</p>
              <p className="text-xs mt-1">Klik tombol "Buat Promo Baru" di atas untuk menambahkan promo perdana.</p>
            </div>
          ) : (
            promotions.map(promo => {
              const isExpired = promo.endDate && promo.endDate < today;
              const meetsMin = cartSubtotal >= (promo.minPurchase || 0);

              return (
                <div
                  key={promo.id}
                  className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    !promo.isActive || isExpired
                      ? 'bg-slate-50/70 border-slate-200 opacity-60'
                      : 'bg-white border-emerald-100 hover:border-emerald-300 shadow-2xs'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-lg text-sm tracking-wider border border-emerald-300">
                        {promo.code}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        promo.type === 'PERCENTAGE' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {promo.type === 'PERCENTAGE' ? `Diskon ${promo.value}%` : `Potongan ${formatRupiah(promo.value)}`}
                      </span>
                      {promo.isActive && !isExpired && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Aktif
                        </span>
                      )}
                      {isExpired && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Kedaluwarsa
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        • Dipakai: <strong>{promo.usageCount || 0}x</strong>
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm">
                      {promo.name}
                    </h4>

                    <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {promo.minPurchase > 0 && (
                        <span>Min. Belanja: <strong>{formatRupiah(promo.minPurchase)}</strong></span>
                      )}
                      {promo.maxDiscount && (
                        <span>Maks. Potongan: <strong>{formatRupiah(promo.maxDiscount)}</strong></span>
                      )}
                      {promo.endDate && (
                        <span>Berlaku s/d: <strong>{formatDateIndo(promo.endDate)}</strong></span>
                      )}
                    </div>

                    {promo.description && (
                      <p className="text-[11px] text-slate-500 italic">
                        "{promo.description}"
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex-shrink-0">
                    <button
                      onClick={() => handleCopy(promo.code)}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition flex items-center gap-1 text-[11px] font-semibold"
                      title="Salin Kode Promo"
                    >
                      {copiedCode === promo.code ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>

                    {onApplyPromoToCart && promo.isActive && !isExpired && (
                      <button
                        onClick={() => {
                          onApplyPromoToCart(promo);
                          onClose();
                        }}
                        className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition ${
                          meetsMin
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                        title={meetsMin ? 'Terapkan promo ke kasir' : `Subtotal kurang dari min belanja ${formatRupiah(promo.minPurchase)}`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Gunakan di Kasir</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleActive(promo)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-[10px] border transition ${
                        promo.isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {promo.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>

                    <button
                      onClick={() => handleDelete(promo.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      title="Hapus Promo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Potongan promosi dicatat di buku besar akuntansi sebagai <strong>Akun 4120 DISKON_PENJUALAN</strong>.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
