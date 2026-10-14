import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { APP_VERSION } from '../types';
import { triggerPwaInstall, shouldShowInstallButton } from './InstallPwaPrompt';

interface LoginScreenProps {
  showToast: (msg: string) => void;
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ showToast, onLoginSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const res = await login(username, password);
    setIsSubmitting(false);

    if (res.success) {
      showToast(`¡Bienvenido, ${username}!`);
      onLoginSuccess();
    } else {
      setErrorMsg(res.error || 'Credenciales inválidas');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Top Header Banner in Cotripar Red */}
        <div className="bg-cotripar-700 p-6 text-center text-white relative">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto p-2 shadow-md flex items-center justify-center">
            <img
              src="/logo_icone.png"
              alt="Cotripar S.A."
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight mt-3">COTRIPAR S.A.</h1>
          <p className="text-xs text-cotripar-100 font-medium mt-0.5">
            Plataforma de Simulación y Proyección de Créditos • Sistema Alemán
          </p>
          <div className="mt-2 inline-block">
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-cotripar-800 text-cotripar-100 rounded-full border border-cotripar-600/50">
              {APP_VERSION}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-base font-bold text-slate-800">Acceso al Sistema</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ingrese con sus credenciales de asesor o administrador
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Usuario</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingrese su usuario"
                  className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Contraseña</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 text-sm font-bold text-white bg-cotripar-700 hover:bg-cotripar-800 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Verificando...' : 'Ingresar al Sistema'}</span>
            </button>

            {shouldShowInstallButton() && (
              <button
                type="button"
                onClick={triggerPwaInstall}
                className="w-full py-2.5 px-4 text-xs font-bold text-cotripar-700 bg-cotripar-50 hover:bg-cotripar-100 border border-cotripar-200 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>📲 Instalar App</span>
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Footer Branding with APP_VERSION & Developer Credit */}
      <div className="text-center mt-6 text-xs text-slate-400 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <p>Cotripar S.A. • RUC: 80019076-9 • Paraguay</p>
          <span className="px-2 py-0.5 text-[10px] font-bold bg-white text-slate-500 rounded-full border border-slate-200">
            {APP_VERSION}
          </span>
        </div>
        <div className="pt-0.5 flex items-center justify-center">
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
      </div>
    </div>
  );
};
