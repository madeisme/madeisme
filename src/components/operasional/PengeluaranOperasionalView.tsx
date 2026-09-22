import React, { useState, useMemo } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { OperationalExpense } from '../../types/erp';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Calendar, 
  Tag, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  X,
  ArrowRight,
  TrendingDown,
  Building2,
  Zap,
  Package,
  Truck,
  ShieldCheck,
  Wrench,
  HelpCircle
} from 'lucide-react';
import { JournalDrilldownModal } from '../laporan/JournalDrilldownModal';

const EXPENSE_CATEGORIES = [
  { name: 'Listrik & Air', icon: Zap, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { name: 'Perlengkapan Toko', icon: Package, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { name: 'Transport & Logistik', icon: Truck, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { name: 'Kebersihan & Keamanan', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { name: 'Pemeliharaan Toko', icon: Wrench, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { name: 'Gaji & Upah Toko', icon: Building2, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { name: 'Lain-lain', icon: HelpCircle, color: 'text-slate-600 bg-slate-50 border-slate-200' }
];

interface PengeluaranOperasionalViewProps {
  initialOpenModal?: boolean;
}

export const PengeluaranOperasionalView: React.FC<PengeluaranOperasionalViewProps> = ({
  initialOpenModal = false
}) => {
  const { operationalExpenses, recordOperationalExpense, deleteOperationalExpense, currentUser, journals, journalLines } = useAppDatabase();
  const [showAddModal, setShowAddModal] = useState(initialOpenModal);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);

  // Form state
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [formData, setFormData] = useState({
    category: 'Listrik & Air',
    amount: '',
    businessDate: todayStr,
    notes: '',
    receiptNumber: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Perhitungan Ringkasan
  const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM
  const totalBulanIni = useMemo(() => {
    return operationalExpenses
      .filter(e => e.businessDate.startsWith(currentMonthPrefix))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [operationalExpenses, currentMonthPrefix]);

  const totalHariIni = useMemo(() => {
    return operationalExpenses
      .filter(e => e.businessDate === todayStr)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [operationalExpenses, todayStr]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return operationalExpenses.filter(e => {
      const matchCat = selectedCategory === 'Semua' || e.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || 
        e.notes?.toLowerCase().includes(q) || 
        e.category.toLowerCase().includes(q) ||
        e.receiptNumber?.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [operationalExpenses, selectedCategory, searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numAmount = parseInt(formData.amount.replace(/\D/g, ''), 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Nominal pengeluaran harus lebih besar dari Rp 0.');
      return;
    }

    if (!formData.businessDate) {
      setFormError('Tanggal pengeluaran wajib diisi.');
      return;
    }

    try {
      const result = recordOperationalExpense({
        category: formData.category,
        amount: numAmount,
        businessDate: formData.businessDate,
        notes: formData.notes.trim() || formData.category,
        receiptNumber: formData.receiptNumber.trim(),
        userId: currentUser.id,
        createdByName: currentUser.name
      });

      setShowAddModal(false);
      setFormData({
        category: 'Listrik & Air',
        amount: '',
        businessDate: todayStr,
        notes: '',
        receiptNumber: ''
      });

      setSuccessToast(`Pengeluaran sebesar ${formatRupiah(numAmount)} berhasil dicatat (No. Bukti: ${result.expense.id})!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan pengeluaran operasional.');
    }
  };

  const handleDelete = (id: string, amount: number, desc: string) => {
    if (window.confirm(`Yakin ingin menghapus catatan pengeluaran ${desc} (${formatRupiah(amount)})? Jurnal akuntansi terkait juga akan dihapus dan saldo kas dikembalikan.`)) {
      deleteOperationalExpense(id);
      setSuccessToast('Pengeluaran berhasil dihapus dan jurnal akuntansi telah disesuaikan.');
      setTimeout(() => setSuccessToast(null), 3000);
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    const found = EXPENSE_CATEGORIES.find(c => c.name === category);
    return found ? found.color : 'text-slate-700 bg-slate-100 border-slate-200';
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {successToast && (
        <div className="bg-emerald-600 text-white p-3 rounded-xl shadow-lg flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span className="font-semibold">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Total Bulan Ini */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Beban Operasional Bulan Ini</p>
            <p className="text-xl font-bold text-slate-900 font-mono mt-1">
              {formatRupiah(totalBulanIni)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Periode {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Hari Ini */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Pengeluaran Hari Ini</p>
            <p className="text-xl font-bold text-slate-900 font-mono mt-1">
              {formatRupiah(totalHariIni)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {operationalExpenses.filter(e => e.businessDate === todayStr).length} transaksi hari ini
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Action Catat Pengeluaran */}
        <div className="bg-gradient-to-br from-emerald-800 to-teal-900 text-white p-4 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-200">Arus Kas Keluar Toko</span>
            <Receipt className="w-4 h-4 text-emerald-300" />
          </div>
          <p className="text-xs text-emerald-100/90 mt-1">
            Catat biaya listrik, air, perlengkapan, gaji, atau pemeliharaan toko.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 w-full py-2 px-3 bg-white text-emerald-950 hover:bg-emerald-50 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pengeluaran Baru</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari keterangan, kategori, atau no bukti pengeluaran..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Filter className="w-3.5 h-3.5" />
              <span>Kategori:</span>
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Semua">Semua Kategori ({operationalExpenses.length})</option>
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </button>
          </div>
        </div>

        {/* Quick Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory('Semua')}
            className={`px-2.5 py-1 rounded-full font-medium transition text-[11px] shrink-0 ${
              selectedCategory === 'Semua'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({operationalExpenses.length})
          </button>
          {EXPENSE_CATEGORIES.map(cat => {
            const count = operationalExpenses.filter(e => e.category === cat.name).length;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-2.5 py-1 rounded-full font-medium transition text-[11px] shrink-0 ${
                  selectedCategory === cat.name
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Expense List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-bold text-slate-800">
              Riwayat Pengeluaran Operasional ({filteredExpenses.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Terhubung otomatis ke Laporan Arus Kas & Jurnal Akuntansi
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
              <Receipt className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-700">Belum ada catatan pengeluaran operasional</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Klik tombol 'Catat Pengeluaran Baru' untuk menambahkan biaya operasional pertama.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Catat Pengeluaran Baru</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Tanggal & ID</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Keterangan & Bukti</th>
                  <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                  <th className="py-2.5 px-3">Pencatat</th>
                  <th className="py-2.5 px-3 text-center">Jurnal</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredExpenses.map(exp => {
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 block">{exp.businessDate}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{exp.id}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryBadgeClass(exp.category)}`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs">
                        <p className="font-medium text-slate-800 truncate">{exp.notes || '-'}</p>
                        {exp.receiptNumber && (
                          <span className="text-[10px] text-slate-500 block">
                            No. Bukti: <strong className="font-mono text-slate-700">{exp.receiptNumber}</strong>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                        -{formatRupiah(exp.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600">
                        {exp.createdByName || 'Petugas Toko'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setSelectedJournalId(exp.journalId)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-semibold transition inline-flex items-center gap-1"
                          title="Lihat rincian bukti jurnal akuntansi"
                        >
                          <FileText className="w-3 h-3 text-emerald-600" />
                          <span>{exp.journalId.replace('JRN-', '')}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleDelete(exp.id, exp.amount, exp.notes || exp.category)}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Hapus pengeluaran ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Catat Pengeluaran Operasional Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Catat Pengeluaran Operasional</h3>
                  <p className="text-[11px] text-emerald-200">
                    Otomatis sinkron ke Jurnal Akuntansi & Laporan Arus Kas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Kategori Pengeluaran */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pos Kategori Pengeluaran *
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                  required
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Nominal Pengeluaran */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal Pengeluaran (Rp) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Contoh: 150000"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900"
                    required
                  />
                </div>
                {formData.amount && (
                  <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                    Terbaca: {formatRupiah(parseInt(formData.amount, 10) || 0)}
                  </p>
                )}
              </div>

              {/* Tanggal & No Bukti */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Transaksi *
                  </label>
                  <input
                    type="date"
                    value={formData.businessDate}
                    onChange={e => setFormData({ ...formData, businessDate: e.target.value })}
                    className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. Bukti / Struk / Nota
                  </label>
                  <input
                    type="text"
                    placeholder="Opsional (misal: PLN-01)"
                    value={formData.receiptNumber}
                    onChange={e => setFormData({ ...formData, receiptNumber: e.target.value })}
                    className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Keterangan / Deskripsi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan / Rincian Pengeluaran *
                </label>
                <textarea
                  rows={2}
                  placeholder="Misal: Pembelian kantong kresek ukuran 24 & 30 untuk kasir"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Informasi Akuntansi Berpasangan */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Jurnal Akuntansi Otomatis (Double-Entry):</span>
                </p>
                <div className="font-mono text-[10px] space-y-0.5 pl-4">
                  <p className="text-slate-800">
                    <strong className="text-emerald-700">[DEBIT]</strong> 5200 BEBAN OPERASIONAL
                  </p>
                  <p className="text-slate-800">
                    <strong className="text-rose-700">[KREDIT]</strong> 1110 KAS TOKO
                  </p>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Simpan Pengeluaran</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drill-Down Jurnal Modal */}
      {selectedJournalId && (
        <JournalDrilldownModal
          isOpen={true}
          onClose={() => setSelectedJournalId(null)}
          journalId={selectedJournalId}
          journals={journals}
          journalLines={journalLines}
        />
      )}
    </div>
  );
};
