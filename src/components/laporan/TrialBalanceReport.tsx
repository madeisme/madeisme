import React, { useState, useMemo } from 'react';
import { Account, Journal, JournalLine } from '../../types/erp';
import { generateTrialBalance, getAccountNormalBalance } from '../../utils/accountingReports';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { downloadCsv, generateCsvString } from '../../utils/csvExport';
import { 
  Scale, 
  Download, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  ShieldCheck
} from 'lucide-react';

interface TrialBalanceReportProps {
  accounts: Account[];
  journals: Journal[];
  journalLines: JournalLine[];
}

export const TrialBalanceReport: React.FC<TrialBalanceReportProps> = ({
  accounts,
  journals,
  journalLines
}) => {
  const [asOfDate, setAsOfDate] = useState<string>('2026-09-30');

  const reportData = useMemo(() => {
    return generateTrialBalance({
      asOfDate,
      accounts,
      journals,
      journalLines
    });
  }, [asOfDate, accounts, journals, journalLines]);

  const handleExportCsv = () => {
    const headers = [
      'Kode Akun',
      'Nama Akun',
      'Tipe Akun',
      'Saldo Normal',
      'Total Debit Kumulatif (Rp)',
      'Total Kredit Kumulatif (Rp)',
      'Saldo Akhir Debit (Rp)',
      'Saldo Akhir Kredit (Rp)'
    ];

    const rows = reportData.items.map(item => [
      item.account.code,
      item.account.name,
      item.account.type,
      getAccountNormalBalance(item.account.type),
      item.cumulativeDebit,
      item.cumulativeCredit,
      item.endingDebit,
      item.endingCredit
    ]);

    // Total Row
    rows.push([
      'TOTAL',
      'TOTAL SELURUH AKUN',
      '-',
      '-',
      reportData.totalCumulativeDebit,
      reportData.totalCumulativeCredit,
      reportData.totalEndingDebit,
      reportData.totalEndingCredit
    ]);

    const csvContent = generateCsvString(headers, rows);
    downloadCsv(`Neraca_Saldo_per_${asOfDate}.csv`, csvContent);
  };

  return (
    <div className="space-y-4">
      {/* Filter Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Posisi Neraca Saldo Per Tanggal:
            </label>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={asOfDate}
                onChange={e => setAsOfDate(e.target.value)}
                className="bg-transparent text-xs text-slate-800 focus:outline-none font-mono font-medium"
              />
            </div>
          </div>

          <div className="pt-5 hidden sm:block">
            <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
              Kumulatif dari awal toko hingga {formatDateIndo(asOfDate)}
            </span>
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition mt-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Balance Verification Banner */}
      {reportData.isBalanced ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-emerald-950">
                Keseimbangan Saldo Terpenuhi: Mutasi Masuk (Debit) = Mutasi Keluar (Kredit)
              </h4>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Total mutasi masuk dan keluar persis sama: <span className="font-mono font-bold">{formatRupiah(reportData.totalCumulativeDebit)}</span>. Pembukuan seimbang tanpa selisih.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-200 text-emerald-900 font-mono">
            SELISIH: Rp 0 (SEIMBANG)
          </span>
        </div>
      ) : (
        <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3.5 flex items-start gap-3 shadow-md animate-pulse">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-black text-xs text-rose-950 uppercase tracking-wide">
              Peringatan: Mutasi Tidak Seimbang
            </h4>
            <p className="text-[11px] text-rose-800 mt-1">
              Ditemukan selisih sebesar <span className="font-bold font-mono text-rose-950">{formatRupiah(reportData.discrepancy)}</span> antara total debit dan kredit.
            </p>
          </div>
        </div>
      )}

      {/* Trial Balance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-700" />
            <h3 className="font-bold text-xs text-slate-900">
              Neraca Saldo (Cek Keseimbangan Debit & Kredit) per {formatDateIndo(asOfDate)}
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {reportData.items.length} Pos Akun Terdaftar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Kode</th>
                <th className="p-2.5">Nama Pos Akun</th>
                <th className="p-2.5">Golongan</th>
                <th className="p-2.5 text-center">Sisi Normal</th>
                <th className="p-2.5 text-right">Mutasi Masuk (Debit)</th>
                <th className="p-2.5 text-right">Mutasi Keluar (Kredit)</th>
                <th className="p-2.5 text-right bg-slate-100 font-bold">Saldo Masuk (Debit)</th>
                <th className="p-2.5 text-right bg-slate-100 font-bold">Saldo Keluar (Kredit)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {reportData.items.map(item => {
                const normal = getAccountNormalBalance(item.account.type);
                return (
                  <tr key={item.account.code} className="hover:bg-slate-50/70 transition">
                    <td className="p-2.5 font-mono font-bold text-slate-900">{item.account.code}</td>
                    <td className="p-2.5 font-medium text-slate-800">{item.account.name}</td>
                    <td className="p-2.5">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        {item.account.type}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        normal === 'DEBIT' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                        {normal === 'DEBIT' ? 'DEBIT (MASUK)' : 'KREDIT (KELUAR)'}
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700">
                      {item.cumulativeDebit > 0 ? formatRupiah(item.cumulativeDebit) : '-'}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700">
                      {item.cumulativeCredit > 0 ? formatRupiah(item.cumulativeCredit) : '-'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                      {item.endingDebit > 0 ? formatRupiah(item.endingDebit) : '-'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                      {item.endingCredit > 0 ? formatRupiah(item.endingCredit) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs">
              <tr>
                <td colSpan={4} className="p-2.5 text-slate-900 uppercase">
                  TOTAL KESELURUHAN (KONTROL IMBANG)
                </td>
                <td className="p-2.5 text-right font-mono text-slate-800">
                  {formatRupiah(reportData.totalCumulativeDebit)}
                </td>
                <td className="p-2.5 text-right font-mono text-slate-800">
                  {formatRupiah(reportData.totalCumulativeCredit)}
                </td>
                <td className="p-2.5 text-right font-mono text-emerald-900 bg-emerald-100/50">
                  {formatRupiah(reportData.totalEndingDebit)}
                </td>
                <td className="p-2.5 text-right font-mono text-emerald-900 bg-emerald-100/50">
                  {formatRupiah(reportData.totalEndingCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
