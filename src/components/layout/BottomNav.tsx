import React from 'react';
import { 
  Home, 
  ShoppingCart, 
  ShoppingBag, 
  Boxes, 
  ClipboardList 
} from 'lucide-react';

export type TabDestination = 'beranda' | 'kasir' | 'beli' | 'stok' | 'operasional';

interface BottomNavProps {
  activeTab: TabDestination;
  onTabChange: (tab: TabDestination) => void;
  cartCount: number;
  lowStockCount: number;
  pendingPoCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  cartCount,
  lowStockCount,
  pendingPoCount = 0
}) => {
  const tabs = [
    {
      id: 'beranda' as TabDestination,
      label: 'Beranda',
      icon: Home,
      badge: null
    },
    {
      id: 'kasir' as TabDestination,
      label: 'Kasir',
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null
    },
    {
      id: 'beli' as TabDestination,
      label: 'Beli',
      icon: ShoppingBag,
      badge: pendingPoCount > 0 ? pendingPoCount : null,
      badgeColor: 'bg-blue-600 text-white'
    },
    {
      id: 'stok' as TabDestination,
      label: 'Stok',
      icon: Boxes,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'operasional' as TabDestination,
      label: 'Operasional',
      icon: ClipboardList,
      badge: null
    }
  ];

  return (
    <nav 
      id="material3-bottom-navigation"
      className="bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] select-none z-30 flex-shrink-0"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center flex-1 py-1 group focus:outline-none"
            >
              {/* Material 3 Active Pill Container */}
              <div
                className={`relative px-4 py-1 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'}`} />
                
                {/* Badge (e.g. Keranjang items atau Stok menipis) */}
                {tab.badge !== null && (
                  <span
                    className={`absolute -top-1 -right-1 text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-sm ${
                      tab.badgeColor || 'bg-emerald-600 text-white animate-pulse'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              {/* Tab Label */}
              <span
                className={`text-[11px] mt-1 font-medium transition-colors duration-150 ${
                  isActive ? 'text-emerald-950 font-bold' : 'text-slate-500 group-hover:text-slate-700'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
