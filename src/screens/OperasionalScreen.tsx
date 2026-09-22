import React, { useState, useMemo } from 'react';
import { useAppDatabase } from '../database/useAppDatabase';
import { hasPermission, UserAction } from '../rbac/permissions';
import { ArSettlementModal } from '../components/ar/ArSettlementModal';
import { SystemHealthCheckView } from '../components/diagnostics/SystemHealthCheckView';
import { AuditForensicAZView } from '../components/diagnostics/AuditForensicAZView';
import { PengeluaranOperasionalView } from '../components/operasional/PengeluaranOperasionalView';
import { JurnalUmumView } from '../components/operasional/JurnalUmumView';
import { runSystemHealthCheck } from '../utils/systemHealthCheck';
import { runAuditForensicAZ } from '../utils/auditForensicAZ';
import { formatRupiah } from '../utils/formatters';
import { 
  ClipboardCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  UserCheck,
  Lock,
  Unlock,
  Layers,
  ArrowRight,
  Coins,
  Activity,
  ListTodo,
  Fingerprint,
  Receipt,
  Scale,
  BookOpen
} from 'lucide-react';
import { UserRole } from '../types/erp';

interface OperasionalScreenProps {
  onOpenInspector?: () => void;
  defaultSubTab?: 'tugas' | 'jurnal_umum' | 'pengeluaran' | 'health_check' | 'forensic_az';
}

