import React, { useState, useMemo } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { runSystemHealthCheck, HealthCheckItem } from '../../utils/systemHealthCheck';
import { executeIntegrationScenario, ScenarioExecutionReport } from '../../utils/runScenarioTest';
import { formatDateTimeIndo } from '../../utils/formatters';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  FileText, 
  Check, 
  AlertTriangle,
  Info,
  Server,
  PlayCircle,
  Layers,
  Sparkles,
  Fingerprint
} from 'lucide-react';

interface SystemHealthCheckViewProps {
  onOpenInspector?: () => void;
  onSwitchToForensic?: () => void;
}

export const SystemHealthCheckView: React.FC<SystemHealthCheckViewProps> = ({ onOpenInspector, onSwitchToForensic }) => {
  const { db, sales, inventoryLayers, journals, cashSessions, purchases, customers, suppliers } = useAppDatabase();
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [scenarioReport, setScenarioReport] = useState<ScenarioExecutionReport | null>(null);
  const [isRunningScenario, setIsRunningScenario] = useState(false);

  // Jalankan health check otomatis saat dependensi data berubah atau tombol refresh ditekan
  const report = useMemo(() => {
    return runSystemHealthCheck(db);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, refreshKey, sales, inventoryLayers, journals, cashSessions, purchases, customers, suppliers]);

  const toggleExpand = (code: string) => {
    setExpandedItem(prev => (prev === code ? null : code));
  };

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  const handleRunScenario = () => {
    setIsRunningScenario(true);
    setTimeout(() => {
      try {
        const result = executeIntegrationScenario(db);
        setScenarioReport(result);
        setRefreshKey(k => k + 1);
      } finally {
        setIsRunningScenario(false);
      }
    }, 100);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Status Kesehatan Keseluruhan */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        report.overallStatus === 'PASS'
          ? 'bg-gradient-to-br from-emerald-900 to-teal-950 text-white border-emerald-700/60 shadow-sm'
          : 'bg-gradient-to-br from-rose-900 to-red-950 text-white border-rose-700/60 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              report.overallStatus === 'PASS' 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
            }`}>
              {report.overallStatus === 'PASS' ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  report.overallStatus === 'PASS'
                    ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                    : 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                }`}>
                  {report.overallStatus === 'PASS' ? 'SISTEM SEHAT & KONSISTEN' : 'PERHATIAN DIPERLUKAN'}
                </span>
                <span className="text-xs text-slate-300">
                  {formatDateTimeIndo(report.checkedAt)}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                Pemeriksaan Kesehatan Sistem (System Health Check)
              </h2>
              <p className="text-xs text-emerald-100/80 mt-0.5 max-w-xl leading-relaxed">
                {report.overallStatus === 'PASS' 
                  ? `Semua ${report.passedCount} dari ${report.totalChecks} parameter integritas akuntansi, stok FIFO, piutang, hutang, dan sesi kasir berstatus PASS.`
                  : `Ditemukan ${report.failedCount} parameter yang tidak sinkron. Periksa rincian diagnostik di bawah untuk penelusuran manual.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
            <button
              onClick={handleRunScenario}
              disabled={isRunningScenario}
              className="px-3 py-2 rounded-xl bg-emerald-400 text-emerald-950 hover:bg-emerald-300 text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              <span>{isRunningScenario ? 'Menjalankan...' : 'Uji Skenario 8 Langkah'}</span>
            </button>
            {onSwitchToForensic && (
              <button
                onClick={onSwitchToForensic}
                className="px-3 py-2 rounded-xl bg-teal-500/30 hover:bg-teal-500/40 text-teal-200 text-xs font-bold flex items-center gap-1.5 transition border border-teal-400/40 active:scale-95"
                title="Buka Skrining Audit Forensik 26 Titik Kontrol (A–Z)"
              >
                <Fingerprint className="w-3.5 h-3.5" />
                <span>Audit Forensik A–Z</span>
              </button>
            )}
            <button
              onClick={handleRefresh}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition border border-white/20 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Diagnostik</span>
            </button>
            {onOpenInspector && (
              <button
                onClick={onOpenInspector}
                className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition border border-emerald-400/30 active:scale-95"
              >
                <Server className="w-3.5 h-3.5" />
                <span>DB Inspector</span>
              </button>
            )}
          </div>
        </div>

        {/* Counter Pills */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10 text-center">
          <div className="bg-black/20 rounded-lg py-1.5 px-2">
            <span className="text-[10px] text-slate-300 block">Total Pengujian</span>
            <span className="text-sm font-bold text-white">{report.totalChecks} Checks</span>
          </div>
          <div className="bg-black/20 rounded-lg py-1.5 px-2">
            <span className="text-[10px] text-emerald-300 block">Lulus Uji (PASS)</span>
            <span className="text-sm font-bold text-emerald-400">{report.passedCount}</span>
          </div>
          <div className="bg-black/20 rounded-lg py-1.5 px-2">
            <span className="text-[10px] text-rose-300 block">Gagal Uji (FAIL)</span>
            <span className={`text-sm font-bold ${report.failedCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
              {report.failedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Skenario Regresi Report (Prompt 9 §6) */}
      {scenarioReport && (
        <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-700 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">
                Hasil Uji Skenario Lintas-Modul (8 Langkah Operasional)
              </h3>
            </div>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              scenarioReport.overallStatus === 'PASS' 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
            }`}>
              STATUS: {scenarioReport.overallStatus} (8/8)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {scenarioReport.steps.map(step => (
              <div 
                key={step.step}
                className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">
                    Langkah {step.step}: {step.title}
                  </span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                    step.status === 'PASS' ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'
                  }`}>
                    {step.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {step.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daftar Pengujian H1 - H6 */}
      <div className="space-y-3">
        {report.items.map((item: HealthCheckItem) => {
          const isPass = item.status === 'PASS';
          const isExpanded = expandedItem === item.code || !isPass;

          return (
            <div 
              key={item.code}
              className={`bg-white rounded-xl border transition-all shadow-2xs overflow-hidden ${
                isPass ? 'border-slate-200' : 'border-rose-300 ring-1 ring-rose-200'
              }`}
            >
              {/* Header Bar */}
              <div 
                onClick={() => toggleExpand(item.code)}
                className="p-3.5 sm:p-4 cursor-pointer hover:bg-slate-50/80 transition flex items-center justify-between gap-3 select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Status Badge Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                    isPass 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {isPass ? <CheckCircle2 className="w-5 h-5 text-emerald-700" /> : <XCircle className="w-5 h-5 text-rose-700" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {item.code}
                      </span>
                      <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                        {item.name}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isPass 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                      {item.formula}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Summary Bar */}
              <div className={`px-4 py-2 text-xs flex items-center gap-2 border-t ${
                isPass ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900' : 'bg-rose-50/60 border-rose-100 text-rose-900'
              }`}>
                {isPass ? (
                  <Check className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-700 flex-shrink-0" />
                )}
                <span className="text-[11px] font-medium leading-relaxed">
                  {item.summary}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="p-3 sm:p-4 bg-slate-50/50 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {item.metrics.map((m, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block">{m.label}</span>
                    <span className={`font-bold mt-0.5 block ${
                      m.isError 
                        ? 'text-rose-600 font-mono' 
                        : m.isHighlight 
                        ? 'text-emerald-700 font-mono' 
                        : 'text-slate-900'
                    }`}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Expandable Details Section (Shown when expanded or failed) */}
              {isExpanded && item.details && item.details.length > 0 && (
                <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span>Rincian Diagnostik Data</span>
                  </h4>
                  <div className="space-y-2">
                    {item.details.map(detail => (
                      <div key={detail.id} className="p-3 rounded-lg bg-white border border-slate-200 text-xs space-y-1.5">
                        <div className="font-semibold text-slate-900">{detail.title}</div>
                        <p className="text-[11px] text-slate-600">{detail.description}</p>
                        {detail.data && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5 border-t border-slate-100">
                            {Object.entries(detail.data).map(([key, val]) => (
                              <div key={key} className="bg-slate-50 p-1.5 rounded">
                                <span className="text-[9px] text-slate-500 block uppercase">{key}</span>
                                <span className="font-mono font-bold text-[11px] text-slate-900">{val}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
