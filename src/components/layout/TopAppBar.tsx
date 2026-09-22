import React, { useState } from 'react';
import { Store, User, UserRole } from '../../types/erp';
import { db } from '../../database/appDatabase';
import { hasPermission } from '../../rbac/permissions';
import { 
  Database, 
  Smartphone, 
  Monitor, 
  UserCheck, 
  RotateCcw,
  Sparkles,
  Settings
} from 'lucide-react';

interface TopAppBarProps {
  store: Store;
  currentUser: User;
  onOpenInspector: () => void;
  onOpenSettings?: () => void;
  isMobileFrame: boolean;
  onToggleMobileFrame: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  store,
  currentUser,
  onOpenInspector,
  onOpenSettings,
  isMobileFrame,
  onToggleMobileFrame,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const users = db.getAllUsers();

  const handleSelectUser = (user: User) => {
    db.setCurrentUser(user);
    setShowRoleMenu(false);
  };

  const roleColors: Record<UserRole, string> = {
    OWNER: 'bg-amber-100 text-amber-900 border-amber-300',
    ADMIN: 'bg-blue-100 text-blue-900 border-blue-300',
    BOOKKEEPER: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    KASIR: 'bg-purple-100 text-purple-900 border-purple-300',
    GUDANG: 'bg-orange-100 text-orange-900 border-orange-300',
  };

  return (
    <header className="bg-slate-900 text-slate-100 px-4 py-3 shadow-md select-none border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Store Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0 text-sm">
            OS
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sm sm:text-base truncate tracking-tight text-white">
                {store.name}
              </h1>
              <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                Offline-First Room DB
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden xs:block truncate">
              Native Android ERP Architecture • Kotlin & Jetpack Compose
            </p>
          </div>
        </div>

        {/* Right Actions: Role Switcher, Database Inspector, Frame Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Role Switcher */}
          <div className="relative">
            <button
              id="role-switcher-btn"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 text-xs px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition"
              title="Ganti Role User untuk Uji RBAC"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="max-w-[70px] sm:max-w-[110px] truncate font-medium">
                {currentUser.name}
              </span>
              <span className={`text-[10px] font-bold px-1 rounded border ${roleColors[currentUser.role]}`}>
                {currentUser.role}
              </span>
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-850 rounded-xl shadow-2xl border border-slate-700 py-1.5 z-50 bg-slate-900">
                <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-medium text-slate-400">
                  Pilih User Aktif (Simulasi RBAC):
                </div>
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                      u.id === currentUser.id ? 'bg-slate-800/80 text-emerald-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate">{u.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${roleColors[u.role]}`}>
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Database Inspector Action */}
          <button
            id="database-inspector-btn"
            onClick={onOpenInspector}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition"
            title="Buka Room Database Inspector"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DB Inspector</span>
          </button>

          {/* Pengaturan / Settings Action: OWNER & ADMIN only (Prompt 7 §4) */}
          {hasPermission(currentUser.role, 'SETTINGS_VIEW') && onOpenSettings && (
            <button
              id="open-settings-btn"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Buka Pengaturan & Kelola User (Prompt 7)"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Pengaturan</span>
            </button>
          )}

          {/* Device Frame Toggle */}
          <button
            id="frame-toggle-btn"
            onClick={onToggleMobileFrame}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title={isMobileFrame ? "Beralih ke Tampilan Penuh" : "Beralih ke Android Phone Frame"}
          >
            {isMobileFrame ? (
              <Monitor className="w-4 h-4 text-slate-300" />
            ) : (
              <Smartphone className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
