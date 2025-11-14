'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';

interface OnboardingProps {
  theme: 'dark' | 'light';
  onClose: () => void;
}

type Placement = 'top' | 'bottom' | 'left' | 'right';

type TourStep = {
  id: string;
  selector: string;
  title: string;
  description: string;
  placement: Placement;
  accent: string;
  radius?: number;
  padding?: number;
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

const BASE_STEPS: TourStep[] = [
  {
    id: 'new-chat',
    selector: '[data-tour="new-chat"]',
    title: 'Start something new',
    description: 'Begin a fresh thread at any time. Humbl keeps every conversation organized while you explore ideas.',
    placement: 'bottom',
    accent: '#f1d08c',
    radius: 14,
    padding: 14,
  },
  {
    id: 'composer',
    selector: '[data-tour="composer"]',
    title: 'Write your prompt here',
    description: 'Drop in questions, paste research, or dictate a note. Suggestions appear as you type to keep you moving.',
    placement: 'top',
    accent: '#8b5cf6',
    radius: 20,
    padding: 18,
  },
  {
    id: 'web-search',
    selector: '[data-tour="web-search"]',
    title: 'Control live search',
    description: 'Toggle between auto, on, and off to decide when Humbl should pull real-time answers from the web.',
    placement: 'right',
    accent: '#0ea5e9',
    radius: 999,
    padding: 14,
  },
  {
    id: 'voice-tools',
    selector: '[data-tour="voice-tools"]',
    title: 'Voice and media tools',
    description: 'Attach images, speak your prompt, or send the message from this tray. Everything you need is within reach.',
    placement: 'top',
    accent: '#f97316',
    radius: 18,
    padding: 18,
  },
  {
    id: 'sidebar',
    selector: '[data-tour="sidebar"]',
    title: 'Navigate and organize',
    description: 'Browse history, group conversations into projects, switch modes, or update your profile from the sidebar.',
    placement: 'right',
    accent: '#14b8a6',
    radius: 24,
    padding: 18,
  },
];

const overlayByTheme = {
  dark: 'rgba(2, 6, 23, 0.72)',
  light: 'rgba(15, 23, 42, 0.45)',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function Onboarding({ theme, onClose }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<Rect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const calloutRef = useRef<HTMLDivElement | null>(null);
  const [calloutSize, setCalloutSize] = useState({ width: 0, height: 0 });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const overlayColor = overlayByTheme[theme];

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const steps = useMemo(() => {
    if (viewport.width && viewport.width < 768) {
      return BASE_STEPS.filter((step) => step.id !== 'sidebar');
    }
    return BASE_STEPS;
  }, [viewport.width]);

  useEffect(() => {
    if (steps.length === 0) {
      handleComplete();
    } else if (currentStep >= steps.length) {
      setCurrentStep(steps.length - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const current = steps[currentStep];

  const updateSpotlight = useCallback(() => {
    if (!current || typeof document === 'undefined') {
      return;
    }

    const element = document.querySelector(current.selector) as HTMLElement | null;

    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    if (element) {
      setTargetMissing(false);
      const rect = element.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      });

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          const r = element.getBoundingClientRect();
          setSpotlightRect({
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          });
        });
        observer.observe(element);
        resizeObserverRef.current = observer;
      }
    } else {
      setTargetMissing(true);
      setSpotlightRect(null);
    }
  }, [current]);

  useEffect(() => {
    if (!current) return;

    updateSpotlight();
    const handleScroll = () => updateSpotlight();
    window.addEventListener('scroll', handleScroll, true);
    const timeoutId = window.setTimeout(updateSpotlight, 220);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.clearTimeout(timeoutId);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [current, updateSpotlight]);

  useEffect(() => {
    updateSpotlight();
  }, [viewport, updateSpotlight]);

  useLayoutEffect(() => {
    if (!calloutRef.current) return;
    const rect = calloutRef.current.getBoundingClientRect();
    if (Math.abs(rect.width - calloutSize.width) > 1 || Math.abs(rect.height - calloutSize.height) > 1) {
      setCalloutSize({ width: rect.width, height: rect.height });
    }
  }, [currentStep, spotlightRect, viewport, targetMissing]);

  const highlight = useMemo(() => {
    if (!spotlightRect || !current || viewport.width === 0 || viewport.height === 0) {
      return null;
    }
    const padding = current.padding ?? 18;
    const radius = current.radius ?? 18;

    const top = clamp(spotlightRect.top - padding, 8, viewport.height - 16);
    const left = clamp(spotlightRect.left - padding, 8, viewport.width - 16);
    const width = Math.min(spotlightRect.width + padding * 2, viewport.width - left - 8);
    const height = Math.min(spotlightRect.height + padding * 2, viewport.height - top - 8);

    return { top, left, width, height, radius };
  }, [spotlightRect, current, viewport]);

  const calloutStyle = useMemo(() => {
    if (!current || viewport.width === 0 || viewport.height === 0) {
      return null;
    }

    const width = calloutSize.width || Math.min(360, viewport.width - 32);
    const height = calloutSize.height || 200;

    if (!highlight || targetMissing) {
      const centeredTop = clamp((viewport.height - height) / 2, 16, viewport.height - height - 16);
      const centeredLeft = clamp((viewport.width - width) / 2, 16, viewport.width - width - 16);
      return { top: centeredTop, left: centeredLeft, width };
    }

    const padding = 24;
    let top: number;
    let left: number;

    switch (current.placement) {
      case 'top':
        top = highlight.top - height - padding;
        left = highlight.left + highlight.width / 2 - width / 2;
        break;
      case 'left':
        top = highlight.top + highlight.height / 2 - height / 2;
        left = highlight.left - width - padding;
        break;
      case 'right':
        top = highlight.top + highlight.height / 2 - height / 2;
        left = highlight.left + highlight.width + padding;
        break;
      case 'bottom':
      default:
        top = highlight.top + highlight.height + padding;
        left = highlight.left + highlight.width / 2 - width / 2;
        break;
    }

    top = clamp(top, 16, viewport.height - height - 16);
    left = clamp(left, 16, viewport.width - width - 16);

    return { top, left, width };
  }, [current, highlight, targetMissing, viewport, calloutSize]);

  const connector = useMemo(() => {
    if (!highlight || !calloutStyle || calloutSize.width === 0 || calloutSize.height === 0 || targetMissing) {
      return null;
    }

    const highlightCenter = {
      x: highlight.left + highlight.width / 2,
      y: highlight.top + highlight.height / 2,
    };

    const anchor = { x: calloutStyle.left + calloutSize.width / 2, y: calloutStyle.top + calloutSize.height / 2 };

    switch (current.placement) {
      case 'top':
        anchor.y = calloutStyle.top + calloutSize.height;
        break;
      case 'bottom':
        anchor.y = calloutStyle.top;
        break;
      case 'left':
        anchor.x = calloutStyle.left + calloutSize.width;
        break;
      case 'right':
        anchor.x = calloutStyle.left;
        break;
      default:
        break;
    }

    return { start: highlightCenter, end: anchor };
  }, [highlight, calloutStyle, calloutSize, targetMissing, current]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep === 0) return;
    setCurrentStep((prev) => prev - 1);
  };

  function handleComplete() {
    try {
      localStorage.setItem('humbl_onboarding_completed', 'true');
    } catch (error) {
      // ignore
    }
    onClose();
  }

  if (!current) {
    return null;
  }

  const calloutBg = theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : '#ffffff';
  const calloutBorder = theme === 'dark' ? 'rgba(148, 163, 184, 0.24)' : 'rgba(15, 23, 42, 0.14)';
  const titleColor = theme === 'dark' ? '#f8fafc' : '#0f172a';
  const bodyColor = theme === 'dark' ? '#cbd5f5' : '#1f2937';
  const subTextColor = theme === 'dark' ? '#94a3b8' : '#64748b';

  const calloutWidth = calloutStyle?.width || Math.min(360, viewport.width ? viewport.width - 32 : 320);

  return (
    <div className="fixed inset-0 z-[150] pointer-events-none">
      {viewport.width > 0 && (
        <svg
          className="fixed inset-0 z-[150] pointer-events-none"
          width={viewport.width}
          height={viewport.height}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
        >
          <defs>
            <mask id="humbl-tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {highlight && (
                <rect
                  x={highlight.left}
                  y={highlight.top}
                  width={highlight.width}
                  height={highlight.height}
                  rx={highlight.radius}
                  ry={highlight.radius}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill={overlayColor} mask="url(#humbl-tour-mask)" />
        </svg>
      )}

      {highlight && (
        <div
          className="fixed z-[151] pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: highlight.top - 2,
            left: highlight.left - 2,
            width: highlight.width + 4,
            height: highlight.height + 4,
            borderRadius: highlight.radius + 6,
            border: `2px solid ${current.accent}`,
            boxShadow: `0 0 0 4px ${current.accent}1a, 0 20px 50px ${current.accent}40`,
          }}
        />
      )}

      {connector && viewport.width > 0 && (
        <svg
          className="fixed inset-0 pointer-events-none z-[152]"
          width={viewport.width}
          height={viewport.height}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        >
          <line
            x1={connector.start.x}
            y1={connector.start.y}
            x2={connector.end.x}
            y2={connector.end.y}
            stroke={current.accent}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="6 8"
            opacity={0.65}
          />
        </svg>
      )}

      <div className="absolute top-6 right-6 z-[153] flex items-center gap-3 pointer-events-auto">
        <button
          type="button"
          onClick={handleComplete}
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] rounded-full transition-colors duration-150"
          style={{
            backgroundColor: 'transparent',
            color: theme === 'dark' ? '#e2e8f0' : '#1f2937',
            border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(15, 23, 42, 0.14)'}`,
          }}
        >
          Skip tour
        </button>
        <button
          type="button"
          aria-label="Close onboarding"
          onClick={handleComplete}
          className="h-10 w-10 flex items-center justify-center rounded-full transition-colors duration-150"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.85)' : '#f1f5f9',
            color: theme === 'dark' ? '#cbd5f5' : '#475569',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {calloutStyle && (
        <div
          ref={calloutRef}
          className="fixed z-[154] pointer-events-auto"
          style={{
            top: calloutStyle.top,
            left: calloutStyle.left,
            width: calloutWidth,
            transition: 'top 0.25s ease, left 0.25s ease',
          }}
        >
          <div
            className="relative rounded-3xl p-6 shadow-2xl"
            style={{
              backgroundColor: calloutBg,
              border: `1px solid ${calloutBorder}`,
              boxShadow: `0 28px 80px ${theme === 'dark' ? 'rgba(2, 6, 23, 0.55)' : 'rgba(15, 23, 42, 0.25)'}`,
            }}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: current.accent }}>
              <Sparkles size={14} />
              <span>Guided tour</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold leading-snug" style={{ color: titleColor }}>
              {current.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: bodyColor }}>
              {current.description}
            </p>
            {targetMissing && (
              <p className="mt-3 text-xs italic" style={{ color: subTextColor }}>
                Make sure this part of the interface is visible to see the highlight.
              </p>
            )}

            <div
              className="mt-5 flex flex-col gap-4 border-t pt-4"
              style={{ borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.24)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className="px-3 py-2 rounded-xl text-sm font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.85)' : '#e2e8f0',
                    color: theme === 'dark' ? '#f8fafc' : '#1f2937',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </div>
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {steps.map((step, index) => (
                      <span
                        key={step.id}
                        className="h-2 w-2 rounded-full transition-colors duration-200"
                        style={{
                          backgroundColor:
                            index === currentStep
                              ? current.accent
                              : theme === 'dark'
                              ? 'rgba(148, 163, 184, 0.35)'
                              : 'rgba(148, 163, 184, 0.45)',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium" style={{ color: subTextColor }}>
                    Step {currentStep + 1} of {steps.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-transform duration-150 hover:scale-[1.02]"
                  style={{
                    backgroundColor: current.accent,
                    color: '#0b1727',
                  }}
                >
                  <span>{currentStep === steps.length - 1 ? 'Finish' : 'Next'}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

