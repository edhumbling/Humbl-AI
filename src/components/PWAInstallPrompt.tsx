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
  const deferredPromptRef = useRef<any>(null);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user has dismissed the prompt recently (within last 7 days)
    const dismissed = localStorage.getItem('humbl_pwa_dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      // If dismissed less than 7 days ago, don't show again
      if (daysSinceDismissed < 7) {
        setIsDismissed(true);
        return;
      }
      // If dismissed more than 7 days ago, show again (remind existing users)
    }

    // Check if this is a first-time user or existing user
    const onboardingCompleted = localStorage.getItem('humbl_onboarding_completed');
    const pwaPromptShown = localStorage.getItem('humbl_pwa_prompt_shown');
    const lastReminderDate = localStorage.getItem('humbl_pwa_last_reminder');
    
    // Check if we're on a platform that supports PWA installation
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const supportsPWA = 'serviceWorker' in navigator && ('PushManager' in window || isMobile);
    
    if (!supportsPWA || promptShownRef.current) {
      return;
    }

    // For first-time users: show after 3-5 seconds
    // For existing users: show after 10 seconds, but only if last reminder was more than 7 days ago
    let shouldShow = false;
    let delay = 3000;

    if (!onboardingCompleted) {
      // First-time user - show quickly
      if (!pwaPromptShown) {
        shouldShow = true;
        delay = 3000;
      }
    } else {
      // Existing user - show reminder
      if (!lastReminderDate) {
        // Never shown to existing user before
        shouldShow = true;
        delay = 10000; // Wait 10 seconds for existing users
      } else {
        // Check if last reminder was more than 7 days ago
        const lastReminder = new Date(lastReminderDate);
        const daysSinceLastReminder = (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastReminder >= 7) {
          shouldShow = true;
          delay = 10000; // Wait 10 seconds for reminders
        }
      }
    }
    
    if (shouldShow) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
        promptShownRef.current = true;
        localStorage.setItem('humbl_pwa_prompt_shown', 'true');
        localStorage.setItem('humbl_pwa_last_reminder', new Date().toISOString());
        
        // If we already have a deferred prompt, trigger auto-install immediately
        if (deferredPromptRef.current) {
          setTimeout(() => {
            handleAutoInstall(deferredPromptRef.current);
          }, 500);
        }
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [deferredPrompt]);

  const handleAutoInstall = async (promptEvent: any) => {
    try {
      // Automatically show the browser's native install prompt
      await promptEvent.prompt();
      
      // Wait for the user to respond
      const { outcome } = await promptEvent.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowPrompt(false);
        localStorage.setItem('humbl_pwa_installed', 'true');
      } else {
        // User declined - show our custom prompt as fallback
        // The custom prompt is already showing, so we just keep it visible
      }
      
      // Clear the deferred prompt
      setDeferredPrompt(null);
      deferredPromptRef.current = null;
    } catch (error) {
      console.error('Auto-install failed:', error);
      // Fall back to showing custom prompt
    }
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser install prompt
      e.preventDefault();
      // Store the event for later use
      const promptEvent = e as any;
      setDeferredPrompt(promptEvent);
      deferredPromptRef.current = promptEvent;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Auto-trigger install prompt when it becomes available and our prompt is showing
  useEffect(() => {
    if (showPrompt && !isInstalled && !isDismissed && deferredPromptRef.current) {
      // Automatically trigger the browser's native install prompt
      // This makes installation feel automatic - the native prompt appears automatically
      const timer = setTimeout(() => {
        handleAutoInstall(deferredPromptRef.current);
      }, 800); // Small delay to let the custom prompt appear first
      
      return () => clearTimeout(timer);
    }
  }, [showPrompt, isInstalled, isDismissed]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Use the stored prompt event for automatic installation
      await handleAutoInstall(deferredPrompt);
      return;
    }

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

    // If no deferred prompt (mobile Android), show instructions
    if (isMobile) {
      alert('To install on Android:\n\n1. Tap the menu (3 dots) in your browser\n2. Select "Install app" or "Add to Home screen"\n3. Confirm installation');
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setIsDismissed(true);
    // Store dismissal with timestamp so we can remind again after 7 days
    localStorage.setItem('humbl_pwa_dismissed', new Date().toISOString());
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

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
        className={`fixed left-1/2 transform -translate-x-1/2 z-[141] w-full pointer-events-auto ${
          isMobile ? 'bottom-3 max-w-[calc(100%-24px)]' : 'bottom-6 max-w-md mx-4'
        }`}
        style={{
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        <div
          className={`relative shadow-2xl ${
            isMobile ? 'rounded-2xl p-4' : 'rounded-3xl p-6'
          }`}
          style={{
            backgroundColor: bgColor,
            border: `1px solid ${borderColor}`,
            boxShadow: `0 28px 80px ${isDark ? 'rgba(2, 6, 23, 0.55)' : 'rgba(15, 23, 42, 0.25)'}`,
          }}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className={`absolute rounded-full transition-colors duration-150 ${
              isMobile ? 'top-2 right-2 p-1' : 'top-4 right-4 p-1.5'
            }`}
            style={{
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
              color: isDark ? '#cbd5f5' : '#475569',
            }}
            aria-label="Close"
          >
            <X size={isMobile ? 14 : 16} />
          </button>

          {/* Icon and header */}
          <div className={`flex items-start gap-3 ${isMobile ? 'pr-7' : 'pr-8 gap-4'}`}>
            <div
              className={`flex items-center justify-center rounded-xl flex-shrink-0 ${
                isMobile ? 'h-9 w-9' : 'h-12 w-12 rounded-2xl'
              }`}
              style={{ backgroundColor: `${accentColor}1a` }}
            >
              <Download size={isMobile ? 18 : 24} color={accentColor} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`flex items-center gap-1.5 ${isMobile ? 'mb-0.5' : 'mb-1 gap-2'}`}>
                <Sparkles size={isMobile ? 12 : 14} color={accentColor} />
                <span
                  className={`font-semibold uppercase tracking-[0.28em] ${
                    isMobile ? 'text-[9px]' : 'text-[11px]'
                  }`}
                  style={{ color: accentColor }}
                >
                  Install App
                </span>
              </div>
              <h3
                className={`font-semibold leading-snug ${
                  isMobile ? 'text-sm mt-1' : 'text-lg mt-2'
                }`}
                style={{ color: textColor }}
              >
                {isMobile ? 'Install Humbl AI' : 'Install Humbl AI for a better experience'}
              </h3>
              {!isMobile && (
                <p className="text-sm leading-relaxed mt-2" style={{ color: subTextColor }}>
                  Get faster access, work offline, and enjoy a native app-like experience right from your home screen.
                </p>
              )}
              {isMobile && (
                <p className="text-xs leading-relaxed mt-1" style={{ color: mutedTextColor }}>
                  Quick access from your home screen
                </p>
              )}
            </div>
          </div>

          {/* Benefits list - Desktop only */}
          {!isMobile && (
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
          )}

          {/* Action buttons */}
          <div className={`flex flex-col gap-2 ${isMobile ? 'mt-3' : 'mt-6 gap-3'}`}>
            <button
              onClick={handleInstallClick}
              className={`w-full rounded-xl font-semibold flex items-center justify-center gap-2 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] ${
                isMobile ? 'px-4 py-2.5 text-xs' : 'px-5 py-3 text-sm'
              }`}
              style={{
                backgroundColor: accentColor,
                color: '#0b1727',
              }}
            >
              <Download size={isMobile ? 14 : 18} />
              <span>Install Now</span>
            </button>
            <button
              onClick={handleDismiss}
              className={`w-full rounded-xl font-medium transition-colors duration-150 ${
                isMobile ? 'px-4 py-2 text-xs' : 'px-5 py-2 text-sm'
              }`}
              style={{
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
                color: isDark ? '#cbd5f5' : '#475569',
              }}
            >
              {isMobile ? 'Later' : 'Maybe later'}
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

