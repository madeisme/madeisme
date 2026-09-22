import React from 'react';
import { Journal, JournalLine, Account } from '../../types/erp';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { X, CheckCircle2, BookOpen, Layers, ArrowRight } from 'lucide-react';

interface JournalDrilldownModalProps {
  isOpen: boolean;
  journal: Journal | null;
  allLines: JournalLine[];
  accounts: Account[];
  onClose: () => void;
}

export const JournalDrilldownModal: React.FC<JournalDrilldownModalProps> = ({
  isOpen,
  journal,
  allLines,
  accounts,
  onClose
}) => {
  if (!isOpen || !journal) return null;

  const lines = allLines.filter(l => l.journalId === journal.id);
  const totalDebit = lines.filter(l => l.side === 'DEBIT').reduce((sum, l) => sum + l.amount, 0);
  const totalCredit = lines.filter(l => l.side === 'CREDIT').reduce((sum, l) => sum + l.amount, 0);
  const isBalanced = totalDebit === totalCredit;

  const getAccountName = (code: string) => {
    const acc = accounts.find(a => a.code === code);
    return acc ? acc.name : code;
  };

  const getAccountType = (code: string) => {
    const acc = accounts.find(a => a.code === code);
    return acc ? acc.type : '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Rincian Bukti Catatan Jurnal</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {journal.id} • {formatDateIndo(journal.businessDate)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Jenis Transaksi</span>
              <span className="font-bold text-slate-900">{journal.refType}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Nomor Bukti Transaksi</span>
              <span className="font-bold text-slate-900 font-mono">{journal.refId}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Tanggal Transaksi</span>
              <span className="font-bold text-slate-900">{journal.businessDate}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Keseimbangan Catatan</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {isBalanced ? 'Seimbang (Masuk = Keluar)' : 'Tidak Seimbang'}
              </span>
            </div>
          </div>

          {/* Baris Double-Entry Jurnal */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Rincian Pos Akun & Alur Keuangan ({lines.length} Baris)</span>
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Pos Akun</th>
                    <th className="p-2.5">Golongan</th>
                    <th className="p-2.5 text-right">Masuk (Debit)</th>
                    <th className="p-2.5 text-right">Keluar (Kredit)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {lines.map(line => {
                    const isDebit = line.side === 'DEBIT';
                    return (
                      <tr key={line.id} className="hover:bg-slate-50/60">
                        <td className="p-2.5">
                          <span className="font-mono font-bold text-slate-800 mr-2">{line.accountCode}</span>
                          <span className="text-slate-700 font-medium">{getAccountName(line.accountCode)}</span>
                        </td>
                        <td className="p-2.5">
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {getAccountType(line.accountCode)}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                          {isDebit ? formatRupiah(line.amount) : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                          {!isDebit ? formatRupiah(line.amount) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t border-slate-200 text-xs">
                  <tr>
                    <td colSpan={2} className="p-2.5 text-slate-700">Total Double-Entry</td>
                    <td className="p-2.5 text-right font-mono text-emerald-800">{formatRupiah(totalDebit)}</td>
                    <td className="p-2.5 text-right font-mono text-emerald-800">{formatRupiah(totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Jurnal ini merupakan catatan double-entry permanen (immutable). Nilai debit dan kredit dipastikan berpasangan imbang secara matematis sesuai standar akuntansi sembako.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
          >
            Tutup Drill-Down
          </button>
        </div>
      </div>
    </div>
  );
};
