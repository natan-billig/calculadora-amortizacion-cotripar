import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calculator, History, Settings, Users, LogOut, ChevronDown, Lock, Tag } from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';
import { triggerPwaInstall, shouldShowInstallButton } from './InstallPwaPrompt';

interface HeaderProps {
  currentTab: 'calculadora' | 'historial' | 'tasas' | 'usuarios';
  setCurrentTab: (tab: 'calculadora' | 'historial' | 'tasas' | 'usuarios') => void;
  showToast: (msg: string) => void;
  onOpenBrandManager?: () => void;
}


export const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab, showToast, onOpenBrandManager }) => {
  const { currentUser, isAdmin, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand: Only image on mobile, full text on sm+ */}
          <div
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => setCurrentTab('calculadora')}
          >
            <img
              src="/logo.png"
              alt="Cotripar S.A. Logo"
              className="h-9 sm:h-10 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="hidden sm:flex flex-col">
              <span className="text-lg font-black text-cotripar-700 leading-tight tracking-tight flex items-center gap-1.5">
                COTRIPAR S.A.
                <span className="text-[10px] px-2 py-0.5 bg-cotripar-50 text-cotripar-700 rounded-full font-bold border border-cotripar-200">
                  USD ($)
                </span>
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Calculadora Financiera de Amortización • Sistema Alemán
              </span>
            </div>
          </div>

          {/* Navigation Tabs - ONLY for Admin! Sellers do not see Historial, Tasas, or Usuarios */}
          {isAdmin && (
            <nav className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => setCurrentTab('calculadora')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentTab === 'calculadora'
                    ? 'bg-cotripar-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>Calculadora</span>
              </button>

              <button
                onClick={() => setCurrentTab('historial')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentTab === 'historial'
                    ? 'bg-cotripar-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Historial</span>
              </button>

              <button
                onClick={() => setCurrentTab('tasas')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentTab === 'tasas'
                    ? 'bg-cotripar-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Tasas Bancarias</span>
              </button>

              <button
                onClick={() => setCurrentTab('usuarios')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentTab === 'usuarios'
                    ? 'bg-cotripar-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Usuarios</span>
              </button>

              <button
                onClick={onOpenBrandManager}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                title="Gestionar Marcas de Productos"
              >
                <Tag className="w-4 h-4 text-cotripar-700" />
                <span>Marcas</span>
              </button>
            </nav>
          )}

          {/* User Profile & Actions with USD badge on mobile */}
          <div className="flex items-center space-x-2">
            {shouldShowInstallButton() && (
              <button
                type="button"
                onClick={triggerPwaInstall}
                className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-cotripar-50 text-cotripar-700 hover:bg-cotripar-100 border border-cotripar-200 transition-colors shadow-sm"
                title="Instalar Aplicación Cotripar"
              >
                <span>📲</span>
                <span className="hidden sm:inline">Instalar App</span>
              </button>
            )}

            <span className="text-[10px] px-2 py-0.5 bg-cotripar-50 text-cotripar-700 rounded-full font-bold border border-cotripar-200 sm:hidden">
              USD ($)
            </span>

            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-2 p-1.5 pr-2.5 rounded-full hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-cotripar-700 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                    {currentUser.nombre.substring(0, 2)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-slate-800 leading-none">
                      {currentUser.nombre}
                    </p>
                    <p className="text-[10px] text-cotripar-700 font-semibold capitalize mt-0.5">
                      {currentUser.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showUserDropdown && (
                  <div
                    className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1"
                    onMouseLeave={() => setShowUserDropdown(false)}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-800">{currentUser.nombre}</p>
                      <p className="text-[11px] text-slate-500">@{currentUser.username}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-[9px] font-bold rounded-full ${
                        currentUser.rol === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {currentUser.rol === 'admin' ? 'Acceso Total (Admin)' : 'Asesor de Ventas'}
                      </span>
                    </div>

                    <div className="border-t border-slate-100 pt-1">
                      {shouldShowInstallButton() && (
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            triggerPwaInstall();
                          }}
                          className="md:hidden w-full text-left px-3.5 py-2 text-xs font-semibold text-cotripar-700 hover:bg-cotripar-50 flex items-center space-x-2 transition-colors"
                        >
                          <span>📲</span>
                          <span>Instalar Aplicación</span>
                        </button>
                      )}

                      {/* Password Change for All Profiles */}
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          setShowChangePassword(true);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Cambiar mi Contraseña</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          logout();
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Bar - ONLY if Admin */}
        {isAdmin && (
          <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 text-xs">
            <button
              onClick={() => setCurrentTab('calculadora')}
              className={`flex flex-col items-center py-1 px-2 rounded ${
                currentTab === 'calculadora' ? 'text-cotripar-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Calculator className="w-4 h-4 mb-0.5" />
              <span>Calculadora</span>
            </button>
            <button
              onClick={() => setCurrentTab('historial')}
              className={`flex flex-col items-center py-1 px-2 rounded ${
                currentTab === 'historial' ? 'text-cotripar-700 font-bold' : 'text-slate-500'
              }`}
            >
              <History className="w-4 h-4 mb-0.5" />
              <span>Historial</span>
            </button>
            <button
              onClick={() => setCurrentTab('tasas')}
              className={`flex flex-col items-center py-1 px-2 rounded ${
                currentTab === 'tasas' ? 'text-cotripar-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Settings className="w-4 h-4 mb-0.5" />
              <span>Tasas</span>
            </button>
            <button
              onClick={() => setCurrentTab('usuarios')}
              className={`flex flex-col items-center py-1 px-2 rounded ${
                currentTab === 'usuarios' ? 'text-cotripar-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Users className="w-4 h-4 mb-0.5" />
              <span>Usuarios</span>
            </button>
            <button
              onClick={onOpenBrandManager}
              className="flex flex-col items-center py-1 px-2 rounded text-slate-500 hover:text-cotripar-700"
              title="Gestionar Marcas"
            >
              <Tag className="w-4 h-4 mb-0.5" />
              <span>Marcas</span>
            </button>
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        showToast={showToast}
      />
    </header>
  );
};
