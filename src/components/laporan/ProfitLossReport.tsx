import React, { useState, useMemo } from 'react';
import { Account, Journal, JournalLine } from '../../types/erp';
import { generateProfitAndLoss } from '../../utils/accountingReports';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { downloadCsv, generateCsvString } from '../../utils/csvExport';
import { 
  TrendingUp, 
  Download, 
  Calendar, 
  Percent, 
  Layers, 
  DollarSign,
  TrendingDown,
  CheckCircle2
} from 'lucide-react';

interface ProfitLossReportProps {
  accounts: Account[];
  journals: Journal[];
  journalLines: JournalLine[];
}

export const ProfitLossReport: React.FC<ProfitLossReportProps> = ({
  accounts,
  journals,
  journalLines
}) => {
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>('2026-09-30');

  const reportData = useMemo(() => {
    return generateProfitAndLoss({
      startDate,
      endDate,
      accounts,
      journals,
      journalLines
    });
  }, [startDate, endDate, accounts, journals, journalLines]);

  const grossProfitMargin = reportData.netRevenue > 0
    ? ((reportData.grossProfit / reportData.netRevenue) * 100).toFixed(1)
    : '0.0';

  const netProfitMargin = reportData.netRevenue > 0
    ? ((reportData.netProfit / reportData.netRevenue) * 100).toFixed(1)
    : '0.0';

  const handleExportCsv = () => {
    const headers = ['Pos Laporan', 'Kode Akun', 'Nama Akun', 'Nominal (Rp)'];
    const rows: (string | number)[][] = [];

    // Pendapatan
    rows.push(['PENDAPATAN KOTOR', '', '', '']);
    reportData.grossRevenueRows.forEach(r => {
      rows.push(['', r.account.code, r.account.name, r.amount]);
    });
    rows.push(['TOTAL PENDAPATAN KOTOR', '', '', reportData.grossRevenue]);

    // Diskon
    rows.push(['POTONGAN PENJUALAN', '', '', '']);
    reportData.salesDiscountRows.forEach(r => {
      rows.push(['', r.account.code, r.account.name, -r.amount]);
    });
    rows.push(['TOTAL DISKON PENJUALAN', '', '', -reportData.salesDiscounts]);
    rows.push(['PENDAPATAN BERSIH', '', '', reportData.netRevenue]);

    // HPP
    rows.push(['HARGA POKOK PENJUALAN (HPP)', '', '', '']);
    reportData.cogsRows.forEach(r => {
      rows.push(['', r.account.code, r.account.name, -r.amount]);
    });
    rows.push(['TOTAL HPP', '', '', -reportData.cogs]);
    rows.push(['LABA KOTOR', '', '', reportData.grossProfit]);

    // Beban Lain
    if (reportData.otherExpenseRows.length > 0) {
      rows.push(['BEBAN OPERASIONAL LAINNYA', '', '', '']);
      reportData.otherExpenseRows.forEach(r => {
        rows.push(['', r.account.code, r.account.name, -r.amount]);
      });
      rows.push(['TOTAL BEBAN LAIN', '', '', -reportData.otherExpenses]);
    }

    rows.push(['LABA / (RUGI) BERSIH', '', '', reportData.netProfit]);
    rows.push(['MARGIN LABA KOTOR (%)', '', '', `${grossProfitMargin}%`]);
    rows.push(['MARGIN LABA BERSIH (%)', '', '', `${netProfitMargin}%`]);

    const csvContent = generateCsvString(headers, rows);
    downloadCsv(`Laporan_Laba_Rugi_${startDate}_sd_${endDate}.csv`, csvContent);
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
      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Rentang:</span>
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
              Semua
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Penjualan Bersih (Omzet)</span>
          <span className="text-sm sm:text-base font-bold text-slate-900 font-mono block mt-1">
            {formatRupiah(reportData.netRevenue)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Setelah potongan diskon
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Modal Barang (HPP)</span>
          <span className="text-sm sm:text-base font-bold text-rose-800 font-mono block mt-1">
            {formatRupiah(reportData.cogs)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Modal beli barang yang terjual
          </span>
        </div>

        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-emerald-800 block">Untung Bersih (Laba Bersih)</span>
          <span className="text-sm sm:text-base font-black text-emerald-950 font-mono block mt-1">
            {formatRupiah(reportData.netProfit)}
          </span>
          <span className="text-[10px] text-emerald-700 block mt-0.5 font-bold">
            Persentase Untung: {netProfitMargin}%
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Untung Penjualan (Laba Kotor)</span>
          <span className="text-sm sm:text-base font-bold text-slate-900 font-mono block mt-1">
            {grossProfitMargin}%
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {formatRupiah(reportData.grossProfit)}
          </span>
        </div>
      </div>

      {/* Main Income Statement Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-xs tracking-wide">
              Laporan Laba Rugi Periode {formatDateIndo(startDate)} s/d {formatDateIndo(endDate)}
            </h3>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
            Standar Sederhana SAK EMKM
          </span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {/* SECTION 1: PENDAPATAN */}
          <div className="p-3 bg-slate-50/70 font-bold text-slate-900 flex justify-between">
            <span>1. PENDAPATAN PENJUALAN TOKO (OMZET KOTOR)</span>
            <span></span>
          </div>

          <div className="pl-6 pr-4 py-2 space-y-1.5 font-sans">
            {reportData.grossRevenueRows.map(row => (
              <div key={row.account.code} className="flex justify-between text-slate-700">
                <span>{row.account.code} — {row.account.name}</span>
                <span className="font-mono font-medium">{formatRupiah(row.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
              <span>Total Penjualan Kotor</span>
              <span className="font-mono text-emerald-800">{formatRupiah(reportData.grossRevenue)}</span>
            </div>
          </div>

          {/* SECTION 2: DISKON */}
          <div className="pl-6 pr-4 py-2 space-y-1.5 font-sans bg-slate-50/30">
            <span className="text-[11px] font-semibold text-slate-500 block">Dikurangi Potongan / Diskon Penjualan Kasir:</span>
            {reportData.salesDiscountRows.length > 0 ? (
              reportData.salesDiscountRows.map(row => (
                <div key={row.account.code} className="flex justify-between text-slate-600">
                  <span>{row.account.code} — {row.account.name}</span>
                  <span className="font-mono">({formatRupiah(row.amount)})</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-slate-400 italic">
                <span>Tidak ada potongan diskon penjualan</span>
                <span className="font-mono">Rp 0</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900 bg-slate-100/50 p-1.5 rounded">
              <span>PENJUALAN BERSIH (OMZET BERSIH)</span>
              <span className="font-mono text-slate-900">{formatRupiah(reportData.netRevenue)}</span>
            </div>
          </div>

          {/* SECTION 3: HPP */}
          <div className="p-3 bg-slate-50/70 font-bold text-slate-900 flex justify-between">
            <span>2. HARGA POKOK PENJUALAN / MODAL BARANG (HPP)</span>
            <span></span>
          </div>

          <div className="pl-6 pr-4 py-2 space-y-1.5 font-sans">
            {reportData.cogsRows.map(row => (
              <div key={row.account.code} className="flex justify-between text-slate-700">
                <span>{row.account.code} — {row.account.name}</span>
                <span className="font-mono text-rose-800">({formatRupiah(row.amount)})</span>
              </div>
            ))}
            <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
              <span>Total Modal Pokok Barang Terjual (HPP)</span>
              <span className="font-mono text-rose-900">({formatRupiah(reportData.cogs)})</span>
            </div>
          </div>

          {/* SUB-TOTAL: LABA KOTOR */}
          <div className="px-4 py-2.5 bg-emerald-50/60 font-black text-xs flex justify-between text-emerald-950 border-y border-emerald-200">
            <span>UNTUNG PENJUALAN (LABA KOTOR)</span>
            <span className="font-mono text-sm">{formatRupiah(reportData.grossProfit)}</span>
          </div>

          {/* SECTION 4: BEBAN OPERASIONAL */}
          <div className="p-3 bg-slate-50/70 font-bold text-slate-900 flex justify-between">
            <span>3. BIAYA OPERASIONAL & BEBAN LAINNYA</span>
            <span></span>
          </div>

          <div className="pl-6 pr-4 py-2 space-y-1.5 font-sans">
            {reportData.otherExpenseRows.length > 0 ? (
              reportData.otherExpenseRows.map(row => (
                <div key={row.account.code} className="flex justify-between text-slate-700">
                  <span>{row.account.code} — {row.account.name}</span>
                  <span className="font-mono text-rose-800">({formatRupiah(row.amount)})</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-slate-400 italic">
                <span>Belum ada beban operasional lain di periode ini</span>
                <span className="font-mono">Rp 0</span>
              </div>
            )}
          </div>

          {/* FINAL BOTTOM LINE: LABA BERSIH */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <span className="text-sm font-black tracking-wide block">UNTUNG / (RUGI) BERSIH TOKO</span>
              <span className="text-[11px] text-slate-400">
                Persentase Keuntungan Bersih: <strong className="text-emerald-400 font-mono">{netProfitMargin}%</strong>
              </span>
            </div>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
              {formatRupiah(reportData.netProfit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
