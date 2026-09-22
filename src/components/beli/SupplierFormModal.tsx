import React, { useState, useEffect } from 'react';
import { Supplier } from '../../types/erp';
import { useAppDatabase } from '../../database/useAppDatabase';
import { 
  X, 
  Building2, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  Clock, 
  FileText, 
  Save, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierToEdit?: Supplier | null;
  onSuccess: (supplier: Supplier) => void;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  supplierToEdit,
  onSuccess
}) => {
  const { db } = useAppDatabase();

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [bankName, setBankName] = useState('BCA');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState(14);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (supplierToEdit) {
        setName(supplierToEdit.name || '');
        setContactPerson(supplierToEdit.contactPerson || '');
        setPhone(supplierToEdit.phone || '');
        setEmail(supplierToEdit.email || '');
        setAddress(supplierToEdit.address || '');
        setCity(supplierToEdit.city || '');
        setBankName(supplierToEdit.bankName || 'BCA');
        setBankAccountNo(supplierToEdit.bankAccountNo || '');
        setBankAccountName(supplierToEdit.bankAccountName || '');
        setPaymentTermsDays(supplierToEdit.paymentTermsDays ?? 14);
        setNotes(supplierToEdit.notes || '');
        setIsActive(supplierToEdit.isActive !== false);
      } else {
        setName('');
        setContactPerson('');
        setPhone('');
        setEmail('');
        setAddress('');
        setCity('');
        setBankName('BCA');
        setBankAccountNo('');
        setBankAccountName('');
        setPaymentTermsDays(14);
        setNotes('');
        setIsActive(true);
      }
      setErrorMsg(null);
    }
  }, [isOpen, supplierToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setErrorMsg('Nama supplier atau perusahaan wajib diisi');
      return;
    }
    if (!cleanPhone) {
      setErrorMsg('Nomor telepon / WhatsApp supplier wajib diisi');
      return;
    }

    if (supplierToEdit) {
      const updated: Supplier = {
        ...supplierToEdit,
        name: cleanName,
        contactPerson: contactPerson.trim() || undefined,
        phone: cleanPhone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        bankName: bankName.trim() || undefined,
        bankAccountNo: bankAccountNo.trim() || undefined,
        bankAccountName: bankAccountName.trim() || undefined,
        paymentTermsDays: Number(paymentTermsDays) || 0,
        notes: notes.trim() || undefined,
        isActive: isActive
      };
      db.updateSupplier(updated);
      onSuccess(updated);
    } else {
      const allSuppliers = db.getAllSuppliers();
      const newId = `SUP-${String(allSuppliers.length + 1).padStart(3, '0')}`;
      const newSupplier: Supplier = {
        id: newId,
        name: cleanName,
        contactPerson: contactPerson.trim() || undefined,
        phone: cleanPhone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        bankName: bankName.trim() || undefined,
        bankAccountNo: bankAccountNo.trim() || undefined,
        bankAccountName: bankAccountName.trim() || undefined,
        paymentTermsDays: Number(paymentTermsDays) || 0,
        notes: notes.trim() || undefined,
        isActive: isActive,
        apBalance: 0,
        createdAt: new Date().toISOString()
      };
      db.insertSupplier(newSupplier);
      onSuccess(newSupplier);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {supplierToEdit ? 'Edit Data Supplier' : 'Tambah Kontak Supplier Baru'}
              </h3>
              <p className="text-[11px] text-slate-300">
                {supplierToEdit ? `ID: ${supplierToEdit.id}` : 'Kelola data kontak, rekening & syarat tempo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Profil Perusahaan / Toko */}
          <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Profil Supplier & PIC</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-700">
                  Nama Supplier / Perusahaan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: CV Berkah Pangan Mandiri"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-900 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Contact Person (PIC / Sales)</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pak Herman (Sales)"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>No. Telepon / WhatsApp <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 081234567890"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800 font-mono"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>Email (Opsional)</span>
                </label>
                <input
                  type="email"
                  placeholder="Contoh: sales@berkahpangan.co.id"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Alamat & Kota */}
          <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lokasi & Pengiriman</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-700">Alamat Lengkap Gudang/Kantor</label>
                <input
                  type="text"
                  placeholder="Contoh: Jl. Raya Pasar Induk No. 45"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Kota / Wilayah</label>
                <input
                  type="text"
                  placeholder="Contoh: Sidoarjo"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Rekening Pembayaran & Syarat Tempo */}
          <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-purple-600" />
              <span>Rekening Pembayaran & Syarat Tempo</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Nama Bank</label>
                <input
                  type="text"
                  placeholder="BCA / Mandiri / BRI"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Nomor Rekening</label>
                <input
                  type="text"
                  placeholder="Contoh: 1234567890"
                  value={bankAccountNo}
                  onChange={e => setBankAccountNo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Atas Nama Rekening</label>
                <input
                  type="text"
                  placeholder="Contoh: PT Berkah Pangan"
                  value={bankAccountName}
                  onChange={e => setBankAccountName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Syarat Pembayaran Tempo (Hari)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={paymentTermsDays}
                    onChange={e => setPaymentTermsDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-28 px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800 font-bold"
                  />
                  <span className="text-slate-500 font-medium">Hari (0 = Tunai / COD)</span>
                </div>
              </div>

              <div className="space-y-1 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-white border border-slate-200 w-full transition">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-md focus:ring-0 cursor-pointer"
                  />
                  <span className="font-bold text-slate-800">Status Aktif</span>
                </label>
              </div>
            </div>
          </div>

          {/* Catatan Khusus */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Catatan Khusus (Ketentuan Minimum Order, Jadwal Kirim, dll.)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Minimal order beras 10 karung per pengiriman. Jadwal kirim hari Selasa & Kamis."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-blue-600 text-slate-800"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              <span>{supplierToEdit ? 'Simpan Perubahan' : 'Tambah Supplier'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
