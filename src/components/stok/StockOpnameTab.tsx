import React, { useState } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { hasPermission } from '../../rbac/permissions';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { 
  ClipboardCheck, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight
} from 'lucide-react';
import { StockLocation } from '../../types/erp';

interface ProductOpnameRow {
  productId: string;
  name: string;
  unit: string;
  systemQtyLive: number;
  physicalQty: number;
}

export const StockOpnameTab: React.FC = () => {
  const { 
    currentUser, 
    products, 
    stockOpnames, 
    stockOpnameLines, 
    db 
  } = useAppDatabase();

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'DRAFT' | 'COMMITTED'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedOpnameId, setExpandedOpnameId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for New Stock Opname
  const [selectedLocation, setSelectedLocation] = useState<StockLocation>('TOKO');
  const [opnameNotes, setOpnameNotes] = useState('');
  const [opnameRows, setOpnameRows] = useState<ProductOpnameRow[]>([]);

  const canCreate = hasPermission(currentUser?.role, 'STOCK_OPNAME_CREATE');
  const canCommit = hasPermission(currentUser?.role, 'STOCK_OPNAME_COMMIT');

  const openCreateModal = () => {
    // Initialize rows for all products with live system quantity at the selected location
    const rows: ProductOpnameRow[] = products.map(p => {
      const liveQty = db.getProductStockByLocation(p.id, selectedLocation);
      return {
        productId: p.id,
        name: p.name,
        unit: p.unit,
        systemQtyLive: liveQty,
        physicalQty: liveQty // Default equal to system
      };
    });
    setOpnameRows(rows);
    setOpnameNotes('');
    setShowCreateModal(true);
    setActionFeedback(null);
  };

  const handleLocationChange = (loc: StockLocation) => {
    setSelectedLocation(loc);
    // Refresh live quantities for all products under new location
    setOpnameRows(prev => prev.map(r => {
      const liveQty = db.getProductStockByLocation(r.productId, loc);
      return {
        ...r,
        systemQtyLive: liveQty,
        physicalQty: liveQty
      };
    }));
  };

  const handlePhysicalQtyChange = (productId: string, val: number) => {
    setOpnameRows(prev => prev.map(r => 
      r.productId === productId ? { ...r, physicalQty: Math.max(0, Math.round(val)) } : r
    ));
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      const lines = opnameRows.map(r => ({
        productId: r.productId,
        physicalQty: r.physicalQty
      }));

      const newOpname = db.createStockOpname({
        location: selectedLocation,
        notes: opnameNotes.trim() || undefined,
        userId: currentUser.id,
        businessDate: db.getSystemBusinessDate(),
        lines
      });

      setShowCreateModal(false);
      setExpandedOpnameId(newOpname.id);
      setActionFeedback({
        type: 'success',
        message: `Draft Stock Opname ${newOpname.id} berhasil dibuat. Silakan tinjau dan lakukan commit saat hitungan fisik telah diverifikasi.`
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Gagal membuat Stock Opname.'
      });
    }
  };

  const handleCommit = (opnameId: string) => {
    if (!currentUser) return;
    if (!window.confirm('Commit stock opname ini? Layer persediaan akan otomatis disesuaikan dan selisih akan diposting ke jurnal akuntansi.')) {
      return;
    }

    try {
      db.commitStockOpname({ opnameId, committedByUserId: currentUser.id });
      setActionFeedback({
        type: 'success',
        message: `Stock Opname ${opnameId} berhasil di-commit! Stok telah disesuaikan dan jurnal penyesuaian otomatis tercatat.`
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Gagal melakukan commit stock opname.'
      });
    }
  };

  const filteredOpnames = stockOpnames.filter(opn => {
    if (filterStatus === 'ALL') return true;
    return opn.status === filterStatus;
  });

  return (
    <div className="space-y-4">
      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
          actionFeedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button 
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Control Bar: Filter & Add Opname */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 mr-1">Status:</span>
          {(['ALL', 'DRAFT', 'COMMITTED'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                filterStatus === st 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'Semua' : st === 'DRAFT' ? 'Draft' : 'Committed'}
            </button>
          ))}
        </div>

        {canCreate && (
          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Stock Opname Baru</span>
          </button>
        )}
      </div>

      {/* Opname List */}
      {filteredOpnames.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 space-y-2">
          <ClipboardCheck className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-xs font-medium">Belum ada data Stock Opname {filterStatus !== 'ALL' ? `dengan status ${filterStatus}` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOpnames.map(opn => {
            const isExpanded = expandedOpnameId === opn.id;
            const lines = stockOpnameLines.filter(l => l.opnameId === opn.id);
            const isCommitted = opn.status === 'COMMITTED';
            const totalVariances = lines.reduce((acc, l) => acc + (l.varianceQty ?? 0), 0);

            return (
              <div 
                key={opn.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition"
              >
                {/* Header Row */}
                <div 
                  onClick={() => setExpandedOpnameId(isExpanded ? null : opn.id)}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 flex-shrink-0">
                      <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-slate-900">{opn.id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          opn.location === 'TOKO' 
                            ? 'bg-sky-100 text-sky-800 border border-sky-200' 
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          LOKASI: {opn.location}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCommitted 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-800 border border-amber-300'
                        }`}>
                          {isCommitted ? 'COMMITTED (SELESAI)' : 'DRAFT'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span>Dibuat: {formatDateTimeIndo(opn.createdAt)} oleh <strong className="text-slate-700">{opn.userId}</strong></span>
                        {opn.notes && (
                          <span className="italic text-slate-400">• "{opn.notes}"</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-700">
                        {lines.length} Item Terdata
                      </span>
                      <span className={`block text-[10px] font-bold ${
                        totalVariances > 0 ? 'text-emerald-600' : totalVariances < 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}>
                        Net Selisih: {totalVariances > 0 ? `+${totalVariances}` : totalVariances} item
                      </span>
                    </div>

                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-3.5 space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="p-2.5">Produk</th>
                            <th className="p-2.5 text-right">Stok Sistem (Saat Dihitung)</th>
                            <th className="p-2.5 text-right">Hitungan Fisik</th>
                            <th className="p-2.5 text-right">Selisih (Variance)</th>
                            <th className="p-2.5 text-right">HPP Rata-Rata</th>
                            <th className="p-2.5 text-right">Estimasi Nilai Selisih</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {lines.map(line => {
                            const prod = products.find(p => p.id === line.productId);
                            const variance = line.varianceQty ?? (line.physicalQty - (line.systemQtyLive ?? 0));
                            const unitCost = line.unitCostAvg ?? 0;
                            const totalValue = variance * unitCost;

                            return (
                              <tr key={line.id} className="hover:bg-slate-50/60">
                                <td className="p-2.5">
                                  <span className="font-semibold text-slate-800">{prod?.name || line.productId}</span>
                                  <span className="text-[10px] text-slate-400 block font-mono">{line.productId}</span>
                                </td>
                                <td className="p-2.5 text-right font-mono font-medium text-slate-700">
                                  {line.systemQtyLive} {prod?.unit}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                  {line.physicalQty} {prod?.unit}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold whitespace-nowrap">
                                  {variance > 0 ? (
                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center justify-end gap-1">
                                      <TrendingUp className="w-3 h-3" /> +{variance} {prod?.unit}
                                    </span>
                                  ) : variance < 0 ? (
                                    <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded flex items-center justify-end gap-1">
                                      <TrendingDown className="w-3 h-3" /> {variance} {prod?.unit}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">0 (Sesuai)</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-right font-mono text-slate-700">
                                  {unitCost > 0 ? formatRupiah(unitCost) : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold">
                                  {totalValue > 0 ? (
                                    <span className="text-emerald-700">+{formatRupiah(totalValue)}</span>
                                  ) : totalValue < 0 ? (
                                    <span className="text-rose-700">-{formatRupiah(Math.abs(totalValue))}</span>
                                  ) : (
                                    <span className="text-slate-400">Rp 0</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Commit Action or Audit Info */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                      {isCommitted ? (
                        <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg p-2.5 text-xs flex items-center gap-2 w-full">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>
                            Opname telah di-commit pada {formatDateTimeIndo(opn.committedAt!)}. Jurnal penyesuaian selisih persediaan telah otomatis tercatat.
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs text-slate-500">
                            Status saat ini <strong>DRAFT</strong>. Memerlukan konfirmasi commit untuk memperbarui saldo persediaan sistem.
                          </div>
                          {canCommit && (
                            <button
                              onClick={() => handleCommit(opn.id)}
                              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition flex-shrink-0"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Commit & Catat Jurnal</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Buat Stock Opname Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                  <span>Formulir Stock Opname Baru</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pencatatan hitungan fisik persediaan per lokasi (Toko atau Gudang)
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDraft} className="space-y-4">
              {/* Lokasi Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Lokasi yang Dihitung:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLocationChange('TOKO')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-2 ${
                      selectedLocation === 'TOKO'
                        ? 'bg-sky-50 border-sky-400 text-sky-800 ring-2 ring-sky-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>LOKASI TOKO (Depan/Kasir)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLocationChange('GUDANG')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-2 ${
                      selectedLocation === 'GUDANG'
                        ? 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>LOKASI GUDANG (Belakang/Penyimpanan)</span>
                  </button>
                </div>
              </div>

              {/* Catatan / Keterangan */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan / Keterangan Opname (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Opname fisik berkala akhir bulan, pemeriksaan kardus minyak..."
                  value={opnameNotes}
                  onChange={e => setOpnameNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Table of Items */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Hitungan Fisik per Produk di {selectedLocation}:
                </label>
                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5">Produk</th>
                        <th className="p-2.5 text-right">Stok Sistem ({selectedLocation})</th>
                        <th className="p-2.5 text-right w-28">Fisik Sebenarnya</th>
                        <th className="p-2.5 text-right">Selisih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {opnameRows.map(row => {
                        const variance = row.physicalQty - row.systemQtyLive;
                        return (
                          <tr key={row.productId} className="hover:bg-slate-50">
                            <td className="p-2.5">
                              <span className="font-semibold text-slate-800">{row.name}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">{row.productId}</span>
                            </td>
                            <td className="p-2.5 text-right font-mono font-medium text-slate-700">
                              {row.systemQtyLive} {row.unit}
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min="0"
                                value={row.physicalQty}
                                onChange={e => handlePhysicalQtyChange(row.productId, Number(e.target.value))}
                                className="w-20 px-2 py-1 border border-slate-300 rounded text-right font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 text-xs"
                              />
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold whitespace-nowrap">
                              {variance > 0 ? (
                                <span className="text-emerald-700">+{variance} {row.unit}</span>
                              ) : variance < 0 ? (
                                <span className="text-rose-700">{variance} {row.unit}</span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  Alur Stock Opname:
                </p>
                <p>
                  1. Data disimpan sebagai <strong>Draft</strong> agar dapat diperiksa ulang oleh tim.<br />
                  2. Saat di-commit, sistem secara otomatis menambah atau mengurangi layer persediaan di lokasi <strong>{selectedLocation}</strong>, serta memposting jurnal selisih persediaan (1310 vs 5900).
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition"
                >
                  Simpan Draft Opname
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
