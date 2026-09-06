'use client';

import { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share } from 'lucide-react';

export function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already in standalone (PWA installed) mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem('pwa_banner_dismissed_at');
    if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 3 * 24 * 60 * 60 * 1000) {
      return;
    }

    // iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Listen for native Android/Desktop install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // On iOS Safari, show banner if not installed and on mobile
    if (isIosDevice && !isStandalone) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosTip(true);
      return;
    }

    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem('pwa_banner_dismissed_at', Date.now().toString());
    } catch {}
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-teal-500/30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* App Icon */}
          <div className="w-11 h-11 rounded-xl bg-white p-1 shadow-md shrink-0 flex items-center justify-center">
            <img src="/favicon.svg" alt="Manoj Medical Icon" className="w-full h-full rounded-lg" />
          </div>

          {/* Text Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-sm text-white truncate">Manoj Medical Hall App</h4>
              <span className="text-[10px] bg-teal-500/30 text-teal-200 px-1.5 py-0.5 rounded font-medium border border-teal-400/20">
                PWA
              </span>
            </div>
            <p className="text-xs text-teal-100/90 truncate">
              {isIos ? 'होम स्क्रीन पर ऐप जोड़ें' : '1-Tap Fast Mobile App • Offline Support'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-emerald-500 hover:bg-emerald-400 text-teal-950 font-bold text-xs px-3 py-2 rounded-xl shadow transition-all flex items-center gap-1.5 active:scale-95"
            >
              {isIos ? <Share className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isIos ? 'विधि' : 'Install'}</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-teal-300 hover:text-white rounded-lg transition"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* iOS Install Instruction Helper */}
        {showIosTip && (
          <div className="mt-2.5 pt-2.5 border-t border-teal-700/50 text-[11px] text-teal-100 flex items-start gap-2 bg-teal-950/40 p-2 rounded-lg">
            <Share className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">iPhone पर ऐप इंस्टॉल करने के लिए:</p>
              <p>नीचे Safari के <span className="font-bold text-emerald-300">Share (शेयर)</span> बटन पर टैप करें और <span className="font-bold text-emerald-300">"Add to Home Screen"</span> चुनें।</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
