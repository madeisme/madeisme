import React, { useState } from 'react';
import { CashSession, User } from '../../types/erp';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { db } from '../../database/appDatabase';
import { 
  History, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Lock, 
  User as UserIcon, 
  Banknote,
  Search,
  FileText
} from 'lucide-react';

interface CashSessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSelectSessionToClose?: (session: CashSession) => void;
}

export const CashSessionHistoryModal: React.FC<CashSessionHistoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectSessionToClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  if (!isOpen) return null;

  const sessions = db.getAllCashSessions();
  const users = db.getAllUsers();

  const filteredSessions = sessions.filter((s) => {
    const user = users.find((u) => u.id === s.userId);
    const userName = user?.name.toLowerCase() || '';
    const matchesSearch = 
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userName.includes(searchTerm.toLowerCase()) ||
      (s.notes && s.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Riwayat Sesi Kasir (Shift)</h2>
              <p className="text-xs text-slate-300">Daftar rekonsiliasi dan log modal awal kasir</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari ID sesi, kasir, atau catatan..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-medium">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({sessions.length})
            </button>
            <button
              onClick={() => setStatusFilter('OPEN')}
              className={`px-3 py-1 rounded-lg transition ${
                statusFilter === 'OPEN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Aktif ({sessions.filter((s) => s.status === 'OPEN').length})
            </button>
            <button
              onClick={() => setStatusFilter('CLOSED')}
              className={`px-3 py-1 rounded-lg transition ${
                statusFilter === 'CLOSED'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Selesai ({sessions.filter((s) => s.status === 'CLOSED').length})
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Banknote className="w-12 h-12 mx-auto mb-2 stroke-1 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Tidak ada sesi kasir ditemukan</p>
              <p className="text-xs text-slate-400 mt-0.5">Buka sesi baru di layar kasir untuk memulai pencatatan shift.</p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const sessionUser = users.find((u) => u.id === session.userId);
              const isClosed = session.status === 'CLOSED';
              const hasVariance = session.variance !== undefined && session.variance !== 0;

              return (
                <div
                  key={session.id}
                  className={`border rounded-xl p-4 transition-all ${
                    isClosed
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      : 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{session.id}</span>
                        {isClosed ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-full border border-slate-300">
                            CLOSED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full border border-emerald-300 flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            OPEN (SEDANG AKTIF)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          {sessionUser?.name || session.userId} ({sessionUser?.role || 'KASIR'})
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Buka: {formatDateTimeIndo(session.openedAt)}
                        </span>
                      </div>
                    </div>

                    {!isClosed && onSelectSessionToClose && (
                      <button
                        onClick={() => onSelectSessionToClose(session)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        Tutup Sesi Ini
                      </button>
                    )}
                  </div>

                  {/* Ringkasan Angka Rekonsiliasi */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Modal Awal:</span>
                      <span className="font-semibold text-slate-800">{formatRupiah(session.openingFloat)}</span>
                    </div>

                    {isClosed ? (
                      <>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Sistem Seharusnya:</span>
                          <span className="font-semibold text-slate-800">
                            {formatRupiah(session.systemExpectedCash || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Hitung Fisik:</span>
                          <span className="font-semibold text-slate-800">
                            {formatRupiah(session.actualCash || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Selisih:</span>
                          <span className={`font-black ${
                            session.variance === 0
                              ? 'text-emerald-600'
                              : (session.variance || 0) < 0
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}>
                            {session.variance === 0 
                              ? 'Pas (Rp 0)' 
                              : `${(session.variance || 0) > 0 ? '+' : ''}${formatRupiah(session.variance || 0)}`}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-3 text-emerald-700 italic flex items-center text-[11px]">
                        Sedang berjalan — perhitungan rekonsiliasi akan dikalkulasi saat kasir menutup shift.
                      </div>
                    )}
                  </div>

                  {/* Catatan & Info Jurnal Selisih */}
                  {(session.notes || session.journalId || session.closedAt) && (
                    <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                      <div className="flex items-center gap-2">
                        {session.closedAt && (
                          <span>Tutup: {formatDateTimeIndo(session.closedAt)}</span>
                        )}
                        {session.notes && (
                          <span className="italic">“{session.notes}”</span>
                        )}
                      </div>

                      {session.journalId && (
                        <div className="flex items-center gap-1 font-mono text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          <FileText className="w-3 h-3" />
                          <span>Jurnal Selisih Kas: {session.journalId}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition"
          >
            Tutup Jendela
          </button>
        </div>
      </div>
    </div>
  );
};
