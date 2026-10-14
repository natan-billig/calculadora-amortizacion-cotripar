import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Key, CheckCircle2, AlertCircle } from 'lucide-react';

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

  const handleQuickLogin = async (userLogin: string, pass: string) => {
    setErrorMsg('');
    setIsSubmitting(true);
    const res = await login(userLogin, pass);
    setIsSubmitting(false);

    if (res.success) {
      showToast(`Sesión iniciada como ${userLogin}`);
      onLoginSuccess();
    } else {
      setErrorMsg(res.error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Top Header Banner in Cotripar Red */}
        <div className="bg-cotripar-700 p-6 text-center text-white relative">
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto p-2 shadow-md flex items-center justify-center">
            <img
              src="/logo.png"
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
                  placeholder="miguel o vendedor1"
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
          </form>

          {/* Quick Access for Easy Demonstration / Testing */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
              Acceso Rápido de Prueba
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('miguel', 'admin123')}
                className="p-2.5 border border-slate-200 hover:border-cotripar-300 hover:bg-cotripar-50 rounded-xl text-left transition-colors"
              >
                <p className="text-xs font-bold text-slate-800">Miguel Abellá</p>
                <p className="text-[10px] text-cotripar-700 font-semibold">Admin (admin123)</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('vendedor1', 'cotripar123')}
                className="p-2.5 border border-slate-200 hover:border-cotripar-300 hover:bg-cotripar-50 rounded-xl text-left transition-colors"
              >
                <p className="text-xs font-bold text-slate-800">Vendedor</p>
                <p className="text-[10px] text-slate-500 font-semibold">Ventas (cotripar123)</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="text-center mt-6 text-xs text-slate-400">
        <p>Cotripar S.A. • RUC: 80019076-9 • Paraguay</p>
      </div>
    </div>
  );
};
