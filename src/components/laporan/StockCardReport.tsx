import React, { useState, useMemo } from 'react';
import { 
  Product, 
  InventoryLayer, 
  Sale, 
  SaleLine, 
  SaleReturn, 
  Purchase, 
  PurchaseReceipt, 
  PurchaseReturn,
  StockOpname,
  StockOpnameLine
} from '../../types/erp';
import { generateStockCard } from '../../utils/accountingReports';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { downloadCsv, generateCsvString } from '../../utils/csvExport';
import { 
  Package, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Layers,
  History
} from 'lucide-react';

interface StockCardReportProps {
  products: Product[];
  inventoryLayers: InventoryLayer[];
  sales: Sale[];
  saleLines: SaleLine[];
  saleReturns: SaleReturn[];
  purchases: Purchase[];
  purchaseReceipts: PurchaseReceipt[];
  purchaseReturns: PurchaseReturn[];
  stockOpnames?: StockOpname[];
  stockOpnameLines?: StockOpnameLine[];
}

export const StockCardReport: React.FC<StockCardReportProps> = ({
  products,
  inventoryLayers,
  sales,
  saleLines,
  saleReturns,
  purchases,
  purchaseReceipts,
  purchaseReturns,
  stockOpnames = [],
  stockOpnameLines = []
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id || 'PRD-001'
  );

  const reportData = useMemo(() => {
    return generateStockCard({
      productId: selectedProductId,
      products,
      inventoryLayers,
      sales,
      saleLines,
      saleReturns,
      purchases,
      purchaseReceipts,
      purchaseReturns,
      stockOpnames,
      stockOpnameLines
    });
  }, [
    selectedProductId,
    products,
    inventoryLayers,
    sales,
    saleLines,
    saleReturns,
    purchases,
    purchaseReceipts,
    purchaseReturns,
    stockOpnames,
    stockOpnameLines
  ]);

  const handleExportCsv = () => {
    if (!reportData) return;

    const headers = [
      'No',
      'Tanggal & Waktu',
      'Lokasi',
      'Tipe Mutasi',
      'No Referensi / Dokumen',
      'Keterangan Mutasi',
      'Masuk (Qty)',
      'Keluar (Qty)',
      'Sisa Stok Berjalan',
      'Biaya Satuan (Rp)',
      'Total Nilai (Rp)'
    ];

    const rows = reportData.movements.map((m, idx) => [
      idx + 1,
      m.date,
      m.location || 'GUDANG',
      m.type === 'IN' ? 'MASUK (IN)' : 'KELUAR (OUT)',
      m.refNumber,
      m.description,
      m.qtyIn,
      m.qtyOut,
      m.runningQty,
      m.unitCost,
      m.totalCost
    ]);

    // Total Row
    rows.push([
      'TOTAL',
      'AKUMULASI',
      '-',
      '-',
      '-',
      `Sisa Akhir: ${reportData.endingRunningQty} ${reportData.product.unit}`,
      reportData.totalQtyIn,
      reportData.totalQtyOut,
      reportData.endingRunningQty,
      '-',
      '-'
    ]);

    const csvContent = generateCsvString(headers, rows);
    downloadCsv(
      `Kartu_Stok_${reportData.product.id}_${reportData.product.name.replace(/\s+/g, '_')}.csv`,
      csvContent
    );
  };

  return (
    <div className="space-y-4">
      {/* Product Selector Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:w-auto flex-1 max-w-md">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Pilih Produk Sembako:
          </label>
          <select
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.name} ({p.unit}) • Kategori: {p.category}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={!reportData}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition mt-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {reportData && (
        <>
          {/* Consistency Check Banner */}
          {reportData.isMatchesActiveLayers ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-emerald-950">
                    Sisa Stok Cocok dengan Batch FIFO Aktif
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Sisa stok akhir di kartu ({reportData.endingRunningQty} {reportData.product.unit}) persis sama dengan jumlah seluruh batch aktif (Σ quantityRemaining = {reportData.currentActiveLayersQty} {reportData.product.unit}).
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-200 text-emerald-900 font-mono">
                {reportData.endingRunningQty} {reportData.product.unit} AKTIF
              </span>
            </div>
          ) : (
            <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3.5 flex items-start gap-3 shadow-md animate-pulse">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-xs text-rose-950 uppercase">
                  Peringatan: Selisih Stok Terdeteksi pada Pelacakan!
                </h4>
                <p className="text-[11px] text-rose-800 mt-1">
                  Sisa kartu stok ({reportData.endingRunningQty}) tidak sama dengan batch aktif ({reportData.currentActiveLayersQty}). Cek riwayat layer di Database Inspector.
                </p>
              </div>
            </div>
          )}

          {/* Product Summary Mini Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Masuk (IN)</span>
              <span className="text-sm sm:text-base font-bold text-emerald-800 font-mono block mt-1 flex items-center gap-1">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                {reportData.totalQtyIn} {reportData.product.unit}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                PO & Retur Masuk
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Keluar (OUT)</span>
              <span className="text-sm sm:text-base font-bold text-amber-800 font-mono block mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4 text-amber-600" />
                {reportData.totalQtyOut} {reportData.product.unit}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Penjualan Kasir
              </span>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Sisa Stok Fisik</span>
              <span className="text-sm sm:text-base font-black text-emerald-950 font-mono block mt-1">
                {reportData.endingRunningQty} {reportData.product.unit}
              </span>
              <span className="text-[10px] text-emerald-700 block mt-0.5 font-semibold">
                Sesuai Kartu Stok
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Harga Jual Normal</span>
              <span className="text-sm sm:text-base font-bold text-slate-900 font-mono block mt-1">
                {formatRupiah(reportData.product.sellPrice)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                per {reportData.product.unit}
              </span>
            </div>
          </div>

          {/* Movement Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-xs text-slate-900">
                  Kartu Stok Fisik: {reportData.product.name}
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {reportData.movements.length} Mutasi Tercatat
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Tanggal</th>
                    <th className="p-2.5">Lokasi</th>
                    <th className="p-2.5">Jenis</th>
                    <th className="p-2.5">No Referensi</th>
                    <th className="p-2.5">Keterangan</th>
                    <th className="p-2.5 text-right text-emerald-800">Masuk (IN)</th>
                    <th className="p-2.5 text-right text-amber-800">Keluar (OUT)</th>
                    <th className="p-2.5 text-right bg-slate-100 font-bold">Sisa Stok</th>
                    <th className="p-2.5 text-right">Biaya Satuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {reportData.movements.map(m => {
                    const isIncome = m.type === 'IN';
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {formatDateTimeIndo(m.date)}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            m.location === 'TOKO' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {m.location || 'GUDANG'}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {isIncome ? 'MASUK (IN)' : 'KELUAR (OUT)'}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] font-bold text-slate-800">
                          {m.refNumber}
                        </td>
                        <td className="p-2.5 text-slate-700 max-w-xs">
                          <span className="line-clamp-1">{m.description}</span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                          {m.qtyIn > 0 ? `+${m.qtyIn} ${reportData.product.unit}` : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-800 whitespace-nowrap">
                          {m.qtyOut > 0 ? `-${m.qtyOut} ${reportData.product.unit}` : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-slate-900 whitespace-nowrap bg-slate-50/50">
                          {m.runningQty} {reportData.product.unit}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                          {m.unitCost > 0 ? formatRupiah(m.unitCost) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs">
                  <tr>
                    <td colSpan={5} className="p-2.5 text-slate-900 uppercase">
                      TOTAL PERPUTARAN & SISA AKHIR
                    </td>
                    <td className="p-2.5 text-right font-mono text-emerald-900">
                      +{reportData.totalQtyIn} {reportData.product.unit}
                    </td>
                    <td className="p-2.5 text-right font-mono text-amber-900">
                      -{reportData.totalQtyOut} {reportData.product.unit}
                    </td>
                    <td className="p-2.5 text-right font-mono text-emerald-950 bg-emerald-100/60 font-black">
                      {reportData.endingRunningQty} {reportData.product.unit}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
