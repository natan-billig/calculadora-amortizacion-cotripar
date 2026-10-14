import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Key, CheckCircle2, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, showToast }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const res = await login(username, password);
    setIsSubmitting(false);

    if (res.success) {
      showToast(`¡Bienvenido, ${username}!`);
      onClose();
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
      onClose();
    } else {
      setErrorMsg(res.error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-cotripar-100 text-cotripar-800 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Iniciar Sesión en Cotripar</h2>
          <p className="text-xs text-slate-500">
            Plataforma de Simulación y Análisis Financiero de Créditos
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
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="miguel o vendedor1"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Contraseña</label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 text-sm font-bold text-white bg-cotripar-700 hover:bg-cotripar-800 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Ingresar al Sistema</span>
          </button>
        </form>

        {/* Quick Access Accounts */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
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
              className="p-2.5 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-left transition-colors"
            >
              <p className="text-xs font-bold text-slate-800">Vendedor</p>
              <p className="text-[10px] text-blue-700 font-semibold">Ventas (cotripar123)</p>
            </button>
          </div>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
          >
            Cerrar ventana
          </button>
        </div>
      </div>
    </div>
  );
};
