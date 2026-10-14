import React, { useState, useEffect } from 'react';
import { X, Share, PlusSquare, MoreVertical, Smartphone, Check } from 'lucide-react';

export const triggerPwaInstall = () => {
  window.dispatchEvent(new Event('open-pwa-install'));
};

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (window.innerWidth >= 1024) return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 1024)
  );
};

export const isAppInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
};

export const shouldShowInstallButton = (): boolean => {
  return isMobileDevice() && !isAppInstalled();
};

export const InstallPwaPrompt: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // 0. Strictly do not run on desktop computers
    if (!isMobileDevice()) {
      return;
    }

    // 1. Check if already running standalone
    const standalone = isAppInstalled();
    setIsStandalone(standalone);

    if (standalone) {
      setIsOpen(false);
      return;
    }

    // 2. Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iosDevice);

    // 3. Open modal automatically when entering the site on mobile
    setIsOpen(true);

    // 4. Listen for manual install trigger from Login or Header
    const handleOpenModal = () => {
      if (isMobileDevice() && !isAppInstalled()) {
        setShowInstructions(false);
        setIsOpen(true);
      }
    };

    window.addEventListener('open-pwa-install', handleOpenModal);

    // 5. Update prompt if deferred prompt becomes ready
    const handlePromptReady = () => {
      // Prompt is now in (window as any).__deferredPwaPrompt
    };
    window.addEventListener('pwa-prompt-ready', handlePromptReady);

    // 6. Listen for appinstalled event to auto-close
    const handleAppInstalled = () => {
      setIsOpen(false);
      setIsStandalone(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('open-pwa-install', handleOpenModal);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isMobileDevice() || isStandalone || !isOpen) {
    return null;
  }

  const handleInstallClick = async () => {
    const promptEvent = (window as any).__deferredPwaPrompt;

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          (window as any).__deferredPwaPrompt = null;
          setIsOpen(false);
          setIsStandalone(true);
        }
      } catch (err) {
        console.warn('Error invoking native PWA prompt:', err);
        setShowInstructions(true);
      }
    } else if (isIOS) {
      setShowInstructions(true);
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-sm sm:max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-center relative space-y-5 animate-in zoom-in-95">
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          title="Cerrar aviso"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Square Icon in Cotripar Red with safe zone */}
        <div className="mx-auto w-20 h-20 bg-white rounded-2xl p-2 shadow-lg border border-slate-100 flex items-center justify-center">
          <img
            src="/logo_icone.png"
            alt="Cotripar S.A."
            className="w-full h-full object-contain"
          />
        </div>

        {/* Header Text */}
        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            Instalar Aplicación Cotripar
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed px-2">
            Instale la calculadora en la pantalla de inicio de su teléfono para acceso rápido, pantalla completa y mejor rendimiento.
          </p>
        </div>

        {/* Visual Instructions if Native Prompt Unavailable (e.g. iOS Safari) */}
        {showInstructions ? (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2.5 animate-in fade-in">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-cotripar-700 shrink-0" />
              <span>Instrucciones de instalación:</span>
            </p>
            {isIOS ? (
              <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                <li className="flex items-start gap-2">
                  <Share className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Toque el ícono <strong>Compartir</strong> en la barra inferior de Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <PlusSquare className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                  <span>
                    Seleccione <strong>"Agregar a Inicio"</strong> (Add to Home Screen) y confirme en <strong>"Agregar"</strong>.
                  </span>
                </li>
              </ol>
            ) : (
              <div className="text-xs text-slate-600 space-y-2 font-medium leading-relaxed">
                <div className="flex items-start gap-2">
                  <MoreVertical className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                  <span>
                    Toque el menú <strong>⋮</strong> arriba a la derecha de Chrome y seleccione <strong>"Instalar aplicación"</strong> (o "Agregar a la pantalla principal").
                  </span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full mt-2 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Entendido</span>
            </button>
          </div>
        ) : (
          /* Action Buttons */
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-3.5 px-4 text-sm font-extrabold text-white bg-cotripar-700 hover:bg-cotripar-800 active:bg-cotripar-900 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <span>📲 Instalar Aplicación Ahora</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Continuar en el navegador
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
