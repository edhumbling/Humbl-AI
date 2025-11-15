'use client';

import { useEffect, useState, useRef } from 'react';
import { Download, X, Sparkles } from 'lucide-react';

interface PWAInstallPromptProps {
  theme: 'dark' | 'light';
}

export default function PWAInstallPrompt({ theme }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const promptShownRef = useRef(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('humbl_pwa_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
      return;
    }

    // Check if this is a first-time user (hasn't completed onboarding or used the app)
    const onboardingCompleted = localStorage.getItem('humbl_onboarding_completed');
    const pwaPromptShown = localStorage.getItem('humbl_pwa_prompt_shown');
    
    // Only show to first-time users who haven't seen the prompt before
    // Show if: onboarding not completed OR (onboarding completed but prompt never shown)
    // Also check if we're on a platform that supports PWA installation
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const supportsPWA = 'serviceWorker' in navigator && ('PushManager' in window || isMobile);
    
    if (supportsPWA && !pwaPromptShown && !promptShownRef.current) {
      // Wait a bit after page load before showing (longer if onboarding was just completed)
      const delay = onboardingCompleted ? 5000 : 3000;
      const timer = setTimeout(() => {
        setShowPrompt(true);
        promptShownRef.current = true;
        localStorage.setItem('humbl_pwa_prompt_shown', 'true');
      }, delay);

      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser install prompt
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // Check if mobile device
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isIOS) {
      // iOS requires manual installation via Safari share menu
      // Show instructions instead
      alert('To install on iOS:\n\n1. Tap the Share button at the bottom\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm');
      handleDismiss();
      return;
    }

    if (!deferredPrompt) {
      // If no deferred prompt (mobile Android), show instructions
      if (isMobile) {
        alert('To install on Android:\n\n1. Tap the menu (3 dots) in your browser\n2. Select "Install app" or "Add to Home screen"\n3. Confirm installation');
      }
      handleDismiss();
      return;
    }

    // Show the install prompt (desktop browsers)
    deferredPrompt.prompt();

    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setShowPrompt(false);
      localStorage.setItem('humbl_pwa_installed', 'true');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setIsDismissed(true);
    localStorage.setItem('humbl_pwa_dismissed', 'true');
  };

  // Don't show if already installed, dismissed, or no prompt available
  if (isInstalled || isDismissed || !showPrompt) {
    return null;
  }

  const isDark = theme === 'dark';
  const accentColor = '#f1d08c';
  const bgColor = isDark ? 'rgba(15, 23, 42, 0.95)' : '#ffffff';
  const borderColor = isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(15, 23, 42, 0.14)';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#cbd5f5' : '#1f2937';
  const mutedTextColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <>
      {/* Blurred backdrop */}
      <div
        className="fixed inset-0 z-[140] transition-opacity duration-300"
        style={{
          backgroundColor: isDark ? 'rgba(2, 6, 23, 0.65)' : 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={handleDismiss}
      />

      {/* Install Prompt Card */}
      <div
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[141] w-full max-w-md mx-4 pointer-events-auto"
        style={{
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        <div
          className="relative rounded-3xl p-6 shadow-2xl"
          style={{
            backgroundColor: bgColor,
            border: `1px solid ${borderColor}`,
            boxShadow: `0 28px 80px ${isDark ? 'rgba(2, 6, 23, 0.55)' : 'rgba(15, 23, 42, 0.25)'}`,
          }}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full transition-colors duration-150"
            style={{
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
              color: isDark ? '#cbd5f5' : '#475569',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>

          {/* Icon and header */}
          <div className="flex items-start gap-4 pr-8">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl flex-shrink-0"
              style={{ backgroundColor: `${accentColor}1a` }}
            >
              <Download size={24} color={accentColor} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} color={accentColor} />
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.28em]"
                  style={{ color: accentColor }}
                >
                  Install App
                </span>
              </div>
              <h3 className="text-lg font-semibold leading-snug mt-2" style={{ color: textColor }}>
                Install Humbl AI for a better experience
              </h3>
              <p className="text-sm leading-relaxed mt-2" style={{ color: subTextColor }}>
                Get faster access, work offline, and enjoy a native app-like experience right from your home screen.
              </p>
            </div>
          </div>

          {/* Benefits list */}
          <ul className="mt-4 space-y-2">
            {[
              'Faster loading and smoother performance',
              'Works offline for your saved conversations',
              'Quick access from your home screen',
            ].map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-sm" style={{ color: mutedTextColor }}>
                <div
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
                {benefit}
              </li>
            ))}
          </ul>

          {/* Action buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleInstallClick}
              className="w-full px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: accentColor,
                color: '#0b1727',
              }}
            >
              <Download size={18} />
              <span>Install Now</span>
            </button>
            <button
              onClick={handleDismiss}
              className="w-full px-5 py-2 rounded-xl text-sm font-medium transition-colors duration-150"
              style={{
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
                color: isDark ? '#cbd5f5' : '#475569',
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </>
  );
}

