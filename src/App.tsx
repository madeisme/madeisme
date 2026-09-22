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
import { Wifi, Battery, Signal, Database } from 'lucide-react';

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

  // If first-run condition: show onboarding screen (Prompt 7 §3)
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
              <StokScreen />
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
