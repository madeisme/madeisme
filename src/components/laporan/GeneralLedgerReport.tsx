import React, { useState, useMemo } from 'react';
import { Account, Journal, JournalLine, Sale, Purchase } from '../../types/erp';
import { generateGeneralLedger, getAccountNormalBalance, GeneralLedgerRow } from '../../utils/accountingReports';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { downloadCsv, generateCsvString } from '../../utils/csvExport';
import { JournalDrilldownModal } from './JournalDrilldownModal';
import { 
  BookOpen, 
  Download, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Eye, 
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';

interface GeneralLedgerReportProps {
  accounts: Account[];
  journals: Journal[];
  journalLines: JournalLine[];
  sales: Sale[];
  purchases: Purchase[];
}

export const GeneralLedgerReport: React.FC<GeneralLedgerReportProps> = ({
  accounts,
  journals,
  journalLines,
  sales,
  purchases
}) => {
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>(
    accounts[0]?.code || '1110'
  );
  
  // Default rentang tanggal: awal bulan sekarang sampai hari ini (2026-09-17)
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>('2026-09-30');
  
  // State drill-down modal
  const [drilldownJournal, setDrilldownJournal] = useState<Journal | null>(null);

  const reportData = useMemo(() => {
    return generateGeneralLedger({
      accountCode: selectedAccountCode,
      startDate,
      endDate,
      accounts,
      journals,
      journalLines,
      sales,
      purchases
    });
  }, [selectedAccountCode, startDate, endDate, accounts, journals, journalLines, sales, purchases]);

  const handleExportCsv = () => {
    if (!reportData) return;

    const headers = [
      'No Baris',
      'Tanggal',
      'No Jurnal',
      'Tipe Ref',
      'No Ref',
      'Keterangan Transaksi',
      'Debit (Rp)',
      'Kredit (Rp)',
      'Saldo Berjalan (Rp)'
    ];

    const rows: (string | number)[][] = [];

    // Saldo Awal row
    rows.push([
      '0',
      reportData.startDate,
      '-',
      'SALDO_AWAL',
      '-',
      `Saldo Awal per ${formatDateIndo(reportData.startDate)}`,
      reportData.openingDebit,
      reportData.openingCredit,
      reportData.openingBalance
    ]);

    reportData.rows.forEach((r, idx) => {
      rows.push([
        idx + 1,
        r.businessDate,
        r.journalId,
        r.refType,
        r.refId,
        r.description,
        r.debit,
        r.credit,
        r.runningBalance
      ]);
    });

    // Total Row
    rows.push([
      'TOTAL',
      reportData.endDate,
      '-',
      'CLOSING',
      '-',
      `Saldo Akhir per ${formatDateIndo(reportData.endDate)}`,
      reportData.totalPeriodDebit,
      reportData.totalPeriodCredit,
      reportData.closingBalance
    ]);

    const csvContent = generateCsvString(headers, rows);
    downloadCsv(
      `Buku_Besar_${reportData.account.code}_${reportData.account.name.replace(/\s+/g, '_')}_${startDate}_sd_${endDate}.csv`,
      csvContent
    );
  };

  const setPresetRange = (preset: 'THIS_MONTH' | 'TODAY' | 'ALL_TIME') => {
    if (preset === 'TODAY') {
      setStartDate('2026-09-17');
      setEndDate('2026-09-17');
    } else if (preset === 'THIS_MONTH') {
      setStartDate('2026-09-01');
      setEndDate('2026-09-30');
    } else if (preset === 'ALL_TIME') {
      setStartDate('2026-01-01');
      setEndDate('2026-12-31');
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar: Pilih Akun & Rentang Tanggal */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Akun Picker */}
          <div className="sm:col-span-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pilih Pos Akun / Rekening Keuangan:
            </label>
            <select
              value={selectedAccountCode}
              onChange={e => setSelectedAccountCode(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {accounts.map(acc => (
                <option key={acc.code} value={acc.code}>
                  {acc.code} — {acc.name} ({acc.type})
                </option>
              ))}
            </select>
          </div>

          {/* Tanggal Dari */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Dari Tanggal:
            </label>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-slate-800 w-full focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Tanggal Sampai */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Sampai Tanggal:
            </label>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-slate-800 w-full focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Quick Date Range Presets & Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Rentang Cepat:</span>
            <button
              onClick={() => setPresetRange('THIS_MONTH')}
              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition"
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setPresetRange('TODAY')}
              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition"
            >
              Hari Ini
            </button>
            <button
              onClick={() => setPresetRange('ALL_TIME')}
              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition"
            >
              Sepanjang Waktu
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            disabled={!reportData}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Account Info & Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Awal</span>
            <span className="text-sm sm:text-base font-bold text-slate-800 font-mono block mt-1">
              {formatRupiah(reportData.openingBalance)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Normal: {getAccountNormalBalance(reportData.account.type)}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" /> Total Masuk (Debit)
            </span>
            <span className="text-sm sm:text-base font-bold text-emerald-800 font-mono block mt-1">
              {formatRupiah(reportData.totalPeriodDebit)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Uang / mutasi masuk
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-amber-600 block flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Total Keluar (Kredit)
            </span>
            <span className="text-sm sm:text-base font-bold text-amber-800 font-mono block mt-1">
              {formatRupiah(reportData.totalPeriodCredit)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Uang / mutasi keluar
            </span>
          </div>

          <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Sisa Saldo Berjalan</span>
            <span className="text-sm sm:text-base font-bold text-emerald-950 font-mono block mt-1">
              {formatRupiah(reportData.closingBalance)}
            </span>
            <span className="text-[10px] text-emerald-700 block mt-0.5 font-medium">
              {reportData.rows.length} mutasi dicatat
            </span>
          </div>
        </div>
      )}

      {/* Main Ledger Table */}
      {reportData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-700" />
              <h3 className="font-bold text-xs text-slate-900">
                Buku Besar: {reportData.account.code} — {reportData.account.name}
              </h3>
              <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-1.5 py-0.5 rounded font-bold">
                {reportData.account.type}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Klik baris untuk melihat rincian bukti jurnal
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Tanggal</th>
                  <th className="p-2.5">No. Bukti / Jurnal</th>
                  <th className="p-2.5">Keterangan Transaksi</th>
                  <th className="p-2.5 text-right">Masuk (Debit)</th>
                  <th className="p-2.5 text-right">Keluar (Kredit)</th>
                  <th className="p-2.5 text-right">Sisa Saldo</th>
                  <th className="p-2.5 text-center w-8">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {/* Saldo Awal Row */}
                <tr className="bg-slate-50/50 font-medium text-slate-600">
                  <td className="p-2.5 font-mono text-[11px]">{reportData.startDate}</td>
                  <td className="p-2.5 text-slate-400">-</td>
                  <td className="p-2.5 font-semibold text-slate-800">
                    [Saldo Awal Sebelum {formatDateIndo(reportData.startDate)}]
                  </td>
                  <td className="p-2.5 text-right font-mono text-slate-500">
                    {reportData.openingDebit > 0 ? formatRupiah(reportData.openingDebit) : '-'}
                  </td>
                  <td className="p-2.5 text-right font-mono text-slate-500">
                    {reportData.openingCredit > 0 ? formatRupiah(reportData.openingCredit) : '-'}
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                    {formatRupiah(reportData.openingBalance)}
                  </td>
                  <td className="p-2.5 text-center">-</td>
                </tr>

                {/* Period Mutation Rows */}
                {reportData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Tidak ada mutasi jurnal untuk akun ini pada rentang tanggal yang dipilih.
                    </td>
                  </tr>
                ) : (
                  reportData.rows.map(row => (
                    <tr
                      key={row.journalLineId}
                      onClick={() => setDrilldownJournal(row.journal)}
                      className="hover:bg-emerald-50/50 cursor-pointer transition group"
                    >
                      <td className="p-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {row.businessDate}
                      </td>
                      <td className="p-2.5">
                        <span className="font-mono text-[11px] text-blue-800 font-bold block">
                          {row.journalId}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {row.refType} #{row.refId}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-800 max-w-xs">
                        <p className="font-medium text-[11px] line-clamp-1">{row.description}</p>
                        {row.counterpartLines.length > 0 && (
                          <p className="text-[10px] text-slate-400 truncate">
                            Lawan: {row.counterpartLines.map(cl => `${cl.accountCode} (${cl.side === 'DEBIT' ? 'Dr' : 'Cr'})`).join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-emerald-800 whitespace-nowrap">
                        {row.debit > 0 ? formatRupiah(row.debit) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-amber-800 whitespace-nowrap">
                        {row.credit > 0 ? formatRupiah(row.credit) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap bg-slate-50/40">
                        {formatRupiah(row.runningBalance)}
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="w-6 h-6 rounded-md bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-600 flex items-center justify-center transition">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-200 text-xs">
                <tr>
                  <td colSpan={3} className="p-2.5 text-slate-800">
                    Total Periode ({formatDateIndo(startDate)} s/d {formatDateIndo(endDate)})
                  </td>
                  <td className="p-2.5 text-right font-mono text-emerald-900">
                    {formatRupiah(reportData.totalPeriodDebit)}
                  </td>
                  <td className="p-2.5 text-right font-mono text-amber-900">
                    {formatRupiah(reportData.totalPeriodCredit)}
                  </td>
                  <td className="p-2.5 text-right font-mono text-emerald-950 bg-emerald-100/60">
                    {formatRupiah(reportData.closingBalance)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Drill-down Modal */}
      <JournalDrilldownModal
        isOpen={!!drilldownJournal}
        journal={drilldownJournal}
        allLines={journalLines}
        accounts={accounts}
        onClose={() => setDrilldownJournal(null)}
      />
    </div>
  );
};
