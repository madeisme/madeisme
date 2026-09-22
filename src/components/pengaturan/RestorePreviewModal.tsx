import React, { useState } from 'react';
import { BackupPreviewData, TableDiff } from '../../services/googleBackupService';
import { 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  FileSpreadsheet, 
  Layers, 
  ArrowRight, 
  ShieldAlert, 
  Clock, 
  Store as StoreIcon,
  RefreshCw
} from 'lucide-react';
import { formatDateTimeIndo } from '../../utils/formatters';

interface RestorePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: BackupPreviewData;
  onConfirmRestore: () => Promise<void>;
  isRestoring: boolean;
}

export const RestorePreviewModal: React.FC<RestorePreviewModalProps> = ({
  isOpen,
  onClose,
  previewData,
  onConfirmRestore,
  isRestoring
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfirmationMatched = confirmationInput.trim().toUpperCase() === 'RESTORE';

  const handleExecute = async () => {
    if (!isConfirmationMatched) {
      setErrorMessage('Ketik kata "RESTORE" dengan tepat di kolom konfirmasi di bawah!');
      return;
    }
    setErrorMessage(null);
    try {
      await onConfirmRestore();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengeksekusi restore data.');
    }
  };

  const totalBackupRecords = previewData.diffs.reduce((sum, d) => sum + d.backupCount, 0);
  const totalCurrentRecords = previewData.diffs.reduce((sum, d) => sum + d.currentCount, 0);
  const netDiff = totalBackupRecords - totalCurrentRecords;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-rose-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Berbahaya */}
        <div className="px-6 py-4 bg-rose-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-800/80 border border-rose-600">
              <AlertTriangle className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Pratinjau & Konfirmasi Restore Database</h2>
                <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-200 text-[10px] font-bold">
                  Destruktif
                </span>
              </div>
              <p className="text-xs text-rose-100/90">
                Pemeriksaan perbandingan data sebelum menimpa database lokal
              </p>
            </div>
          </div>
          {!isRestoring && (
            <button
              onClick={onClose}
              id="close-restore-preview-btn"
              className="p-1.5 rounded-lg text-rose-200 hover:text-white hover:bg-rose-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-slate-800 text-xs">
          {/* Metadata Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">Sumber File Backup</span>
              <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                {previewData.fileName}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">Waktu Snapshot Backup</span>
              <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                {previewData.metadata.exportedAt ? formatDateTimeIndo(previewData.metadata.exportedAt) : '-'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">Toko Penerbit</span>
              <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                <StoreIcon className="w-3.5 h-3.5 text-purple-600" />
                {previewData.metadata.storeName || 'Omah Sembako Sehati'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">Status Skema</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Skema v{previewData.metadata.schemaVersion} (Kompatibel)
              </span>
            </div>
          </div>

          {/* Ringkasan Perbedaan Data */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Peringatan Perubahan Data:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-900/90">
              Total seluruh record di backup: <strong>{totalBackupRecords} baris</strong> vs data saat ini di IndexedDB: <strong>{totalCurrentRecords} baris</strong>.
              {netDiff > 0 && ` Restore akan MENAMBAH netto +${netDiff} record data.`}
              {netDiff < 0 && ` Restore akan MENGHAPUS/MENGURANGI netto ${Math.abs(netDiff)} record data yang dibuat setelah backup terakhir.`}
              {netDiff === 0 && ' Total record keseluruhan persis seimbang.'}
            </p>
          </div>

          {/* Tabel Perbandingan Detail */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100 px-3.5 py-2 font-bold text-[11px] text-slate-700 border-b border-slate-200 flex items-center justify-between">
              <span>Perbandingan Entitas Tabel</span>
              <span>Cadangan (Sheets) vs Live (IndexedDB)</span>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
              {previewData.diffs.map((diff) => (
                <div key={diff.tableName} className="px-3.5 py-2 flex items-center justify-between hover:bg-slate-50">
                  <div className="font-medium text-slate-800">
                    {diff.label}
                    <span className="text-[10px] text-slate-400 font-mono ml-1.5">({diff.tableName})</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-slate-500">{diff.currentCount} live</span>
                    <ArrowRight className="w-3 h-3 text-slate-300" />
                    <span className="font-bold text-slate-900">{diff.backupCount} backup</span>
                    {diff.diff !== 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold ${
                        diff.diff > 0 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {diff.diff > 0 ? `+${diff.diff}` : diff.diff}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Konfirmasi Eksplisit Ketik "RESTORE" (§4.4) */}
          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2.5">
            <label htmlFor="confirm-restore-input" className="block text-xs font-bold text-rose-900">
              Konfirmasi Eksplisit: Ketik kata <span className="font-mono bg-rose-200/80 px-1.5 py-0.5 rounded-sm text-rose-900">RESTORE</span> untuk mengeksekusi
            </label>
            <input
              type="text"
              id="confirm-restore-input"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="Ketik RESTORE di sini..."
              disabled={isRestoring}
              className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-sm font-mono tracking-wider text-rose-950 focus:outline-rose-600 focus:ring-1 focus:ring-rose-500"
            />
            <p className="text-[10px] text-rose-700">
              Tindakan ini akan menimpa seluruh data operasional saat ini. Setelah restore, sistem akan otomatis menjalankan System Health Check untuk memvalidasi integritas.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-200 text-xs font-bold transition disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleExecute}
            id="execute-restore-confirm-btn"
            disabled={!isConfirmationMatched || isRestoring}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              isConfirmationMatched && !isRestoring
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-200 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isRestoring ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memulihkan Data...</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span>Eksekusi Restore Database</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
