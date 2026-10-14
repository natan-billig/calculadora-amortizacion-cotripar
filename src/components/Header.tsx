import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calculator, History, Settings, Users, LogOut, ChevronDown, UserCheck } from 'lucide-react';

interface HeaderProps {
  currentTab: 'calculadora' | 'historial' | 'tasas' | 'usuarios';
  setCurrentTab: (tab: 'calculadora' | 'historial' | 'tasas' | 'usuarios') => void;
  openLoginModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, setCurrentTab, openLoginModal }) => {
  const { currentUser, isAdmin, logout, switchUser, availableUsers } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('calculadora')}>
            <img
              src="/logo.png"
              alt="Cotripar S.A. Logo"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                // fallback if image not found
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-cotripar-800 leading-tight tracking-tight flex items-center gap-1.5">
                COTRIPAR S.A.
                <span className="text-xs px-2 py-0.5 bg-cotripar-100 text-cotripar-800 rounded font-semibold border border-cotripar-200">
                  USD ($)
                </span>
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Calculadora Financiera de Amortización • Sistema Alemán
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setCurrentTab('calculadora')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
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
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
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
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'tasas'
                  ? 'bg-cotripar-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Tasas Bancarias</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setCurrentTab('usuarios')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentTab === 'usuarios'
                    ? 'bg-cotripar-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Usuarios</span>
              </button>
            )}
          </nav>

          {/* User Profile & Quick Switcher */}
          <div className="relative">
            {currentUser ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-2.5 p-1.5 pr-2.5 rounded-full hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-cotripar-700 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                    {currentUser.nombre.substring(0, 2)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-semibold text-slate-800 leading-none">
                      {currentUser.nombre}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium capitalize mt-0.5">
                      {currentUser.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showUserDropdown && (
                  <div
                    className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1"
                    onMouseLeave={() => setShowUserDropdown(false)}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-800">{currentUser.nombre}</p>
                      <p className="text-[11px] text-slate-500 truncate">@{currentUser.username}</p>
                    </div>

                    <div className="py-1">
                      <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Cambiar Usuario
                      </p>
                      {availableUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            switchUser(user);
                            setShowUserDropdown(false);
                          }}
                          className={`w-full text-left px-3.5 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 ${
                            user.id === currentUser.id ? 'font-semibold text-cotripar-700 bg-cotripar-50' : 'text-slate-700'
                          }`}
                        >
                          <span className="truncate">{user.nombre}</span>
                          {user.id === currentUser.id && <UserCheck className="w-3.5 h-3.5 text-cotripar-700" />}
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 pt-1">
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          logout();
                          openLoginModal();
                        }}
                        className="w-full text-left px-3.5 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openLoginModal}
                className="px-3.5 py-1.5 bg-cotripar-700 text-white rounded-lg text-xs font-semibold hover:bg-cotripar-800 transition-colors shadow-sm"
              >
                Iniciar Sesión
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
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
          {isAdmin && (
            <button
              onClick={() => setCurrentTab('usuarios')}
              className={`flex flex-col items-center py-1 px-2 rounded ${
                currentTab === 'usuarios' ? 'text-cotripar-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Users className="w-4 h-4 mb-0.5" />
              <span>Usuarios</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
