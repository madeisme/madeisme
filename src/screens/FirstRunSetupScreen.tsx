import React, { useState } from 'react';
import { db } from '../database/appDatabase';
import { Store, User } from '../types/erp';
import { 
  Store as StoreIcon, 
  UserCheck, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Database,
  Building2,
  Phone,
  HelpCircle
} from 'lucide-react';

interface FirstRunSetupScreenProps {
  onSetupComplete: (user: User, store: Store) => void;
}

export const FirstRunSetupScreen: React.FC<FirstRunSetupScreenProps> = ({ onSetupComplete }) => {
  const [storeName, setStoreName] = useState('Omah Sembako Sehati');
  const [ownerName, setOwnerName] = useState('Budi Santoso');
  const [phone, setPhone] = useState('0812-3456-7890');
  const [includeSampleData, setIncludeSampleData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setErrorMessage('Nama toko wajib diisi.');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage('Nama pemilik (Owner) wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = db.completeFirstRunSetup({
        storeName: storeName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        includeSampleProducts: includeSampleData
      });

      if (!result.success || !result.user || !result.store) {
        setErrorMessage(result.error || 'Gagal menyelesaikan setup awal');
        setIsSubmitting(false);
        return;
      }

      onSetupComplete(result.user, result.store);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem');
      setIsSubmitting(false);
    }
  };

  const handleQuickSeedDemo = () => {
    setIsSubmitting(true);
    db.resetToSeed();
    const users = db.getAllUsers();
    const store = db.getStore();
    onSetupComplete(users[0], store);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl bg-slate-800/90 border border-slate-700/80 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 px-6 py-6 sm:px-8 sm:py-8 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold tracking-wide uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              First-Run Setup Toko
            </span>
            <span className="text-white/70 text-xs font-mono">Prompt 7 • RBAC</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Setup Toko Pertama Kali
          </h1>
          <p className="text-emerald-100 text-xs sm:text-sm mt-1.5 leading-relaxed max-w-xl">
            Aplikasi belum memiliki data pengguna terdaftar. Silakan lengkapi formulir di bawah ini untuk membuat akun <strong>OWNER</strong> pertama sebagai penanggung jawab utama toko.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
            {/* Input Nama Toko */}
            <div>
              <label htmlFor="store-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <StoreIcon className="w-4 h-4 text-emerald-400" />
                Nama Toko Sembako <span className="text-rose-400">*</span>
              </label>
              <input
                id="store-name-input"
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="misal: Omah Sembako Sehati"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-hidden transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">Nama ini akan tercetak di struk kasir, PO pembelian, dan laporan keuangan.</p>
            </div>

            {/* Input Nama Pemilik */}
            <div>
              <label htmlFor="owner-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                Nama Pemilik (Role: OWNER) <span className="text-rose-400">*</span>
              </label>
              <input
                id="owner-name-input"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="misal: Budi Santoso"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-hidden transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">Satu-satunya cara membuat akun OWNER pertama (Prompt 7 §3).</p>
            </div>

            {/* Input Telepon */}
            <div>
              <label htmlFor="phone-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-400" />
                Nomor Kontak / WhatsApp
              </label>
              <input
                id="phone-input"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="misal: 0812-3456-7890"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-hidden transition"
              />
            </div>

            {/* Checkbox Inisialisasi Produk */}
            <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-700/60 flex items-start gap-3">
              <input
                id="sample-data-checkbox"
                type="checkbox"
                checked={includeSampleData}
                onChange={(e) => setIncludeSampleData(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="sample-data-checkbox" className="text-xs text-slate-300 leading-relaxed cursor-pointer select-none">
                <strong className="text-white block font-semibold mb-0.5">Sertakan Katalog Sembako & Persediaan Awal</strong>
                Inisialisasi 8 produk pokok (Beras Rojolele, Minyak Sania, Gula Gulaku, Telur, Terigu Segitiga Biru, dll.) dengan layer FIFO agar toko langsung siap digunakan untuk transaksi kasir & pembelian.
              </label>
            </div>
          </div>

          {/* Ketentuan Keamanan & Arsitektur */}
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-200/90 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Ketentuan Tata Kelola & Otorisasi:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-200/80 pl-1">
              <li>8 Akun Standar (Kas, Piutang, Persediaan, Utang, Modal, Penjualan, HPP, Beban) otomatis diaktifkan.</li>
              <li>Akun pertama dibuat dengan peran <strong>OWNER</strong> dengan hak penuh atas sistem.</li>
              <li>Setelah setup ini selesai, layar onboarding ini <strong>tidak akan pernah muncul lagi</strong>.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              id="submit-first-run-btn"
              className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Memproses Setup...' : 'Selesaikan Setup & Masuk Beranda'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              type="button"
              onClick={handleQuickSeedDemo}
              disabled={isSubmitting}
              id="quick-demo-seed-btn"
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-600 transition"
              title="Memuat data demo lengkap 5 role pengguna bawaan"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Muat Demo Lengkap (5 Role)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
