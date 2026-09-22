import React, { useState, useMemo } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { runAuditForensicAZ, ForensicAuditReport, ForensicCheckItem } from '../../utils/auditForensicAZ';
import { formatDateTimeIndo } from '../../utils/formatters';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  FileSpreadsheet, 
  Database, 
  Sparkles, 
  Download,
  Fingerprint,
  Layers,
  ArrowRight
} from 'lucide-react';

interface AuditForensicAZViewProps {
  onOpenInspector?: () => void;
}

export const AuditForensicAZView: React.FC<AuditForensicAZViewProps> = ({ onOpenInspector }) => {
  const { db, sales, inventoryLayers, journals, cashSessions, purchases, customers, suppliers } = useAppDatabase();
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('SEMUA');
  const [selectedStatus, setSelectedStatus] = useState<string>('SEMUA');
  const [expandedLetter, setExpandedLetter] = useState<string | null>(null);

  // Eksekusi screening forensik A-Z
  const report: ForensicAuditReport = useMemo(() => {
    return runAuditForensicAZ(db);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, refreshKey, sales, inventoryLayers, journals, cashSessions, purchases, customers, suppliers]);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  const categories = [
    'SEMUA',
    'Akuntansi',
    'Persediaan',
    'Kas & Kasir',
    'Penjualan',
    'Pembelian',
    'Keamanan & RBAC',
    'Integritas Relasional',
    'Kepatuhan & Sistem'
  ];

  const filteredItems = useMemo(() => {
    return report.items.filter(item => {
      const matchQuery = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.letter.toLowerCase() === searchQuery.toLowerCase() ||
        item.formula.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCategory = selectedCategory === 'SEMUA' || item.category === selectedCategory;
      const matchStatus = selectedStatus === 'SEMUA' || item.status === selectedStatus;

      return matchQuery && matchCategory && matchStatus;
    });
  }, [report.items, searchQuery, selectedCategory, selectedStatus]);

  const toggleExpand = (letter: string) => {
    setExpandedLetter(prev => (prev === letter ? null : letter));
  };

  const exportReportText = () => {
    const lines = [
      `============================================================`,
      `LAPORAN SCREENING AUDIT FORENSIK A–Z`,
      `ERP OMAH SEMBAKO SEHATI`,
      `Waktu Audit: ${formatDateTimeIndo(report.auditedAt)}`,
      `Status Keseluruhan: ${report.overallStatus}`,
      `Health Index: ${report.healthIndex}% (${report.passedCount}/${report.totalChecks} PASS)`,
      `============================================================\n`,
      `KESIMPULAN:`,
      `${report.conclusion}\n`,
      `DAFTAR TITIK KONTROL A–Z:\n`
    ];

    report.items.forEach(it => {
      lines.push(`[${it.letter}] ${it.name.toUpperCase()} [${it.status}]`);
      lines.push(`Kategori : ${it.category}`);
      lines.push(`Kriteria : ${it.formula}`);
      lines.push(`Hasil    : ${it.summary}`);
      it.metrics.forEach(m => {
        lines.push(`  - ${m.label}: ${m.value}`);
      });
      if (it.details && it.details.length > 0) {
        lines.push(`  Rincian Temuan:`);
        it.details.forEach(d => {
          lines.push(`    * ${d.title}: ${d.description}`);
        });
      }
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Audit-Forensik-AZ-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Ringkasan Audit Forensik */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        report.overallStatus === 'PASS'
          ? 'bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-white border-emerald-500/40 shadow-sm'
          : report.overallStatus === 'WARN'
            ? 'bg-gradient-to-br from-slate-900 via-amber-950 to-orange-950 text-white border-amber-500/40 shadow-sm'
            : 'bg-gradient-to-br from-slate-900 via-rose-950 to-red-950 text-white border-rose-500/40 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              report.overallStatus === 'PASS'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                : report.overallStatus === 'WARN'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
            }`}>
              <Fingerprint className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  report.overallStatus === 'PASS'
                    ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                    : report.overallStatus === 'WARN'
                      ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                      : 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                }`}>
                  {report.overallStatus === 'PASS' ? 'AUDIT FORENSIK LOLOS (100%)' : report.overallStatus === 'WARN' ? 'PERINGATAN AUDIT NON-KRITIS' : 'TEMUAN KRITIS (PERIKSA SEGERA)'}
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  {formatDateTimeIndo(report.auditedAt)}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                <span>Screening Audit Forensik A–Z</span>
                <span className="text-xs font-normal text-slate-300 px-2 py-0.5 rounded-md bg-white/10">
                  26 Titik Kontrol Otomatis
                </span>
              </h2>
              <p className="text-xs text-slate-200/90 mt-1 max-w-2xl leading-relaxed">
                {report.conclusion}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
            <button
              onClick={handleRefresh}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition border border-white/20"
              title="Jalankan ulang skrining forensik"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Skrining Ulang</span>
            </button>
            <button
              onClick={exportReportText}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              title="Unduh Laporan Audit Tekstual"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Hasil</span>
            </button>
            {onOpenInspector && (
              <button
                onClick={onOpenInspector}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-600"
                title="Buka Database Inspector"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Inspector</span>
              </button>
            )}
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-[11px] text-slate-300 block">Indeks Kesehatan Sistem</span>
            <span className="text-base font-extrabold text-white font-mono">{report.healthIndex}%</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-[11px] text-emerald-300 block">Titik Kontrol Lolos (PASS)</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">{report.passedCount} / {report.totalChecks}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-[11px] text-amber-300 block">Peringatan (WARN)</span>
            <span className="text-base font-extrabold text-amber-400 font-mono">{report.warnCount}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
            <span className="text-[11px] text-rose-300 block">Gagal (FAIL)</span>
            <span className="text-base font-extrabold text-rose-400 font-mono">{report.failedCount}</span>
          </div>
        </div>
      </div>

      {/* Alphabet Fast-Jump Ribbon (A to Z) */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pita Navigasi Forensik (A – Z)</span>
          </span>
          <span className="text-[11px] text-slate-500">
            Klik huruf untuk memusatkan pemeriksaan
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {report.items.map(item => {
            const isSelected = expandedLetter === item.letter;
            return (
              <button
                key={item.letter}
                onClick={() => {
                  toggleExpand(item.letter);
                  setSearchQuery('');
                  setSelectedCategory('SEMUA');
                }}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-extrabold flex items-center justify-center transition ${
                  item.status === 'PASS'
                    ? isSelected 
                      ? 'bg-emerald-700 text-white ring-2 ring-emerald-500 scale-105' 
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    : item.status === 'WARN'
                      ? isSelected
                        ? 'bg-amber-600 text-white ring-2 ring-amber-400 scale-105'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                      : isSelected
                        ? 'bg-rose-700 text-white ring-2 ring-rose-500 scale-105'
                        : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 animate-pulse'
                }`}
                title={`[${item.letter}] ${item.name} (${item.status})`}
              >
                {item.letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari huruf, nama kontrol, atau rumus forensik (misal: 'FIFO', 'Jurnal', 'Piutang')..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 shadow-2xs"
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
        >
          {categories.map(c => (
            <option key={c} value={c}>Kategori: {c}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
        >
          <option value="SEMUA">Status: Semua</option>
          <option value="PASS">Hanya PASS (Lolos)</option>
          <option value="WARN">Hanya WARN (Peringatan)</option>
          <option value="FAIL">Hanya FAIL (Gagal)</option>
        </select>
      </div>

      {/* List of 26 Checks (A to Z) */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
            Tidak ada titik kontrol yang sesuai dengan kriteria pencarian "{searchQuery}".
          </div>
        ) : (
          filteredItems.map(item => {
            const isExpanded = expandedLetter === item.letter;
            return (
              <div
                key={item.letter}
                className={`bg-white rounded-xl border transition-all ${
                  item.status === 'FAIL'
                    ? 'border-rose-300 shadow-xs'
                    : item.status === 'WARN'
                      ? 'border-amber-300 shadow-xs'
                      : isExpanded
                        ? 'border-emerald-400 shadow-xs'
                        : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(item.letter)}
                  className="p-3.5 sm:p-4 flex items-start justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-start gap-3">
                    {/* Big Letter Badge */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                      item.status === 'PASS'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        : item.status === 'WARN'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-rose-100 text-rose-900 border border-rose-200'
                    }`}>
                      {item.letter}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                          {item.name}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {item.formula}
                      </p>
                      <p className="text-xs text-slate-700 mt-1 font-medium">
                        {item.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                      item.status === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'WARN'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}>
                      {item.status === 'PASS' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : item.status === 'WARN' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      )}
                      <span>{item.status}</span>
                    </span>

                    <button className="text-slate-400 hover:text-slate-600 p-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-3.5 sm:p-4 pt-0 border-t border-slate-100 bg-slate-50/50 rounded-b-xl space-y-3">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      {item.metrics.map((m, idx) => (
                        <div 
                          key={idx} 
                          className={`p-2 rounded-lg border text-xs ${
                            m.isError 
                              ? 'bg-rose-50 border-rose-200 text-rose-900' 
                              : m.isWarning
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : m.isHighlight 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                                  : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <span className="text-[10px] text-slate-500 block leading-tight">{m.label}</span>
                          <span className="font-bold font-mono text-xs sm:text-sm block mt-0.5">{m.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Specific Detailed Findings if any */}
                    {item.details && item.details.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          Rincian Temuan Forensik ({item.details.length}):
                        </span>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {item.details.map((d, i) => (
                            <div key={i} className="p-2 rounded-lg bg-white border border-slate-200 text-xs">
                              <span className="font-semibold text-slate-900 block">{d.title}</span>
                              <span className="text-slate-600 text-[11px]">{d.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
