import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Calculator } from './components/Calculator';
import { HistoryModal } from './components/HistoryModal';
import { BankManagerModal } from './components/BankManagerModal';
import { UserManagerModal } from './components/UserManagerModal';
import { LoginModal } from './components/LoginModal';
import { Toast } from './components/Toast';
import type { ResultadoAleman, SimulacionPDF } from './types';
import { supabase } from './lib/supabase';

const MainApp: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<'calculadora' | 'historial' | 'tasas' | 'usuarios'>('calculadora');
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadedSimulation, setLoadedSimulation] = useState<SimulacionPDF | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSaveSimulation = async (
    resultado: ResultadoAleman,
    clientInfo: { clienteNombre: string; clienteRuc: string; notas: string }
  ) => {
    try {
      const payload = {
        usuario_id: currentUser?.id || null,
        vendedor_nombre: currentUser?.nombre || 'Asesor Cotripar',
        cliente_nombre: clientInfo.clienteNombre,
        capital_usd: resultado.capital,
        gasto_admin_usd: resultado.gastoAdmin,
        banco_entidad: resultado.bancoEntidad || 'Banco Comercial',
        tasa_anual: resultado.tasaAnual,
        plazo_anios: resultado.plazoAnios,
        periodicidad: resultado.frecuencia,
        modalidad_semestral: resultado.modalidadSemestral || null,
        total_intereses_usd: resultado.totalIntereses,
        total_iva_usd: resultado.totalIva,
        costo_financiero_total_usd: resultado.costoFinancieroTotal,
        total_pagado_usd: resultado.totalPagado,
        mayor_cuota_anio1_usd: resultado.cuotaMayorAnio1,
        cronograma_json: resultado.cronograma
      };

      const { data, error } = await supabase
        .from('simulaciones_pdf')
        .insert(payload)
        .select()
        .single();

      if (!error && data) {
        showToast(`¡Simulación de "${clientInfo.clienteNombre}" guardada en Supabase!`);
      } else {
        console.error('Error saving to Supabase:', error);
        showToast('Error al guardar en Supabase. Verifique conexión.');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al guardar en Supabase');
    }
  };

  const handleLoadSimulation = (sim: SimulacionPDF) => {
    setLoadedSimulation(sim);
    setCurrentTab('calculadora');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openLoginModal={() => setIsLoginOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentTab === 'calculadora' && (
          <Calculator
            onSaveSimulation={handleSaveSimulation}
            onOpenBankManager={() => setCurrentTab('tasas')}
            showToast={showToast}
            initialSimulation={loadedSimulation}
          />
        )}

        {currentTab === 'historial' && (
          <HistoryModal
            onLoadSimulation={handleLoadSimulation}
            showToast={showToast}
          />
        )}

        {currentTab === 'tasas' && (
          <BankManagerModal showToast={showToast} />
        )}

        {currentTab === 'usuarios' && isAdmin && (
          <UserManagerModal showToast={showToast} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 space-y-1.5">
          <p className="font-bold text-slate-700">
            Cotripar S.A. — División de Finanzas & Maquinarias Agrícolas
          </p>
          <p className="text-[11px] text-slate-400">
            Casa Central: Supercarretera Itaipú Km 42 • Santa Rita, Alto Paraná, Paraguay • RUC: 80012345-0
          </p>
          <p className="text-[10px] text-slate-400 pt-1">
            Sistema de Amortización Alemán • Cómputo oficial de IVA 10% s/ Intereses y 1% Gasto Administrativo.
          </p>
        </div>
      </footer>

      {/* Modals & Notifications */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        showToast={showToast}
      />

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