export const OperasionalScreen: React.FC<OperasionalScreenProps> = ({ 
  onOpenInspector,
  defaultSubTab = 'tugas'
}) => {
  const { currentUser, db, customers, sales, inventoryLayers, journals, cashSessions, purchases, suppliers, operationalExpenses, generalJournals } = useAppDatabase();
  const [activeSubTab, setActiveSubTab] = useState<'tugas' | 'jurnal_umum' | 'pengeluaran' | 'health_check' | 'forensic_az'>(defaultSubTab);
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser.role);
  const [showArModal, setShowArModal] = useState(false);

  // Quick check for health check badge
  const healthReport = useMemo(() => {
    return runSystemHealthCheck(db);
  }, [db, sales, inventoryLayers, journals, cashSessions, purchases, customers, suppliers]);

  // Quick check for forensic audit badge
  const forensicReport = useMemo(() => {
    return runAuditForensicAZ(db);
  }, [db, sales, inventoryLayers, journals, cashSessions, purchases, customers, suppliers]);
  const [tasks, setTasks] = useState([
    {
      id: 'TSK-01',
      title: 'Restok Telur Ayam Ras',
      description: 'Persediaan tersisa 4 kg di bawah ambang batas minimum (10 kg). Buat Purchase Order ke peternak Blitar.',
      priority: 'TINGGI',
      status: 'TERBUKA',
      assignedRole: 'GUDANG' as UserRole
    },
    {
      id: 'TSK-02',
      title: 'Verifikasi Fisik FIFO Beras Rojolele (Batch INV-002)',
      description: 'Pastikan karung beras batch tertua diletakkan di rak depan agar terjual lebih dulu.',
      priority: 'SEDANG',
      status: 'TERBUKA',
      assignedRole: 'GUDANG' as UserRole
    },
    {
      id: 'TSK-03',
      title: 'Jadwal Pembayaran Hutang Supplier PT Sinar Pangan',
      description: 'Saldo AP sebesar Rp 2.400.000 akan jatuh tempo pada tanggal 20 Sep 2026.',
      priority: 'SEDANG',
      status: 'TERBUKA',
      assignedRole: 'BOOKKEEPER' as UserRole
    },
    {
      id: 'TSK-04',
      title: 'Pemeriksaan Tutup Kasir & Selisih Kas Tunai',
      description: 'Lakukan pencocokan uang tunai di laci kasir dengan total penjualan sebelum pergantian shift.',
      priority: 'NORMAL',
      status: 'SELESAI',
      assignedRole: 'KASIR' as UserRole
    }
  ]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, status: t.status === 'SELESAI' ? 'TERBUKA' : 'SELESAI' };
      }
      return t;
    }));
  };

  const actionList: { action: UserAction; label: string; description: string }[] = [
    { action: 'VIEW_DASHBOARD', label: 'Lihat Ringkasan Dashboard', description: 'Melihat ringkasan data omzet dan stok toko' },
    { action: 'VIEW_REPORTS', label: 'Lihat Laporan Keuangan (Prompt 6)', description: 'Akses Buku Besar, Neraca Saldo, Laba Rugi, Neraca, & Kartu Stok (Owner, Admin, Bookkeeper)' },
    { action: 'CREATE_SALE', label: 'Proses Transaksi Kasir', description: 'Membuat struk penjualan tunai dan kredit' },
    { action: 'SETTLE_AR', label: 'Pelunasan Piutang (AR)', description: 'Menerima pembayaran piutang dan auto-balance jurnal kas/piutang' },
    { action: 'VOID_SALE', label: 'Void / Pembatalan Transaksi', description: 'Membatalkan penjualan yang sudah dicatat' },
    { action: 'VIEW_COST_HPP', label: 'Lihat Nilai HPP / Margin Laba', description: 'Melihat rincian harga beli modal barang' },
    { action: 'MANAGE_STOCK', label: 'Kelola Stok & FIFO Layers', description: 'Menambah produk, opname, dan cek batch' },
    { action: 'RECEIVE_PO', label: 'Penerimaan Barang (Goods Receipt)', description: 'Menerima pasokan baru dari supplier' },
    { action: 'VIEW_JOURNAL', label: 'Lihat Jurnal Akuntansi', description: 'Audit debit/kredit dan buku besar' },
    { action: 'MANAGE_ACCOUNTS', label: 'Kelola Chart of Accounts (COA)', description: 'Menambah dan menyusun akun keuangan' },
    { action: 'MANAGE_USERS', label: 'Kelola Pengguna & Hak Akses', description: 'Menambah staf dan mengatur role pengguna' },
  ];

  const roles: UserRole[] = ['OWNER', 'ADMIN', 'BOOKKEEPER', 'KASIR', 'GUDANG'];

  const totalAr = customers.reduce((sum, c) => sum + c.arBalance, 0);
  const customersWithArCount = customers.filter(c => c.arBalance > 0).length;

  return (
    <div className="p-4 sm:p-5 space-y-5 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-emerald-600" />
          <span>Operasional & Integritas Sistem</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Tugas Harian, Validasi Akses Peran (RBAC), & Audit Kesehatan ERP Otomatis
        </p>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center p-1 bg-slate-200/80 rounded-xl border border-slate-300/80 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('tugas')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
            activeSubTab === 'tugas'
              ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ListTodo className="w-4 h-4 text-emerald-700" />
          <span>Tugas & Akses RBAC</span>
        </button>

        <button
          onClick={() => setActiveSubTab('jurnal_umum')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
            activeSubTab === 'jurnal_umum'
              ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Scale className="w-4 h-4 text-indigo-600" />
          <span className="flex items-center gap-1">
            Jurnal Umum (Non-Kasir)
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-indigo-100 text-indigo-800">
              {generalJournals.length}
            </span>
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('pengeluaran')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
            activeSubTab === 'pengeluaran'
              ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4 text-rose-600" />
          <span className="flex items-center gap-1">
            Pengeluaran Operasional
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-rose-100 text-rose-800">
              {operationalExpenses.length}
            </span>
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('health_check')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
            activeSubTab === 'health_check'
              ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-700" />
          <span className="flex items-center gap-1">
            Health Check
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              healthReport.overallStatus === 'PASS'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800 animate-pulse'
            }`}>
              {healthReport.passedCount}/{healthReport.totalChecks}
            </span>
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('forensic_az')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
            activeSubTab === 'forensic_az'
              ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Fingerprint className="w-4 h-4 text-teal-700" />
          <span className="flex items-center gap-1">
            Audit Forensik A–Z
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              forensicReport.overallStatus === 'PASS'
                ? 'bg-emerald-100 text-emerald-800'
                : forensicReport.overallStatus === 'WARN'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800 animate-pulse'
            }`}>
              {forensicReport.passedCount}/{forensicReport.totalChecks}
            </span>
          </span>
        </button>
      </div>

      {/* VIEW 1: HEALTH CHECK */}
      {activeSubTab === 'health_check' ? (
        <SystemHealthCheckView 
          onOpenInspector={onOpenInspector} 
          onSwitchToForensic={() => setActiveSubTab('forensic_az')}
        />
      ) : activeSubTab === 'forensic_az' ? (
        /* VIEW 2: AUDIT FORENSIK A–Z */
        <AuditForensicAZView onOpenInspector={onOpenInspector} />
      ) : activeSubTab === 'jurnal_umum' ? (
        /* VIEW 3: JURNAL UMUM (NON-KASIR) */
        <JurnalUmumView />
      ) : activeSubTab === 'pengeluaran' ? (
        /* VIEW 4: PENGELUARAN OPERASIONAL */
        <PengeluaranOperasionalView />
      ) : (
        /* VIEW 5: TUGAS & RBAC */
        <>
          {/* Quick Action Grid: AR Settlement, Pengeluaran Operasional, & Jurnal Umum */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* AR Quick Action Card */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-100">
                  <Coins className="w-4 h-4" />
                  <span>Piutang Usaha (AR)</span>
                </div>
                <p className="text-lg font-bold mt-1 font-mono">{formatRupiah(totalAr)}</p>
                <p className="text-[11px] text-amber-100/90 mt-0.5">
                  {customersWithArCount} pelanggan aktif
                </p>
              </div>
              <button
                onClick={() => setShowArModal(true)}
                className="px-3 py-2 bg-white text-amber-900 hover:bg-amber-50 rounded-xl font-bold text-xs transition shadow-2xs flex items-center gap-1.5 shrink-0"
              >
                <span>Pelunasan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Jurnal Umum Non-Kasir Quick Action Card */}
            <div className="bg-gradient-to-r from-indigo-800 to-indigo-950 text-white rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-200">
                  <Scale className="w-4 h-4" />
                  <span>Jurnal Umum (Non-Kasir)</span>
                </div>
                <p className="text-lg font-bold mt-1 font-mono">
                  {generalJournals.length} Transaksi
                </p>
                <p className="text-[11px] text-indigo-200/90 mt-0.5">
                  Modal, sewa, listrik & beban
                </p>
              </div>
              <button
                onClick={() => setActiveSubTab('jurnal_umum')}
                className="px-3 py-2 bg-white text-indigo-950 hover:bg-indigo-50 rounded-xl font-bold text-xs transition shadow-2xs flex items-center gap-1.5 shrink-0"
              >
                <span>Buka Jurnal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pengeluaran Operasional Quick Action Card */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
                  <Receipt className="w-4 h-4" />
                  <span>Biaya Operasional</span>
                </div>
                <p className="text-lg font-bold mt-1 font-mono">
                  {formatRupiah(operationalExpenses.reduce((s, e) => s + e.amount, 0))}
                </p>
                <p className="text-[11px] text-emerald-100/90 mt-0.5">
                  {operationalExpenses.length} catatan biaya kas
                </p>
              </div>
              <button
                onClick={() => setActiveSubTab('pengeluaran')}
                className="px-3 py-2 bg-white text-emerald-950 hover:bg-emerald-50 rounded-xl font-bold text-xs transition shadow-2xs flex items-center gap-1.5 shrink-0"
              >
                <span>Kelola Biaya</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

      {/* Daily Tasks & Exceptions */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Daftar Tugas Prioritas
          </h3>
          <span className="text-[11px] text-slate-400">
            {tasks.filter(t => t.status === 'SELESAI').length} dari {tasks.length} selesai
          </span>
        </div>

        <div className="space-y-2">
          {tasks.map(task => {
            const isDone = task.status === 'SELESAI';
            return (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 select-none ${
                  isDone 
                    ? 'bg-slate-50 border-slate-200 opacity-60' 
                    : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition ${
                  isDone 
                    ? 'bg-emerald-600 border-emerald-600 text-white' 
                    : 'border-slate-300 hover:border-emerald-500'
                }`}>
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      task.priority === 'TINGGI'
                        ? 'bg-red-100 text-red-800'
                        : task.priority === 'SEDANG'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {task.priority}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      Role: {task.assignedRole}
                    </span>
                    <h4 className={`text-xs font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                      {task.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {task.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RBAC Verification Matrix §5 */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Uji Matriks Hak Akses (RBAC hasPermission)
              </h3>
              <p className="text-[10px] text-slate-500">
                Evaluasi izin aksi bisnis berdasarkan 5 peran pengguna
              </p>
            </div>
          </div>

          {/* Role selector for test */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs overflow-x-auto">
            {roles.map(r => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                  selectedRole === r
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {actionList.map(item => {
            const allowed = hasPermission(selectedRole, item.action);
            return (
              <div key={item.action} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-slate-800 text-xs truncate">
                    {item.label}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {item.description}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  {allowed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <Unlock className="w-3 h-3" />
                      <span>Diizinkan</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                      <Lock className="w-3 h-3" />
                      <span>Dibatasi</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}

      {/* AR SETTLEMENT MODAL (Prompt 4) */}
      {showArModal && (
        <ArSettlementModal
          isOpen={showArModal}
          onClose={() => setShowArModal(false)}
        />
      )}
    </div>
  );
};
