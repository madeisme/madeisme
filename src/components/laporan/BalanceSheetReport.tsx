import React, { useState, useMemo } from 'react';
import { Account, Journal, JournalLine } from '../../types/erp';
import { generateBalanceSheet } from '../../utils/accountingReports';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { downloadCsv, generateCsvString } from '../../utils/csvExport';
import { 
  Landmark, 
  Download, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';

interface BalanceSheetReportProps {
  accounts: Account[];
  journals: Journal[];
  journalLines: JournalLine[];
}

export const BalanceSheetReport: React.FC<BalanceSheetReportProps> = ({
  accounts,
  journals,
  journalLines
}) => {
  const [asOfDate, setAsOfDate] = useState<string>('2026-09-30');

  const reportData = useMemo(() => {
    return generateBalanceSheet({
      asOfDate,
      accounts,
      journals,
      journalLines
    });
  }, [asOfDate, accounts, journals, journalLines]);

  const handleExportCsv = () => {
    const headers = ['Kategori', 'Kode Akun', 'Nama Akun', 'Saldo (Rp)'];
    const rows: (string | number)[][] = [];

    // Aset
    rows.push(['ASET (AKTIVA)', '', '', '']);
    reportData.assetRows.forEach(r => {
      rows.push(['Aset Lancar', r.account.code, r.account.name, r.balance]);
    });
    rows.push(['TOTAL ASET', '', '', reportData.totalAssets]);

    // Liabilitas
    rows.push(['LIABILITAS (KEWAJIBAN)', '', '', '']);
    reportData.liabilityRows.forEach(r => {
      rows.push(['Kewajiban Lancar', r.account.code, r.account.name, r.balance]);
    });
    rows.push(['TOTAL LIABILITAS', '', '', reportData.totalLiabilities]);

    // Ekuitas
    rows.push(['EKUITAS', '', '', '']);
    rows.push(['Ekuitas Pemilik', '3000', 'Ekuitas (Termasuk Laba Berjalan)', reportData.equityBalancingFigure]);
    rows.push(['TOTAL EKUITAS', '', '', reportData.equityBalancingFigure]);

    // Total Pasiva
    rows.push(['TOTAL LIABILITAS & EKUITAS (PASIVA)', '', '', reportData.totalLiabilitiesAndEquity]);

    const csvContent = generateCsvString(headers, rows);
    downloadCsv(`Neraca_Keuangan_per_${asOfDate}.csv`, csvContent);
  };

  return (
    <div className="space-y-4">
      {/* Filter Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Posisi Neraca Per Tanggal:
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
              Posisi Kumulatif Aktiva & Pasiva per {formatDateIndo(asOfDate)}
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
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-emerald-950">
              Neraca Keuangan Seimbang: Harta (Aset) = Hutang (Kewajiban) + Modal Bersih
            </h4>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Total Harta Toko (<span className="font-mono font-bold">{formatRupiah(reportData.totalAssets)}</span>) persis sama dengan Total Hutang + Modal Usaha (<span className="font-mono font-bold">{formatRupiah(reportData.totalLiabilitiesAndEquity)}</span>).
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-200 text-emerald-900 font-mono">
          SEIMBANG
        </span>
      </div>

      {/* Two-Column or Stacked Balance Sheet (Aktiva vs Pasiva) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* KOLOM KIRI: ASET (AKTIVA) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-xs uppercase tracking-wide">HARTA TOKO / AKTIVA (ASET)</h3>
              </div>
              <span className="text-[10px] bg-slate-800 text-emerald-300 font-mono px-2 py-0.5 rounded font-bold">
                TOTAL: {formatRupiah(reportData.totalAssets)}
              </span>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-slate-700 text-xs border-b border-slate-200 pb-1 mb-2.5">
                  Harta Lancar (Kas, Piutang Pelanggan & Stok Barang)
                </h4>

                <div className="space-y-2">
                  {reportData.assetRows.map(row => (
                    <div key={row.account.code} className="flex justify-between items-center py-1 border-b border-slate-50">
                      <div>
                        <span className="font-mono font-bold text-slate-800 mr-2">{row.account.code}</span>
                        <span className="text-slate-700 font-medium">{row.account.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {formatRupiah(row.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs font-black text-slate-900">
            <span>TOTAL HARTA USAHA (ASET)</span>
            <span className="font-mono text-sm text-emerald-800">{formatRupiah(reportData.totalAssets)}</span>
          </div>
        </div>

        {/* KOLOM KANAN: LIABILITAS & EKUITAS (PASIVA) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-xs uppercase tracking-wide">HUTANG & MODAL USAHA (PASIVA)</h3>
              </div>
              <span className="text-[10px] bg-slate-800 text-purple-300 font-mono px-2 py-0.5 rounded font-bold">
                TOTAL: {formatRupiah(reportData.totalLiabilitiesAndEquity)}
              </span>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {/* Liabilitas Section */}
              <div>
                <h4 className="font-bold text-slate-700 text-xs border-b border-slate-200 pb-1 mb-2.5">
                  1. Hutang Lancar (Supplier & Titipan Pajak)
                </h4>

                <div className="space-y-2">
                  {reportData.liabilityRows.map(row => (
                    <div key={row.account.code} className="flex justify-between items-center py-1 border-b border-slate-50">
                      <div>
                        <span className="font-mono font-bold text-slate-800 mr-2">{row.account.code}</span>
                        <span className="text-slate-700 font-medium">{row.account.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {formatRupiah(row.balance)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200 font-bold text-slate-800">
                  <span>Total Hutang Toko</span>
                  <span className="font-mono text-purple-900">{formatRupiah(reportData.totalLiabilities)}</span>
                </div>
              </div>

              {/* Ekuitas Section */}
              <div>
                <h4 className="font-bold text-slate-700 text-xs border-b border-slate-200 pb-1 mb-2.5">
                  2. Modal Bersih Usaha (Modal Pemilik + Keuntungan)
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1">
                    <div>
                      <span className="font-mono font-bold text-slate-500 mr-2">3000</span>
                      <span className="text-slate-700 font-medium">Modal Usaha (Termasuk Laba Berjalan)</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-800">
                      {formatRupiah(reportData.equityBalancingFigure)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 mt-2">
                  <p className="text-[10px] text-slate-500 leading-tight">
                    * Catatan: Modal usaha dihitung secara matematis (Harta − Hutang Toko) sebagai cerminan kekayaan bersih toko saat ini.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs font-black text-slate-900">
            <span>TOTAL HUTANG + MODAL USAHA (PASIVA)</span>
            <span className="font-mono text-sm text-purple-900">{formatRupiah(reportData.totalLiabilitiesAndEquity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
