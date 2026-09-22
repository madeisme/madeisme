import React, { useState, useEffect } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { hasPermission } from '../../rbac/permissions';
import { GeneralLedgerReport } from './GeneralLedgerReport';
import { TrialBalanceReport } from './TrialBalanceReport';
import { ProfitLossReport } from './ProfitLossReport';
import { BalanceSheetReport } from './BalanceSheetReport';
import { StockCardReport } from './StockCardReport';
import { 
  FileText, 
  Scale, 
  TrendingUp, 
  Landmark, 
  BookOpen, 
  Package, 
  Clock, 
  ShieldAlert,
  RefreshCw
} from 'lucide-react';

export type ReportSubTab = 'BUKU_BESAR' | 'NERACA_SALDO' | 'LABA_RUGI' | 'NERACA' | 'KARTU_STOK';

interface LaporanContainerProps {
  initialTab?: ReportSubTab;
}

export const LaporanContainer: React.FC<LaporanContainerProps> = ({ initialTab = 'NERACA_SALDO' }) => {
  const { 
    currentUser, 
    accounts, 
    journals, 
    journalLines, 
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
  } = useAppDatabase();

  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>(initialTab);
  const [liveTimestamp, setLiveTimestamp] = useState<string>('');

  const updateTimestamp = () => {
    const now = new Date();
    const formatted = now.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' WIB';
    setLiveTimestamp(formatted);
  };

  useEffect(() => {
    updateTimestamp();
    const timer = setInterval(updateTimestamp, 10000);
    return () => clearInterval(timer);
  }, []);

  // RBAC Access Control Check (§8) - Prompt 7: REPORT_VIEW (OWNER, ADMIN, BOOKKEEPER)
  const canViewReports = hasPermission(currentUser.role, 'REPORT_VIEW');

  if (!canViewReports) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md mx-auto my-8">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Akses Laporan Dibatasi</h3>
        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
          Menu Laporan Keuangan & Stok hanya dapat diakses oleh peran <strong>OWNER</strong>, <strong>ADMIN</strong>, dan <strong>BOOKKEEPER</strong>.
        </p>
        <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
          Peran Anda saat ini: <span className="font-mono font-bold text-slate-700">{currentUser.role}</span>
        </div>
      </div>
    );
  }

  const tabOptions: { id: ReportSubTab; label: string; icon: React.ReactNode; desc: string }[] = [
    { 
      id: 'NERACA_SALDO', 
      label: 'Neraca Saldo', 
      icon: <Scale className="w-4 h-4" />,
      desc: 'Keseimbangan mutasi masuk (debit) & keluar (kredit)' 
    },
    { 
      id: 'LABA_RUGI', 
      label: 'Laba Rugi', 
      icon: <TrendingUp className="w-4 h-4" />,
      desc: 'Penjualan toko (omzet), modal barang, & untung bersih' 
    },
    { 
      id: 'NERACA', 
      label: 'Neraca Keuangan', 
      icon: <Landmark className="w-4 h-4" />,
      desc: 'Harta toko (kas, stok), hutang supplier, & modal pemilik' 
    },
    { 
      id: 'BUKU_BESAR', 
      label: 'Buku Besar', 
      icon: <BookOpen className="w-4 h-4" />,
      desc: 'Rincian alur mutasi tiap pos akun & detail transaksi' 
    },
    { 
      id: 'KARTU_STOK', 
      label: 'Kartu Stok', 
      icon: <Package className="w-4 h-4" />,
      desc: 'Riwayat fisik keluar-masuk barang & sisa stok' 
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header & Live Timestamp Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <FileText className="w-5 h-5 text-emerald-600" />
            <span>Pusat Laporan Keuangan & Stok Sederhana</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Laporan otomatis real-time dihitung langsung dari data kasir, pembelian supplier, dan persediaan stok
          </p>
        </div>

        {/* Live Data Badge (§8) */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-100/80 border border-slate-200/80 px-2.5 py-1.5 rounded-lg text-xs">
          <Clock className="w-3.5 h-3.5 text-slate-500 animate-pulse" />
          <span className="text-[11px] text-slate-600 font-medium">
            Data per: <strong className="text-slate-900 font-mono">{liveTimestamp}</strong>
          </span>
          <button 
            onClick={updateTimestamp} 
            title="Refresh timestamp"
            className="p-1 hover:bg-slate-200 rounded text-slate-500 transition"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar">
        {tabOptions.map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition flex-1 justify-center ${
                isActive
                  ? 'bg-white text-emerald-950 shadow-2xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span className={isActive ? 'text-emerald-700' : 'text-slate-400'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report View Panel */}
      <div>
        {activeSubTab === 'BUKU_BESAR' && (
          <GeneralLedgerReport
            accounts={accounts}
            journals={journals}
            journalLines={journalLines}
            sales={sales}
            purchases={purchases}
          />
        )}

        {activeSubTab === 'NERACA_SALDO' && (
          <TrialBalanceReport
            accounts={accounts}
            journals={journals}
            journalLines={journalLines}
          />
        )}

        {activeSubTab === 'LABA_RUGI' && (
          <ProfitLossReport
            accounts={accounts}
            journals={journals}
            journalLines={journalLines}
          />
        )}

        {activeSubTab === 'NERACA' && (
          <BalanceSheetReport
            accounts={accounts}
            journals={journals}
            journalLines={journalLines}
          />
        )}

        {activeSubTab === 'KARTU_STOK' && (
          <StockCardReport
            products={products}
            inventoryLayers={inventoryLayers}
            sales={sales}
            saleLines={saleLines}
            saleReturns={saleReturns}
            purchases={purchases}
            purchaseReceipts={purchaseReceipts}
            purchaseReturns={purchaseReturns}
            stockOpnames={stockOpnames}
            stockOpnameLines={stockOpnameLines}
          />
        )}
      </div>
    </div>
  );
};
