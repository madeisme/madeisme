import React, { useState, useEffect } from 'react';
import { useAppDatabase } from './database/useAppDatabase';
import { TopAppBar } from './components/layout/TopAppBar';
import { BottomNav, TabDestination } from './components/layout/BottomNav';
import { BerandaScreen } from './screens/BerandaScreen';
import { KasirScreen } from './screens/KasirScreen';
import { BeliScreen } from './screens/BeliScreen';
import { StokScreen } from './screens/StokScreen';
import { OperasionalScreen } from './screens/OperasionalScreen';
import { FirstRunSetupScreen } from './screens/FirstRunSetupScreen';
import { SettingsModal } from './components/pengaturan/SettingsModal';
import { DatabaseInspectorModal } from './components/inspector/DatabaseInspectorModal';
import { hasPermission } from './rbac/permissions';
import { Wifi, Battery, Signal, Database, AlertTriangle, RefreshCw } from 'lucide-react';

export default function App() {
  const { store, currentUser, kasirCart, products, inventoryLayers, purchases, db } = useAppDatabase();
  const [activeTab, setActiveTab] = useState<TabDestination>(db.activeTab);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileFrame, setIsMobileFrame] = useState(true);

  const isFirstRun = db.isFirstRun();

  // Prompt 7 §5: "Ketika user aktif diganti, state RBAC langsung menyesuaikan:
  // tombol-tombol yang tidak boleh diakses role tersebut langsung hilang/disabled,
  // menu yang dilarang langsung ditutup kalau sedang dibuka."
  useEffect(() => {
    if (isSettingsOpen && !hasPermission(currentUser.role, 'SETTINGS_VIEW')) {
      setIsSettingsOpen(false);
    }
  }, [currentUser.role, isSettingsOpen]);

  // Sync active tab to db repository
  const handleTabChange = (tab: TabDestination) => {
    setActiveTab(tab);
    db.activeTab = tab;
  };

  // 1. Loading splash screen while waiting for IndexedDB initialization
  if (!db.isReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center mb-4">
          <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-base font-bold text-white tracking-wide">Omah Sembako Sehati</h2>
        <p className="text-xs text-slate-400 font-mono mt-1">Memuat database lokal IndexedDB...</p>
      </div>
    );
  }

  // 2. Error Screen with Retry if IndexedDB reading failed or table read anomaly (Prompt 18 Bagian B.3)
  if (db.loadError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold uppercase tracking-wider">
              Proteksi Integritas Data
            </span>
            <h2 className="text-lg font-bold text-white">Gagal Membaca Database Lokal</h2>
            <p className="text-xs text-rose-300 leading-relaxed bg-rose-950/40 border border-rose-900/60 rounded-xl p-3 text-left font-mono">
              {db.loadError}
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed text-left">
              Sistem menolak menulis data awal (skeleton) di atas database Anda demi mencegah kehilangan data asli. Silakan tekan tombol di bawah untuk mencoba membaca ulang.
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <button
              onClick={() => db.retryInitStorage()}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Coba Baca Ulang (Retry)</span>
            </button>
            <button
              onClick={() => setIsInspectorOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
            >
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Buka Database Inspector</span>
            </button>
          </div>
        </div>
        <DatabaseInspectorModal
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
        />
      </div>
    );
  }

  // 3. If first-run condition: show onboarding screen (Prompt 7 §3 & Prompt 18)
  if (isFirstRun) {
    return (
      <FirstRunSetupScreen
        onSetupComplete={(newUser, newStore) => {
          setActiveTab('beranda');
          db.activeTab = 'beranda';
        }}
      />
    );
  }

  // Badges calculations
  const cartItemsCount = kasirCart.reduce((sum, item) => sum + item.qty, 0);

  const lowStockCount = products.filter(product => {
    const totalQty = inventoryLayers
      .filter(l => l.productId === product.id)
      .reduce((sum, l) => sum + l.quantityRemaining, 0);
    return totalQty <= (product.minStockAlert || 5);
  }).length;

  const pendingPoCount = purchases.filter(p => 
    p.status === 'DRAFT' || p.status === 'APPROVED' || p.status === 'RECEIVING'
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-800 flex flex-col items-center justify-start p-0 md:p-4">
      {/* Top Application Header */}
      <div className="w-full max-w-5xl">
        <TopAppBar
          store={store}
          currentUser={currentUser}
          onOpenInspector={() => setIsInspectorOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isMobileFrame={isMobileFrame}
          onToggleMobileFrame={() => setIsMobileFrame(!isMobileFrame)}
        />
      </div>

      {/* Main Container: Mobile Frame vs Responsive Desktop */}
      <main className="w-full max-w-5xl flex-1 flex flex-col items-center justify-start mt-0 md:mt-3">
        <div
          className={`w-full transition-all duration-300 flex flex-col bg-slate-100 overflow-hidden ${
            isMobileFrame
              ? 'max-w-md h-[88vh] md:h-[844px] rounded-none md:rounded-[40px] shadow-2xl border-0 md:border-[10px] md:border-slate-850 relative ring-1 ring-slate-800'
              : 'max-w-5xl rounded-none md:rounded-2xl shadow-xl border-0 md:border border-slate-800 min-h-[80vh]'
          }`}
        >
          {/* Simulated Android Status Bar (Only in Mobile Frame mode) */}
          {isMobileFrame && (
            <div className="bg-slate-900 text-slate-300 px-6 py-1.5 flex items-center justify-between text-[11px] font-mono select-none flex-shrink-0">
              <span className="font-semibold">09:41</span>
              {/* Camera punch-hole simulation */}
              <div className="w-3.5 h-3.5 rounded-full bg-black hidden md:block"></div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Signal className="w-3 h-3" />
                <Wifi className="w-3 h-3" />
                <Battery className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

          {/* Persistent Screens Viewport (Aturan §3: Pindah tab TIDAK mereset state tab asal) */}
          <div className="flex-1 overflow-y-auto relative bg-slate-100">
            {/* Tab 1: Beranda */}
            <div
              id="screen-beranda"
              style={{ display: activeTab === 'beranda' ? 'block' : 'none' }}
              className="min-h-full"
            >
              <BerandaScreen
                onNavigate={handleTabChange}
                onOpenInspector={() => setIsInspectorOpen(true)}
              />
            </div>

            {/* Tab 2: Kasir */}
            <div
              id="screen-kasir"
              style={{ display: activeTab === 'kasir' ? 'block' : 'none' }}
              className="h-full"
            >
              <KasirScreen onOpenInspector={() => setIsInspectorOpen(true)} />
            </div>

            {/* Tab 3: Beli */}
            <div
              id="screen-beli"
              style={{ display: activeTab === 'beli' ? 'block' : 'none' }}
              className="min-h-full"
            >
              <BeliScreen onOpenInspector={() => setIsInspectorOpen(true)} />
            </div>

            {/* Tab 4: Stok */}
            <div
              id="screen-stok"
              style={{ display: activeTab === 'stok' ? 'block' : 'none' }}
              className="min-h-full"
            >
              <StokScreen onNavigate={handleTabChange} />
            </div>

            {/* Tab 5: Operasional */}
            <div
              id="screen-operasional"
              style={{ display: activeTab === 'operasional' ? 'block' : 'none' }}
              className="min-h-full"
            >
              <OperasionalScreen onOpenInspector={() => setIsInspectorOpen(true)} />
            </div>
          </div>

          {/* Android Material 3 Bottom Navigation Bar */}
          <BottomNav
            activeTab={activeTab}
            onTabChange={handleTabChange}
            cartCount={cartItemsCount}
            lowStockCount={lowStockCount}
            pendingPoCount={pendingPoCount}
          />
        </div>
      </main>

      {/* Database Inspector Modal */}
      <DatabaseInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />

      {/* Pengaturan & Kelola User Modal (Prompt 7 §4) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onTriggerFirstRun={() => {
          setIsSettingsOpen(false);
        }}
      />
    </div>
  );
}
