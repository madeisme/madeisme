import React, { useState } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { hasPermission } from '../../rbac/permissions';
import { formatDateTimeIndo } from '../../utils/formatters';
import { 
  ArrowLeftRight, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Truck, 
  Trash2,
  ArrowRight,
  ShieldCheck,
  PackageCheck
} from 'lucide-react';
import { StockLocation, StockTransferStatus } from '../../types/erp';

interface TransferLineFormItem {
  productId: string;
  qtyRequested: number;
}

export const StockTransferTab: React.FC = () => {
  const { 
    currentUser, 
    products, 
    stockTransfers, 
    stockTransferLines, 
    db 
  } = useAppDatabase();

  const [filterStatus, setFilterStatus] = useState<'ALL' | StockTransferStatus>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedTransferId, setExpandedTransferId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [fromLocation, setFromLocation] = useState<StockLocation>('GUDANG');
  const [toLocation, setToLocation] = useState<StockLocation>('TOKO');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferItems, setTransferItems] = useState<TransferLineFormItem[]>([]);

  const canCreate = hasPermission(currentUser?.role, 'STOCK_TRANSFER_CREATE');
  const canApprove = hasPermission(currentUser?.role, 'STOCK_TRANSFER_APPROVE');
  const canReceive = hasPermission(currentUser?.role, 'STOCK_TRANSFER_RECEIVE');

  const openCreateModal = () => {
    setFromLocation('GUDANG');
    setToLocation('TOKO');
    setTransferNotes('');
    if (products.length > 0) {
      setTransferItems([{ productId: products[0].id, qtyRequested: 1 }]);
    } else {
      setTransferItems([]);
    }
    setShowCreateModal(true);
    setActionFeedback(null);
  };

  const handleSwapRoute = () => {
    const newFrom = toLocation;
    const newTo = fromLocation;
    setFromLocation(newFrom);
    setToLocation(newTo);
  };

  const handleAddItem = () => {
    const unusedProduct = products.find(p => !transferItems.some(item => item.productId === p.id));
    if (unusedProduct) {
      setTransferItems(prev => [...prev, { productId: unusedProduct.id, qtyRequested: 1 }]);
    } else if (products.length > 0) {
      setTransferItems(prev => [...prev, { productId: products[0].id, qtyRequested: 1 }]);
    }
  };

  const handleRemoveItem = (idx: number) => {
    setTransferItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: 'productId' | 'qtyRequested', value: any) => {
    setTransferItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'qtyRequested') {
        return { ...item, qtyRequested: Math.max(1, Math.round(Number(value))) };
      }
      return { ...item, productId: value };
    }));
  };

  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (transferItems.length === 0) {
      setActionFeedback({ type: 'error', message: 'Minimal harus ada 1 item yang ditransfer.' });
      return;
    }

    // Validate stocks at source location
    for (const item of transferItems) {
      const avail = db.getProductStockByLocation(item.productId, fromLocation);
      const prod = products.find(p => p.id === item.productId);
      if (item.qtyRequested > avail) {
        setActionFeedback({
          type: 'error',
          message: `Stok ${prod?.name || item.productId} di ${fromLocation} tidak cukup (tersedia: ${avail}, diminta: ${item.qtyRequested}).`
        });
        return;
      }
    }

    try {
      const newTransfer = db.createStockTransfer({
        fromLocation,
        toLocation,
        businessDate: db.getSystemBusinessDate(),
        userId: currentUser.id,
        notes: transferNotes.trim() || undefined,
        lines: transferItems.map(item => ({
          productId: item.productId,
          qtyRequested: item.qtyRequested
        }))
      });

      setShowCreateModal(false);
      setExpandedTransferId(newTransfer.id);
      setActionFeedback({
        type: 'success',
        message: `Transfer ${newTransfer.id} berhasil diajukan (DRAFT). Menunggu persetujuan.`
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Gagal membuat Transfer Stok.'
      });
    }
  };

  const handleApprove = (transferId: string) => {
    if (!currentUser) return;
    if (!window.confirm('Setujui transfer ini? Dokumen transfer akan berstatus disetujui (APPROVED) dan siap untuk diterima di lokasi tujuan.')) {
      return;
    }

    try {
      db.approveStockTransfer({ transferId, approvedBy: currentUser.id });
      setActionFeedback({
        type: 'success',
        message: `Transfer ${transferId} berhasil disetujui! Petugas di lokasi tujuan kini dapat mengonfirmasi penerimaan barang.`
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Gagal menyetujui transfer stok.'
      });
    }
  };

  const handleReceive = (transferId: string) => {
    if (!currentUser) return;
    if (!window.confirm('Konfirmasi penerimaan barang penuh? Layer persediaan FIFO dari lokasi asal akan dipindahkan ke lokasi tujuan.')) {
      return;
    }

    const lines = stockTransferLines.filter(l => l.transferId === transferId);
    const receiveItems = lines.map(line => ({
      productId: line.productId,
      qtyReceived: Math.max(0, line.qtyRequested - line.qtyReceivedCumulative)
    })).filter(item => item.qtyReceived > 0);

    if (receiveItems.length === 0) {
      setActionFeedback({ type: 'error', message: 'Semua item dalam transfer ini sudah selesai diterima.' });
      return;
    }

    try {
      db.receiveStockTransfer({
        transferId,
        userId: currentUser.id,
        items: receiveItems
      });
      setActionFeedback({
        type: 'success',
        message: `Transfer ${transferId} berhasil diterima penuh (COMPLETED)! Stok telah masuk ke lokasi tujuan dengan mempertahankan umur dan HPP FIFO asli.`
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Gagal mengonfirmasi penerimaan transfer stok.'
      });
    }
  };

  const filteredTransfers = stockTransfers.filter(tr => {
    if (filterStatus === 'ALL') return true;
    return tr.status === filterStatus;
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

      {/* Control Bar: Filter & Create Transfer */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 mr-1">Status:</span>
          {(['ALL', 'DRAFT', 'APPROVED', 'RECEIVING', 'COMPLETED'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                filterStatus === st 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'Semua' : st === 'DRAFT' ? 'Draft' : st === 'APPROVED' ? 'Disetujui' : st === 'RECEIVING' ? 'Sebagian Diterima' : 'Selesai'}
            </button>
          ))}
        </div>

        {canCreate && (
          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Transfer Antar Lokasi</span>
          </button>
        )}
      </div>

      {/* Transfer List */}
      {filteredTransfers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 space-y-2">
          <Truck className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-xs font-medium">Belum ada data Transfer Stok {filterStatus !== 'ALL' ? `dengan status ${filterStatus}` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransfers.map(tr => {
            const isExpanded = expandedTransferId === tr.id;
            const lines = stockTransferLines.filter(l => l.transferId === tr.id);
            const totalRequested = lines.reduce((acc, l) => acc + l.qtyRequested, 0);
            const totalReceived = lines.reduce((acc, l) => acc + l.qtyReceivedCumulative, 0);

            return (
              <div 
                key={tr.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition"
              >
                {/* Header Row */}
                <div 
                  onClick={() => setExpandedTransferId(isExpanded ? null : tr.id)}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 flex-shrink-0">
                      <Truck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-slate-900">{tr.id}</span>
                        
                        {/* Route Badge */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300">
                          <span className={tr.fromLocation === 'TOKO' ? 'text-sky-700' : 'text-amber-700'}>{tr.fromLocation}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          <span className={tr.toLocation === 'TOKO' ? 'text-sky-700' : 'text-amber-700'}>{tr.toLocation}</span>
                        </span>

                        {/* Status Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          tr.status === 'COMPLETED' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : tr.status === 'APPROVED' || tr.status === 'RECEIVING'
                            ? 'bg-sky-100 text-sky-800 border border-sky-300'
                            : 'bg-amber-50 text-amber-800 border border-amber-300'
                        }`}>
                          {tr.status === 'COMPLETED' 
                            ? 'COMPLETED (SELESAI)' 
                            : tr.status === 'APPROVED' 
                            ? 'APPROVED (DISETUJUI)' 
                            : tr.status === 'RECEIVING'
                            ? 'RECEIVING (SEBAGIAN)'
                            : 'DRAFT (MENUNGGU PERSETUJUAN)'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span>Dibuat: {formatDateTimeIndo(tr.createdAt)} oleh <strong className="text-slate-700">{tr.userId}</strong></span>
                        {tr.notes && (
                          <span className="italic text-slate-400">• "{tr.notes}"</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-700">
                        {lines.length} Macam Produk
                      </span>
                      <span className="block text-[10px] font-bold text-slate-500">
                        {totalReceived} / {totalRequested} unit diterima
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
                    {/* Item lines */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="p-2.5">Produk</th>
                            <th className="p-2.5 text-right">Qty Diminta</th>
                            <th className="p-2.5 text-right">Qty Diterima</th>
                            <th className="p-2.5 text-center">Status Barang</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {lines.map(line => {
                            const prod = products.find(p => p.id === line.productId);
                            const isFullyReceived = line.qtyReceivedCumulative >= line.qtyRequested;

                            return (
                              <tr key={line.id} className="hover:bg-slate-50/60">
                                <td className="p-2.5">
                                  <span className="font-semibold text-slate-800">{prod?.name || line.productId}</span>
                                  <span className="text-[10px] text-slate-400 block font-mono">{line.productId}</span>
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                  {line.qtyRequested} {prod?.unit}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                                  {line.qtyReceivedCumulative} {prod?.unit}
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                                    isFullyReceived 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : tr.status === 'DRAFT'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-sky-100 text-sky-800'
                                  }`}>
                                    {isFullyReceived 
                                      ? 'Selesai di ' + tr.toLocation 
                                      : tr.status === 'DRAFT' 
                                      ? 'Menunggu Persetujuan' 
                                      : 'Siap Diterima di ' + tr.toLocation}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Timeline Audit Logs */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span><strong>Dibuat (Draft):</strong> {formatDateTimeIndo(tr.createdAt)} oleh {tr.userId}</span>
                      </div>
                      {tr.approvedBy && (
                        <div className="flex items-center gap-2 text-sky-900">
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                          <span><strong>Disetujui:</strong> oleh {tr.approvedBy}</span>
                        </div>
                      )}
                      {tr.completedAt && (
                        <div className="flex items-center gap-2 text-emerald-900">
                          <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span><strong>Selesai Diterima Penuh:</strong> {formatDateTimeIndo(tr.completedAt)}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Flow */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                      {tr.status === 'DRAFT' && (
                        <>
                          <div className="text-xs text-slate-500">
                            Transfer masih berstatus <strong>DRAFT</strong>. Memerlukan persetujuan staf berwenang untuk memindahkan barang dari {tr.fromLocation}.
                          </div>
                          {canApprove && (
                            <button
                              onClick={() => handleApprove(tr.id)}
                              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition flex-shrink-0"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Setujui Transfer (Approve)</span>
                            </button>
                          )}
                        </>
                      )}

                      {(tr.status === 'APPROVED' || tr.status === 'RECEIVING') && (
                        <>
                          <div className="text-xs text-sky-800 bg-sky-50 p-2.5 rounded-lg border border-sky-200 flex-1">
                            Transfer telah disetujui. Petugas di <strong>{tr.toLocation}</strong> dapat memeriksa fisik barang dan mengonfirmasi penerimaan barang.
                          </div>
                          {canReceive && (
                            <button
                              onClick={() => handleReceive(tr.id)}
                              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition flex-shrink-0"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Konfirmasi Terima Barang</span>
                            </button>
                          )}
                        </>
                      )}

                      {tr.status === 'COMPLETED' && (
                        <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg p-2.5 text-xs flex items-center gap-2 w-full">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>
                            Transfer persediaan telah selesai penuh. Layer persediaan aktif di {tr.toLocation} telah berhasil dialokasikan dengan HPP dan umur FIFO asli.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Buat Transfer Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
                  <span>Pengajuan Transfer Antar Lokasi</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pindahkan barang dari Gudang ke Toko (atau sebaliknya) dengan pemindahan layer FIFO otomatis
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTransfer} className="space-y-4">
              {/* Route Selector */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Rute Pemindahan Stok:</span>
                  <button
                    type="button"
                    onClick={handleSwapRoute}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200"
                  >
                    <ArrowLeftRight className="w-3 h-3" /> Tukar Rute
                  </button>
                </div>

                <div className="grid grid-cols-11 gap-2 items-center text-xs">
                  <div className="col-span-5 p-2.5 rounded-lg border bg-white border-slate-300">
                    <span className="text-[10px] text-slate-400 block font-medium uppercase">Lokasi Asal (Keluar)</span>
                    <span className={`font-bold ${fromLocation === 'TOKO' ? 'text-sky-700' : 'text-amber-700'}`}>
                      {fromLocation} ({fromLocation === 'TOKO' ? 'Depan/Display Toko' : 'Gudang Penyimpanan'})
                    </span>
                  </div>

                  <div className="col-span-1 flex justify-center text-slate-400">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  <div className="col-span-5 p-2.5 rounded-lg border bg-white border-slate-300">
                    <span className="text-[10px] text-slate-400 block font-medium uppercase">Lokasi Tujuan (Masuk)</span>
                    <span className={`font-bold ${toLocation === 'TOKO' ? 'text-sky-700' : 'text-amber-700'}`}>
                      {toLocation} ({toLocation === 'TOKO' ? 'Depan/Display Toko' : 'Gudang Penyimpanan'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Pengiriman / Keperluan Transfer
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Restock etalase toko untuk akhir pekan, pemindahan stok beras..."
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Transfer Item Rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Daftar Produk yang Dipindahkan:
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Baris
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {transferItems.map((item, idx) => {
                    const avail = db.getProductStockByLocation(item.productId, fromLocation);
                    const prod = products.find(p => p.id === item.productId);

                    return (
                      <div 
                        key={idx} 
                        className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center gap-2 text-xs"
                      >
                        <div className="flex-1">
                          <select
                            value={item.productId}
                            onChange={e => handleItemChange(idx, 'productId', e.target.value)}
                            className="w-full p-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                          >
                            {products.map(p => {
                              const stockAtFrom = db.getProductStockByLocation(p.id, fromLocation);
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.id}) — Tersedia di {fromLocation}: {stockAtFrom} {p.unit}
                                </option>
                              );
                            })}
                          </select>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Stok tersedia di {fromLocation}: <strong className={avail > 0 ? 'text-emerald-700' : 'text-rose-600'}>{avail} {prod?.unit}</strong>
                          </div>
                        </div>

                        <div className="w-24">
                          <label className="text-[10px] text-slate-400 block">Qty Kirim</label>
                          <input
                            type="number"
                            min="1"
                            max={avail > 0 ? avail : 1}
                            value={item.qtyRequested}
                            onChange={e => handleItemChange(idx, 'qtyRequested', e.target.value)}
                            className="w-full p-1.5 border border-slate-300 rounded text-right font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 text-xs"
                          />
                        </div>

                        {transferItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Info banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-600">
                Setelah diajukan, transfer berstatus <strong>DRAFT</strong>. Ketika disetujui (Approve), barang siap diterima. Saat barang sampai di lokasi tujuan dan dikonfirmasi (Receive), layer FIFO dipindahkan ke <strong>{toLocation}</strong> dengan biaya HPP dan umur batch persediaan tetap terpelihara secara presisi.
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
                  Ajukan Transfer (Draft)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
