import React, { useState } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { User, UserRole, Store } from '../../types/erp';
import { hasPermission, RBAC_MATRIX, RbacAction } from '../../rbac/permissions';
import { 
  X, 
  Settings, 
  Users, 
  UserPlus, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Store as StoreIcon, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  RotateCcw,
  Sliders,
  CheckCircle2,
  Lock,
  Phone,
  HelpCircle,
  Table,
  Cloud,
  CloudUpload,
  CloudDownload,
  FileSpreadsheet,
  CheckCircle,
  LogOut,
  ExternalLink
} from 'lucide-react';
import { 
  googleSignIn, 
  googleSignOut, 
  getAccessToken,
  initAuth
} from '../../services/googleAuthService';
import { 
  executeBackupToGoogleSheets, 
  fetchRestorePreview, 
  BackupPreviewData,
  isOnline 
} from '../../services/googleBackupService';
import { RestorePreviewModal } from './RestorePreviewModal';
import { formatDateTimeIndo } from '../../utils/formatters';
import { runSystemHealthCheck, SystemHealthReport } from '../../utils/systemHealthCheck';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerFirstRun?: () => void;
}

const ALL_ROLES: { role: UserRole; label: string; desc: string; color: string }[] = [
  { role: 'OWNER', label: 'Owner (Pemilik)', desc: 'Akses penuh seluruh modul, otorisasi khusus, dan penetapan role.', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { role: 'ADMIN', label: 'Admin Toko', desc: 'Manajemen operasional, approve PO, void/return, dan tambah user.', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { role: 'BOOKKEEPER', label: 'Bookkeeper (Akuntansi)', desc: 'Kelola buku besar, jurnal, laporan keuangan, dan pelunasan piutang.', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { role: 'KASIR', label: 'Kasir', desc: 'Transaksi penjualan POS tunai/kredit dan cetak nota.', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { role: 'GUDANG', label: 'Petugas Gudang', desc: 'Buat draft PO dan penerimaan fisik barang dari supplier.', color: 'bg-orange-100 text-orange-800 border-orange-300' }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onTriggerFirstRun
}) => {
  const { db, currentUser, users, store, googleAccountLink, backupConfig } = useAppDatabase();
  const [activeTab, setActiveTab] = useState<'users' | 'store' | 'matrix' | 'system' | 'backup'>('users');

  // Google Sign-In & Backup States (Prompt 15)
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isLoadingRestorePreview, setIsLoadingRestorePreview] = useState(false);
  const [restorePreviewData, setRestorePreviewData] = useState<BackupPreviewData | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [postRestoreHealthReport, setPostRestoreHealthReport] = useState<SystemHealthReport | null>(null);

  // Form Tambah User
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('KASIR');
  const [newUserPhone, setNewUserPhone] = useState('');

  // Edit Role User
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>('KASIR');

  // Form Info Toko
  const [storeName, setStoreName] = useState(store?.name || 'Omah Sembako Sehati');
  const [storeAddress, setStoreAddress] = useState(store?.address || '');
  const [storePhone, setStorePhone] = useState(store?.phone || '');

  // Feedback status
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // RBAC checks for Settings (§4)
  const canAccessSettings = hasPermission(currentUser.role, 'SETTINGS_VIEW');
  const canCreateUser = hasPermission(currentUser.role, 'USER_CREATE');
  const canAssignRole = hasPermission(currentUser.role, 'ROLE_ASSIGN');
  const canUpdateSettings = hasPermission(currentUser.role, 'SETTINGS_UPDATE');

  if (!canAccessSettings) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Akses Pengaturan Ditolak</h3>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Peran Anda (<strong>{currentUser.role}</strong>) tidak memiliki izin membuka menu Pengaturan. Menu ini hanya dapat diakses oleh peran <strong>OWNER</strong> dan <strong>ADMIN</strong>.
          </p>
          <button
            onClick={onClose}
            className="mt-5 w-full py-2 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = db.createUser({
      name: newUserName,
      role: newUserRole,
      phone: newUserPhone,
      actorRole: currentUser.role
    });

    if (!result.success || !result.user) {
      setErrorMsg(result.error || 'Gagal menambahkan user');
      return;
    }

    setSuccessMsg(`Pengguna "${result.user.name}" (${result.user.role}) berhasil ditambahkan.`);
    setNewUserName('');
    setNewUserPhone('');
    setNewUserRole('KASIR');
    setShowAddUserForm(false);
  };

  const handleUpdateRole = (userId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = db.updateUserRole({
      userId,
      newRole: selectedNewRole,
      actorRole: currentUser.role
    });

    if (!result.success || !result.user) {
      setErrorMsg(result.error || 'Gagal mengubah peran pengguna');
      return;
    }

    setSuccessMsg(`Peran ${result.user.name} berhasil diperbarui menjadi ${result.user.role}.`);
    setEditingUserId(null);
  };

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = db.updateStoreInfo({
      name: storeName,
      address: storeAddress,
      phone: storePhone,
      actorRole: currentUser.role
    });

    if (!result.success || !result.store) {
      setErrorMsg(result.error || 'Gagal memperbarui info toko');
      return;
    }

    setSuccessMsg('Informasi toko berhasil disimpan.');
  };

  const handleResetToDemo = () => {
    if (confirm('Muat ulang seluruh data demo bawaan (5 Akun Role, Produk, Jurnal, dan PO)?')) {
      db.resetToSeed();
      setSuccessMsg('Database berhasil dimuat ulang ke seed demo lengkap.');
    }
  };

  const handleClearForFirstRun = () => {
    if (confirm('Bersihkan data user dan jalankan simulasi First-Run Setup Onboarding (Prompt 7 §3)?')) {
      db.clearDataForFirstRun();
      onClose();
      if (onTriggerFirstRun) {
        onTriggerFirstRun();
      }
    }
  };

  // HANDLERS GOOGLE SIGN-IN & BACKUP/RESTORE (Prompt 15)
  const canConnectGoogle = hasPermission(currentUser.role, 'GOOGLE_CONNECT');
  const canRunBackup = hasPermission(currentUser.role, 'BACKUP_RUN');
  const canRunRestore = hasPermission(currentUser.role, 'RESTORE_RUN');

  const handleConnectGoogle = async () => {
    if (!canConnectGoogle) {
      setErrorMsg('Hanya peran OWNER dan ADMIN yang diizinkan menautkan Akun Google.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsConnectingGoogle(true);

    try {
      const authResult = await googleSignIn();
      if (!authResult) {
        throw new Error('Proses login Google dibatalkan.');
      }

      const { user: fbUser } = authResult;
      const linkResult = db.linkGoogleAccount({
        googleEmail: fbUser.email || '',
        googleDisplayName: fbUser.displayName || '',
        googlePhotoUrl: fbUser.photoURL || undefined,
        actorRole: currentUser.role
      });

      if (!linkResult.success) {
        throw new Error(linkResult.error || 'Gagal menyimpan tautan Google ke IndexedDB');
      }

      setSuccessMsg(`Berhasil terhubung dengan Google: ${fbUser.email}. Izin Google Sheets & Drive aktif.`);
    } catch (err: any) {
      console.error('Google connect error:', err);
      setErrorMsg(err.message || 'Gagal menghubungkan Akun Google.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Lepaskan tautan akun Google dari aplikasi? Data cadangan yang sudah ada di Google Drive tetap aman.')) {
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await googleSignOut();
      db.unlinkGoogleAccount();
      setSuccessMsg('Tautan akun Google berhasil dilepas.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal melepaskan akun Google');
    }
  };

  const handleRunBackup = async () => {
    if (!canRunBackup) {
      setErrorMsg('Peran Anda tidak memiliki izin menjalankan Backup.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    let accessToken = await getAccessToken();
    if (!accessToken) {
      // Minta user sign-in kembali untuk mendapatkan fresh token
      try {
        const authResult = await googleSignIn();
        accessToken = authResult?.accessToken || null;
      } catch (err: any) {
        setErrorMsg('Silakan login ke Google terlebih dahulu sebelum backup: ' + err.message);
        return;
      }
    }

    if (!accessToken) {
      setErrorMsg('Token akses Google tidak tersedia.');
      return;
    }

    setIsBackingUp(true);
    try {
      const res = await executeBackupToGoogleSheets(db, accessToken);
      setSuccessMsg(`Backup sukses! Data 22 tabel berhasil dicadangkan ke Google Sheets "${res.fileName}" pada ${formatDateTimeIndo(res.exportedAt)}.`);
    } catch (err: any) {
      console.error('Backup error:', err);
      setErrorMsg(err.message || 'Gagal mencadangkan data ke Google Sheets.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleInitiateRestore = async () => {
    if (!canRunRestore) {
      setErrorMsg('Hanya peran OWNER yang memiliki izin menjalankan Restore Database.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    let accessToken = await getAccessToken();
    if (!accessToken) {
      try {
        const authResult = await googleSignIn();
        accessToken = authResult?.accessToken || null;
      } catch (err: any) {
        setErrorMsg('Silakan login ke Google terlebih dahulu sebelum restore: ' + err.message);
        return;
      }
    }

    if (!accessToken) {
      setErrorMsg('Token akses Google tidak tersedia.');
      return;
    }

    setIsLoadingRestorePreview(true);
    try {
      const preview = await fetchRestorePreview(db, accessToken);
      setRestorePreviewData(preview);
      setShowRestoreModal(true);
    } catch (err: any) {
      console.error('Fetch restore preview error:', err);
      setErrorMsg(err.message || 'Gagal membaca pratinjau backup dari Google Sheets.');
    } finally {
      setIsLoadingRestorePreview(false);
    }
  };

  const handleConfirmExecuteRestore = async () => {
    if (!restorePreviewData) return;
    setIsRestoring(true);

    try {
      // Eksekusi atomik penggantian tabel di AppDatabase
      const restoreResult = db.restoreFromSnapshot(restorePreviewData.tablesData as any, currentUser.role);
      if (!restoreResult.success) {
        throw new Error(restoreResult.error || 'Gagal menulis restore ke database lokal.');
      }

      setShowRestoreModal(false);

      // Jalankan otomatis System Health Check (§4.5)
      const report = runSystemHealthCheck(db);
      setPostRestoreHealthReport(report);

      setSuccessMsg(
        `Restore database berhasil diselesaikan! Waktu snapshot: ${formatDateTimeIndo(restorePreviewData.metadata.exportedAt)}. Sistem Health Check: ${report.overallStatus} (${report.passedCount}/${report.totalChecks} pemeriksaan lolos).`
      );
    } catch (err: any) {
      throw err;
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
              <Settings className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Pengaturan & RBAC Terpusat</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold">
                  Prompt 7
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pengelolaan pengguna, hak akses peran (RBAC), dan identitas toko
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="close-settings-modal-btn"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-slate-50 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => { setActiveTab('users'); setErrorMsg(null); setSuccessMsg(null); }}
            id="tab-settings-users-btn"
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-emerald-600 text-emerald-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Kelola Pengguna ({users.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('matrix'); setErrorMsg(null); setSuccessMsg(null); }}
            id="tab-settings-matrix-btn"
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'border-emerald-600 text-emerald-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4 text-blue-600" />
            <span>Matrix RBAC Terpusat</span>
          </button>

          <button
            onClick={() => { setActiveTab('store'); setErrorMsg(null); setSuccessMsg(null); }}
            id="tab-settings-store-btn"
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'store'
                ? 'border-emerald-600 text-emerald-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <StoreIcon className="w-4 h-4 text-purple-600" />
            <span>Identitas Toko</span>
          </button>

          <button
            onClick={() => { setActiveTab('backup'); setErrorMsg(null); setSuccessMsg(null); }}
            id="tab-settings-backup-btn"
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'backup'
                ? 'border-emerald-600 text-emerald-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-4 h-4 text-emerald-600" />
            <span>Backup & Sinkronisasi</span>
            {googleAccountLink?.isConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ml-0.5"></span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('system'); setErrorMsg(null); setSuccessMsg(null); }}
            id="tab-settings-system-btn"
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'system'
                ? 'border-emerald-600 text-emerald-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-600" />
            <span>Simulasi & Reset Data</span>
          </button>
        </div>

        {/* Notification Banners */}
        <div className="px-6 pt-3">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: KELOLA USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Header Action & Role Warning */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Daftar Akun Pengguna Toko</h3>
                  <p className="text-xs text-slate-500">
                    Pengguna aktif saat ini: <strong className="text-slate-900">{currentUser.name}</strong> ({currentUser.role})
                  </p>
                </div>

                {canCreateUser && (
                  <button
                    onClick={() => { setShowAddUserForm(!showAddUserForm); setErrorMsg(null); setSuccessMsg(null); }}
                    id="toggle-add-user-btn"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-auto shadow-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{showAddUserForm ? 'Batal Tambah' : 'Tambah Pengguna Baru'}</span>
                  </button>
                )}
              </div>

              {/* Form Tambah User */}
              {showAddUserForm && canCreateUser && (
                <form onSubmit={handleCreateUser} className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-emerald-600" />
                      Formulir Tambah Pengguna
                    </h4>
                    <span className="text-[11px] text-emerald-800">
                      Diotorisasi oleh: {currentUser.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Lengkap <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="misal: Siti Rahma"
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Peran (Role) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden bg-white font-medium"
                      >
                        {ALL_ROLES.map(r => {
                          const isOwnerOptionDisabled = r.role === 'OWNER' && currentUser.role !== 'OWNER';
                          return (
                            <option 
                              key={r.role} 
                              value={r.role}
                              disabled={isOwnerOptionDisabled}
                            >
                              {r.label} {isOwnerOptionDisabled ? '(Hanya OWNER yang berhak)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {currentUser.role !== 'OWNER' && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          Role OWNER hanya dapat dibuat jika aktor login adalah OWNER (Prompt 7 §4).
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nomor Telepon / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={newUserPhone}
                        onChange={(e) => setNewUserPhone(e.target.value)}
                        placeholder="misal: 0812-9988-7766"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddUserForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      id="save-new-user-btn"
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                    >
                      Simpan Pengguna
                    </button>
                  </div>
                </form>
              )}

              {/* Table / List Users */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Pengguna</th>
                      <th className="py-3 px-4">Role Saat Ini</th>
                      <th className="py-3 px-4">Kontak</th>
                      <th className="py-3 px-4 text-right">Aksi Ubah Role (ROLE_ASSIGN)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => {
                      const isCurrent = currentUser.id === user.id;
                      const isEditing = editingUserId === user.id;
                      const roleConfig = ALL_ROLES.find(r => r.role === user.role);

                      return (
                        <tr key={user.id} className={`hover:bg-slate-50/80 ${isCurrent ? 'bg-emerald-50/30' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                                  Anda
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{user.id}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleConfig?.color || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                              {user.role}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-600">
                            {user.phone || '-'}
                          </td>

                          <td className="py-3 px-4 text-right">
                            {canAssignRole ? (
                              isEditing ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <select
                                    value={selectedNewRole}
                                    onChange={(e) => setSelectedNewRole(e.target.value as UserRole)}
                                    className="px-2 py-1 rounded border border-slate-300 text-xs bg-white font-medium"
                                  >
                                    {ALL_ROLES.map(r => (
                                      <option key={r.role} value={r.role}>
                                        {r.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleUpdateRole(user.id)}
                                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                    title="Simpan Role Baru"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingUserId(null)}
                                    className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs"
                                    title="Batal"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingUserId(user.id);
                                    setSelectedNewRole(user.role);
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 text-xs font-medium transition"
                                >
                                  Ubah Role
                                </button>
                              )
                            ) : (
                              <div className="text-[11px] text-slate-400 italic flex items-center justify-end gap-1" title="Hanya OWNER yang boleh ubah role (ROLE_ASSIGN)">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>Khusus OWNER</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* RBAC Info Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Kebijakan Keamanan Akun & Hak Akses:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] pl-1">
                  <li><strong>OWNER</strong>: Memiliki hak penuh menambah user, mengubah role pengguna, dan otorisasi toko.</li>
                  <li><strong>ADMIN</strong>: Dapat menambah akun kasir/gudang/bookkeeper, namun <strong>dilarang mengubah role pengguna lain</strong> untuk mencegah <em>privilege escalation</em> (Prompt 7 §4).</li>
                  <li>Penggantian peran secara langsung memperbarui matriks izin saat switcher pengguna dipilih.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: MATRIX RBAC TERPUSAT */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 text-xs text-blue-950">
                <h3 className="font-bold text-sm mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  Matriks Hak Akses Terpusat (RBAC Single Source of Truth)
                </h3>
                <p className="leading-relaxed text-blue-900/90 text-[11px]">
                  Tabel ini bersumber langsung dari <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">RBAC_MATRIX</code> di sistem. Seluruh komponen (Kasir, PO Beli, Penerimaan Barang, Piutang, Jurnal, dan Pengaturan) mengonsumsi fungsi terpusat <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">hasPermission(role, action)</code> dengan kebijakan <em>fallback-deny</em>.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-slate-200">Aksi / Fitur</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-center bg-purple-50 text-purple-900">OWNER</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-center bg-blue-50 text-blue-900">ADMIN</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-center bg-amber-50 text-amber-900">BOOKKEEPER</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-center bg-emerald-50 text-emerald-900">KASIR</th>
                      <th className="py-2.5 px-3 text-center bg-orange-50 text-orange-900">GUDANG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(Object.keys(RBAC_MATRIX) as RbacAction[]).map((action) => {
                      const allowedRoles = RBAC_MATRIX[action];
                      const isOwnerAllowed = allowedRoles.includes('OWNER');
                      const isAdminAllowed = allowedRoles.includes('ADMIN');
                      const isBookkeeperAllowed = allowedRoles.includes('BOOKKEEPER');
                      const isKasirAllowed = allowedRoles.includes('KASIR');
                      const isGudangAllowed = allowedRoles.includes('GUDANG');

                      return (
                        <tr key={action} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-slate-800 text-[11px]">
                            {action}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-center">
                            {isOwnerAllowed ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-center">
                            {isAdminAllowed ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-center">
                            {isBookkeeperAllowed ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-center">
                            {isKasirAllowed ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {isGudangAllowed ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: IDENTITAS TOKO */}
          {activeTab === 'store' && (
            <form onSubmit={handleSaveStore} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Toko Sembako <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  disabled={!canUpdateSettings}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden bg-white disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Toko
                </label>
                <textarea
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  disabled={!canUpdateSettings}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden bg-white disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Telepon Toko
                </label>
                <input
                  type="text"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  disabled={!canUpdateSettings}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden bg-white disabled:bg-slate-100"
                />
              </div>

              {canUpdateSettings ? (
                <button
                  type="submit"
                  id="save-store-btn"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                >
                  Simpan Perubahan Identitas Toko
                </button>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Hanya peran OWNER dan ADMIN yang diizinkan mengubah informasi toko.
                </p>
              )}
            </form>
          )}

          {/* TAB 4: SIMULASI & RESET (DEV TOOL) */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  Pengujian Skenario First-Run Setup (Prompt 7 §3)
                </h4>
                <p className="text-xs text-amber-900/90 leading-relaxed">
                  Gunakan tombol di bawah untuk membersihkan tabel pengguna dan mensimulasikan kondisi aplikasi yang baru pertama kali diinstal (fresh install / clear data). Aplikasi akan langsung beralih ke <strong>FirstRunSetupScreen</strong> untuk membuat akun OWNER pertama.
                </p>
                <button
                  onClick={handleClearForFirstRun}
                  id="clear-users-first-run-btn"
                  className="mt-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Uji First-Run Setup (Bersihkan Data User)</span>
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-slate-700" />
                  Reset ke Data Demo Bawaan
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Memuat kembali 5 akun user bawaan (Pak Budi - Owner, Bu Siti - Admin, Mas Doni - Kasir, Pak Joko - Gudang, Bu Rini - Bookkeeper), katalog sembako, dan saldo awal akuntansi.
                </p>
                <button
                  onClick={handleResetToDemo}
                  id="reset-demo-data-btn"
                  className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-2 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Ulang Seed Demo Lengkap</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: BACKUP & SINKRONISASI KE GOOGLE SHEETS (Prompt 15) */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Bagian Status Akun Google */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-emerald-600" />
                      Tautan Akun Google & Otorisasi
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Menghubungkan akun Google untuk izin akses Google Sheets & Google Drive (drive.file scope)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {googleAccountLink?.isConnected ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1.5 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Terhubung ke Google
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200">
                        Belum Terhubung
                      </span>
                    )}
                  </div>
                </div>

                {googleAccountLink?.isConnected ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {googleAccountLink.googlePhotoUrl ? (
                        <img 
                          src={googleAccountLink.googlePhotoUrl} 
                          alt="Google Avatar" 
                          className="w-10 h-10 rounded-full border border-slate-300"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow-2xs">
                          {googleAccountLink.googleDisplayName?.charAt(0) || 'G'}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          {googleAccountLink.googleDisplayName || 'Akun Google'}
                        </div>
                        <div className="text-slate-600 text-[11px] font-mono">
                          {googleAccountLink.googleEmail}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Tertaut sejak: {googleAccountLink.connectedAt ? formatDateTimeIndo(googleAccountLink.connectedAt) : '-'}
                        </div>
                      </div>
                    </div>
                    {canConnectGoogle && (
                      <button
                        onClick={handleDisconnectGoogle}
                        id="disconnect-google-btn"
                        className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Putuskan Akun</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                    <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                      Hubungkan akun Google Toko untuk mengaktifkan pencadangan manual ke <strong>Google Sheets</strong> di Google Drive Anda. Identitas Google terpisah dari penetapan peran kasir/admin.
                    </p>
                    {canConnectGoogle ? (
                      <div className="flex justify-center">
                        {/* Official Sign In with Google styled button */}
                        <button
                          onClick={handleConnectGoogle}
                          disabled={isConnectingGoogle}
                          id="connect-google-btn"
                          className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs flex items-center gap-3 transition cursor-pointer disabled:opacity-60"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          </svg>
                          <span>{isConnectingGoogle ? 'Menghubungkan...' : 'Masuk dengan Akun Google'}</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-700 italic">
                        Hanya peran OWNER dan ADMIN yang memiliki izin menghubungkan akun Google.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Status File Backup di Google Drive */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Berkas Cadangan Google Sheets
                  </h3>
                  {backupConfig?.fileId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${backupConfig.fileId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 underline"
                    >
                      <span>Buka di Google Sheets</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">Nama File & ID</span>
                    <span className="font-bold text-slate-800 truncate block" title={backupConfig?.fileName || 'Backup Omah Sembako Sehati'}>
                      {backupConfig?.fileName || `Backup Omah Sembako Sehati — ${store?.name || 'Omah Sembako Sehati'}`}
                    </span>
                    {backupConfig?.fileId && (
                      <span className="text-[10px] text-slate-500 font-mono block truncate" title={backupConfig.fileId}>
                        ID: {backupConfig.fileId.slice(0, 12)}...
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">Akun Google Sinkronisasi</span>
                    <span className="font-bold text-slate-800 truncate block" title={backupConfig?.googleEmail || googleAccountLink?.googleEmail || 'Belum tertaut'}>
                      {backupConfig?.googleEmail || googleAccountLink?.googleEmail || 'Belum tertaut'}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium block">
                      Status Global (Lintas Peran)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">Versi Skema</span>
                    <span className="font-bold text-slate-800">
                      v{backupConfig?.schemaVersion || 1} (22 Tabel Entitas)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">Terakhir Dicadangkan</span>
                    <span className="font-bold text-slate-800">
                      {backupConfig?.lastBackupAt ? formatDateTimeIndo(backupConfig.lastBackupAt) : 'Belum pernah backup'}
                    </span>
                  </div>
                </div>

                {/* Tombol Aksi Backup & Restore */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Kartu Backup */}
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                        <CloudUpload className="w-4 h-4 text-emerald-600" />
                        Pencadangan Manual (Backup)
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                        OWNER & ADMIN
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                      Mencadangkan snapshot 22 tabel IndexedDB lengkap ke Google Sheets (termasuk produk, saldo batch FIFO, jurnal akuntansi, dan piutang).
                    </p>
                    <button
                      onClick={handleRunBackup}
                      disabled={isBackingUp || !googleAccountLink?.isConnected || !canRunBackup}
                      id="run-backup-now-btn"
                      className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!canRunBackup ? 'Akses dibatasi: Hanya OWNER dan ADMIN yang dapat menjalankan backup' : !googleAccountLink?.isConnected ? 'Hubungkan akun Google terlebih dahulu' : 'Cadangkan database ke Google Sheets'}
                    >
                      {isBackingUp ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengekspor ke Google Sheets...</span>
                        </>
                      ) : (
                        <>
                          <CloudUpload className="w-3.5 h-3.5" />
                          <span>Backup Sekarang</span>
                        </>
                      )}
                    </button>
                    {!canRunBackup && (
                      <p className="text-[10px] text-amber-700 mt-1 text-center font-medium">
                        * Tombol ini hanya dapat diakses oleh peran OWNER & ADMIN
                      </p>
                    )}
                  </div>

                  {/* Kartu Restore */}
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-rose-950 flex items-center gap-1.5">
                        <CloudDownload className="w-4 h-4 text-rose-600" />
                        Pemulihan Data (Restore)
                      </span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-bold">
                        HANYA OWNER
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-900/80 leading-relaxed">
                      Membaca Google Sheets, menampilkan pratinjau perbandingan jumlah baris per entitas, dan menimpa database setelah konfirmasi dialog eksplisit.
                    </p>
                    <button
                      onClick={handleInitiateRestore}
                      disabled={isLoadingRestorePreview || !googleAccountLink?.isConnected || !canRunRestore}
                      id="initiate-restore-btn"
                      className="w-full mt-2 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!canRunRestore ? 'Akses dibatasi: Hanya OWNER yang dapat menjalankan restore database' : !googleAccountLink?.isConnected ? 'Hubungkan akun Google terlebih dahulu' : 'Buka dialog konfirmasi restore data'}
                    >
                      {isLoadingRestorePreview ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Membaca Berkas Cadangan...</span>
                        </>
                      ) : (
                        <>
                          <CloudDownload className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </>
                      )}
                    </button>
                    {!canRunRestore && (
                      <p className="text-[10px] text-rose-700 mt-1 text-center font-medium">
                        * Tombol ini hanya dapat diakses oleh peran OWNER
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Laporan Post-Restore System Health Check */}
              {postRestoreHealthReport && (
                <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Hasil System Health Check Pasca-Restore</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      postRestoreHealthReport.overallStatus === 'PASS' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      Status: {postRestoreHealthReport.overallStatus} ({postRestoreHealthReport.passedCount}/{postRestoreHealthReport.totalChecks})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {postRestoreHealthReport.items.map((item, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-between">
                        <span className="text-slate-300 truncate pr-2">{item.name}</span>
                        <span className={`font-bold shrink-0 ${item.status === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prinsip Desain & Batasan Teknis (§1) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px] text-slate-600">
                <span className="font-bold text-slate-800 block text-xs">Ketentuan Desain (Prompt 15):</span>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>IndexedDB tetap satu-satunya sumber kebenaran operasional:</strong> Google Sheets hanya berperan sebagai cermin/cadangan. Aplikasi tetap bekerja 100% secara offline tanpa internet.</li>
                  <li><strong>Identitas Google terpisah dari Peran ERP:</strong> Akun Google hanya untuk otorisasi Google Drive/Sheets. Hak akses pengguna diatur lewat menu Pengguna.</li>
                  <li><strong>Tidak ada sinkronisasi otomatis latar belakang:</strong> Pencadangan dan pemulihan murni dijalankan secara manual oleh pengguna.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Restore Preview Modal Component */}
        {restorePreviewData && (
          <RestorePreviewModal
            isOpen={showRestoreModal}
            onClose={() => setShowRestoreModal(false)}
            previewData={restorePreviewData}
            onConfirmRestore={handleConfirmExecuteRestore}
            isRestoring={isRestoring}
          />
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Omah Sembako Sehati • Native Android ERP System</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-200 font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
