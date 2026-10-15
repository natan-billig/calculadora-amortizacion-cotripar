import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Calculator } from './components/Calculator';
import { HistoryModal } from './components/HistoryModal';
import { BankManagerModal } from './components/BankManagerModal';
import { UserManagerModal } from './components/UserManagerModal';
import { BrandManagerModal } from './components/BrandManagerModal';
import { LoginScreen } from './components/LoginScreen';
import { Toast } from './components/Toast';
import { InstallPwaPrompt } from './components/InstallPwaPrompt';
import type { SimulacionPDF } from './types';
import { APP_VERSION } from './types';

const MainApp: React.FC = () => {
  const { currentUser, isAdmin, isCoordinatorOrAdmin, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<'calculadora' | 'historial' | 'tasas' | 'usuarios'>('calculadora');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadedSimulation, setLoadedSimulation] = useState<SimulacionPDF | null>(null);
  const [isBrandManagerOpen, setIsBrandManagerOpen] = useState<boolean>(false);


  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Tab access guard:
  // - Admin: 'calculadora' | 'historial' | 'tasas' | 'usuarios'
  // - Coordinador: 'calculadora' | 'historial'
  // - Vendedor: 'calculadora'
  useEffect(() => {
    if (currentUser) {
      if (currentUser.rol === 'vendedor' && currentTab !== 'calculadora') {
        setCurrentTab('calculadora');
      } else if (currentUser.rol === 'coordinador' && (currentTab === 'tasas' || currentTab === 'usuarios')) {
        setCurrentTab('calculadora');
      }
    }
  }, [currentUser, currentTab]);

  const handleLoadSimulation = (sim: SimulacionPDF) => {
    setLoadedSimulation(sim);
    setCurrentTab('calculadora');
  };

  // 1. Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-cotripar-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cargando Cotripar...</p>
        </div>
      </div>
    );
  }

  // 2. MANDATORY LOGIN: If not logged in, render EXCLUSIVELY full-screen login
  if (!currentUser) {
    return (
      <>
        <LoginScreen
          showToast={showToast}
          onLoginSuccess={() => setCurrentTab('calculadora')}
        />
        <InstallPwaPrompt />
        <Toast message={toastMessage} />
      </>
    );
  }

  // 3. Authenticated App
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        showToast={showToast}
        onOpenBrandManager={() => setIsBrandManagerOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentTab === 'calculadora' && (
          <Calculator
            onOpenBankManager={() => setCurrentTab('tasas')}
            onOpenBrandManager={() => setIsBrandManagerOpen(true)}
            showToast={showToast}
            initialSimulation={loadedSimulation}
          />
        )}

        {currentTab === 'historial' && isCoordinatorOrAdmin && (
          <HistoryModal
            onLoadSimulation={handleLoadSimulation}
            showToast={showToast}
          />
        )}

        {currentTab === 'tasas' && isAdmin && (
          <BankManagerModal showToast={showToast} />
        )}

        {currentTab === 'usuarios' && isAdmin && (
          <UserManagerModal showToast={showToast} />
        )}
      </main>

      {/* Brand Manager Modal (Admin and Coordinador) */}
      {isCoordinatorOrAdmin && (
        <BrandManagerModal
          isOpen={isBrandManagerOpen}
          onClose={() => setIsBrandManagerOpen(false)}
          showToast={showToast}
        />
      )}


      {/* Corporate Footer with Natan Billig signature & APP_VERSION */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print mt-auto">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-extrabold text-slate-800 text-sm">
            COMERCIO DE TRACTORES E IMPLEMENTOS DEL PARAGUAY (COTRIPAR) S.A.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-slate-500 font-medium">
            <span>RUC: 80019076-9 • Paraguay</span>
            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-cotripar-50 text-cotripar-700 rounded-full border border-cotripar-200">
              {APP_VERSION}
            </span>
          </div>
          <div className="pt-1 flex items-center justify-center">
            <a
              href="https://wa.me/595994195695"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-cotripar-50 hover:text-cotripar-700 hover:border-cotripar-200 shadow-sm transition-all group"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span>Developed by <strong className="font-bold text-slate-800 group-hover:text-cotripar-700">Natan Billig</strong></span>
            </a>
          </div>
          <p className="text-[10px] text-slate-400">
            Sistema de Amortización Alemán • Cómputo oficial de IVA 10% s/ Intereses y 1% Gasto Administrativo.
          </p>
        </div>
      </footer>

      <InstallPwaPrompt />
      <Toast message={toastMessage} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
