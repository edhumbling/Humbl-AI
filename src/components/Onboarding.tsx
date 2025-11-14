'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  BookOpen,
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  Keyboard,
  MessageSquare,
  Mic,
  Search,
  Shield,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';

interface OnboardingProps {
  theme: 'dark' | 'light';
  onClose: () => void;
}

type OnboardingStep = {
  id: string;
  title: string;
  tagline: string;
  description?: string;
  themeColor: string;
  type: 'welcome' | 'personalize' | 'features' | 'tips' | 'summary';
  helperText?: string;
  details?: Array<{
    icon: LucideIcon;
    title: string;
    description: string;
    accent?: string;
  }>;
  checklist?: string[];
};

type UseCaseOption = {
  id: string;
  label: string;
  description: string;
  highlights: string[];
  accent: string;
};

const useCaseOptions: UseCaseOption[] = [
  {
    id: 'brainstorm',
    label: 'Brainstorming & Creation',
    description: 'Generate new ideas, outlines, and creative variations in seconds.',
    highlights: ['Draft campaigns and story ideas', 'Expand bullet points into full copy', 'Remix existing assets quickly'],
    accent: '#8b5cf6',
  },
  {
    id: 'research',
    label: 'Research & Analysis',
    description: 'Instant summaries with smart web search to keep you informed.',
    highlights: ['Compare sources across the web', 'Summarize long PDFs or reports', 'Track trends and real-time updates'],
    accent: '#0ea5e9',
  },
  {
    id: 'operations',
    label: 'Operations & Support',
    description: 'Automate repetitive messaging and keep teams aligned.',
    highlights: ['Draft responses and email follow-ups', 'Create process docs effortlessly', 'Share conversations with teammates'],
    accent: '#f97316',
  },
];

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    type: 'welcome',
    title: 'Welcome to Humbl AI',
    tagline: 'Your collaborative copilot for research, creation, and support.',
    description: 'Let’s tailor your workspace in three short steps so you can get straight to doing your best work.',
    themeColor: '#f59e0b',
  },
  {
    id: 'personalize',
    type: 'personalize',
    title: 'What brings you to Humbl?',
    tagline: 'Select the scenarios that match your flow. We’ll keep suggestions relevant.',
    helperText: 'No pressure—pick one now, you can adjust anytime.',
    themeColor: '#6366f1',
  },
  {
    id: 'features',
    type: 'features',
    title: 'Things you can do right away',
    tagline: 'Each workspace is built for a different mode of thinking. Explore the essentials.',
    details: [
  {
    icon: MessageSquare,
        title: 'Chat Workspace',
        description: 'Converse with AI, branch ideas, and keep your history tidy with smart titles.',
        accent: '#f59e0b',
  },
  {
    icon: Globe,
        title: 'Live Web Search',
        description: 'Blend AI reasoning with real-time web answers when facts matter most.',
        accent: '#0ea5e9',
  },
  {
    icon: ImageIcon,
        title: 'Image Studio',
        description: 'Create and iterate visuals with prompts, remix existing files, and export instantly.',
        accent: '#f43f5e',
  },
  {
    icon: Mic,
        title: 'Hands-free Voice',
        description: 'Collect thoughts on the go using voice input and let Humbl transcribe for you.',
        accent: '#8b5cf6',
      },
    ],
    themeColor: '#14b8a6',
  },
  {
    id: 'tips',
    type: 'tips',
    title: 'Quick tips before you dive in',
    tagline: 'A few shortcuts to stay in flow and keep your workspace clean.',
    details: [
      {
        icon: Keyboard,
        title: 'Keyboard-first',
        description: 'Press `⌘ + /` to surface every shortcut without leaving your thread.',
        accent: '#f59e0b',
      },
      {
        icon: Search,
        title: 'Search everything',
        description: 'Use the global search bar to find past chats, files, or teammates instantly.',
        accent: '#6366f1',
      },
      {
        icon: Shield,
        title: 'Stay in control',
        description: 'Archive or share conversations with one click when they’re ready for prime time.',
        accent: '#22c55e',
      },
      {
        icon: BookOpen,
        title: 'Guided playbooks',
        description: 'Open the playbook sidebar for templates tailored to your selected use cases.',
        accent: '#f97316',
      },
    ],
    themeColor: '#ec4899',
  },
  {
    id: 'summary',
    type: 'summary',
    title: 'You’re all set',
    tagline: 'Here’s a quick recap and a recommended next step.',
    checklist: [
      'Personalized Humbl around your goals',
      'Saw the core workspaces you have access to',
      'Picked up the time-saving shortcuts',
    ],
    themeColor: '#10b981',
  },
];

export default function Onboarding({ theme, onClose }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);

  const current = onboardingSteps[currentStep];
  const progressPercentage = useMemo(() => ((currentStep + 1) / onboardingSteps.length) * 100, [currentStep]);
  const selectedUseCaseLabel = useMemo(
    () => useCaseOptions.find((option) => option.id === selectedUseCase)?.label ?? null,
    [selectedUseCase],
  );
  const isDarkMode = theme === 'dark';

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }
      handleComplete();
  };

  const handlePrevious = () => {
    if (currentStep === 0) {
      return;
    }
    setCurrentStep((prev) => prev - 1);
  };

  const handleComplete = () => {
    localStorage.setItem('humbl_onboarding_completed', 'true');
    onClose();
  };

  const renderWelcomeSection = () => {
    const highlights = [
      'Personalize Humbl around what you need today.',
      'Preview the workspaces and when to use each one.',
      'Leave with a clear next action so you can get started confidently.',
    ];

    return (
      <div className="space-y-6">
        <div
          className="rounded-3xl px-6 py-8 shadow-inner"
          style={{
            background: isDarkMode ? 'rgba(17, 24, 39, 0.75)' : '#f9fafb',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${current.themeColor}1a` }}
            >
              <Sparkles size={24} color={current.themeColor} />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide" style={{ color: current.themeColor }}>
                3-step Quickstart
              </p>
              <p className="text-sm" style={{ color: isDarkMode ? '#d1d5db' : '#4b5563' }}>
                Take two minutes now, save hours later.
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-4">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 rounded-full bg-emerald-500/10 p-1.5">
                  <CheckCircle2 size={16} color="#10b981" />
                </span>
                <span className="text-sm sm:text-base" style={{ color: isDarkMode ? '#e5e7eb' : '#111827' }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const renderPersonalizeSection = () => (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>
        Pick at least one focus area. Humbl will surface tailored prompts, saved searches, and starter templates based on
        what you choose.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {useCaseOptions.map((option) => {
          const isSelected = selectedUseCase === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedUseCase(option.id)}
              className="flex h-full flex-col justify-between rounded-3xl border p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none"
              style={{
                borderColor: isSelected ? option.accent : isDarkMode ? 'rgba(75, 85, 99, 0.6)' : '#e5e7eb',
                backgroundColor: isSelected ? `${option.accent}14` : isDarkMode ? 'rgba(17, 24, 39, 0.6)' : '#ffffff',
                boxShadow: isSelected ? `0 10px 30px ${option.accent}33` : undefined,
              }}
              aria-pressed={isSelected}
            >
              <div className="space-y-3">
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: `${option.accent}1a`,
                    color: option.accent,
                  }}
                >
                  {option.label}
                </span>
                <p className="text-sm" style={{ color: isDarkMode ? '#d1d5db' : '#111827' }}>
                  {option.description}
                </p>
              </div>
              <ul className="mt-4 space-y-2 text-sm" style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>
                {option.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: option.accent,
                      }}
                    />
                    {highlight}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      {current.helperText && (
        <p className="text-xs" style={{ color: isDarkMode ? '#6b7280' : '#6b7280' }}>
          {current.helperText}
        </p>
      )}
    </div>
  );

  const renderFeatureGrid = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      {current.details?.map((feature) => (
        <div
          key={feature.title}
          className="flex h-full flex-col gap-3 rounded-3xl border p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
          style={{
            borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.6)' : '#e5e7eb',
            backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.6)' : '#ffffff',
          }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${feature.accent ?? current.themeColor}1a` }}
          >
            <feature.icon size={20} color={feature.accent ?? current.themeColor} />
          </div>
          <div>
            <p className="text-base font-semibold" style={{ color: isDarkMode ? '#f9fafb' : '#111827' }}>
              {feature.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>
              {feature.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTips = () => (
    <div className="space-y-6">
      <div
        className="rounded-3xl border p-5"
        style={{
          borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.6)' : '#e5e7eb',
          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.6)' : '#ffffff',
        }}
      >
        <p className="text-sm" style={{ color: isDarkMode ? '#d1d5db' : '#111827' }}>
          Humbl is built to stay out of your way. These shortcuts keep you in flow while you explore.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {current.details?.map((tip) => (
          <div
            key={tip.title}
            className="flex h-full flex-col gap-3 rounded-3xl border p-5"
            style={{
              borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.6)' : '#e5e7eb',
              backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.6)' : '#f9fafb',
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${tip.accent ?? current.themeColor}1a` }}
            >
              <tip.icon size={20} color={tip.accent ?? current.themeColor} />
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: isDarkMode ? '#f9fafb' : '#111827' }}>
                {tip.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>
                {tip.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-6">
      <div
        className="rounded-3xl border p-6"
        style={{
          borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.6)' : '#e5e7eb',
          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.6)' : '#ffffff',
        }}
      >
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: current.themeColor }}>
          Next best step
        </p>
        <p className="mt-2 text-base" style={{ color: isDarkMode ? '#e5e7eb' : '#1f2937' }}>
          {selectedUseCaseLabel
            ? `Open the chat workspace and start with a prompt tailored for ${selectedUseCaseLabel}.`
            : 'Jump into a chat and ask Humbl to help with what you’re working on right now.'}
        </p>
      </div>
      <ul className="space-y-4">
        {current.checklist?.map((item) => (
          <li
            key={item}
            className="flex items-center gap-3 rounded-3xl border px-4 py-3"
            style={{
              borderColor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.3)',
              backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.08)',
            }}
          >
            <span className="rounded-full bg-emerald-500/20 p-1.5">
              <CheckCircle2 size={18} color="#10b981" />
            </span>
            <span className="text-sm sm:text-base" style={{ color: isDarkMode ? '#e5e7eb' : '#1f2937' }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleComplete}
          className="rounded-2xl px-5 py-2 text-sm font-semibold transition-transform duration-150 hover:scale-[1.02]"
          style={{
            backgroundColor: current.themeColor,
            color: '#0b1727',
          }}
        >
          Open chat workspace
        </button>
        <button
          type="button"
          onClick={() => setCurrentStep(0)}
          className="rounded-2xl px-5 py-2 text-sm font-semibold transition-colors duration-150"
          style={{
            backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : '#e5e7eb',
            color: isDarkMode ? '#f9fafb' : '#1f2937',
          }}
        >
          Replay tour
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (current.type) {
      case 'welcome':
        return renderWelcomeSection();
      case 'personalize':
        return renderPersonalizeSection();
      case 'features':
        return renderFeatureGrid();
      case 'tips':
        return renderTips();
      case 'summary':
        return renderSummary();
      default:
        return null;
    }
  };

  const isNextDisabled = current.id === 'personalize' && !selectedUseCase;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 sm:px-6">
      <div
        className="absolute inset-0 backdrop-blur-xl transition-colors"
        style={{
          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.75)' : 'rgba(241, 245, 249, 0.85)',
        }}
      />

      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-[32px] border shadow-2xl transition-all duration-300"
        style={{
          borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.4)' : 'rgba(226, 232, 240, 0.9)',
          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.92)' : '#ffffff',
        }}
      >
        <div className="absolute right-5 top-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleComplete}
            className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors duration-150 hover:bg-rose-500 hover:text-white"
            style={{
              borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.4)' : '#e2e8f0',
              color: isDarkMode ? '#e2e8f0' : '#475569',
            }}
          >
            Skip for now
          </button>
            <button
            type="button"
              onClick={handleComplete}
            aria-label="Close onboarding"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150"
              style={{
              backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9',
              color: isDarkMode ? '#cbd5f5' : '#475569',
            }}
          >
            <X size={18} />
            </button>
          </div>

        <div className="grid gap-6 px-6 pb-8 pt-12 md:grid-cols-[240px,1fr] md:px-10 md:pb-12 md:pt-14">
          <aside className="hidden md:flex md:flex-col md:gap-6">
            <div className="flex items-center gap-3">
              <Image src="/applogo.png" alt="Humbl AI" width={120} height={40} className="h-8 w-auto" />
          </div>
            <div
              className="rounded-3xl p-5 shadow-lg"
                    style={{
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.85)' : '#f8fafc',
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: current.themeColor }}>
                Your progress
              </p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200/60">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progressPercentage}%`,
                    backgroundColor: current.themeColor,
                  }}
                />
                    </div>
              <p className="mt-4 text-sm font-medium" style={{ color: isDarkMode ? '#e2e8f0' : '#1f2937' }}>
                Step {currentStep + 1} of {onboardingSteps.length}
              </p>
                    </div>
            <nav className="flex flex-col gap-2">
              {onboardingSteps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-150"
                    style={{
                      borderColor: isActive
                        ? step.themeColor
                        : isDarkMode
                        ? 'rgba(51, 65, 85, 0.6)'
                        : 'rgba(203, 213, 225, 0.7)',
                      backgroundColor: isActive
                        ? `${step.themeColor}12`
                        : isCompleted
                        ? (isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc')
                        : isDarkMode
                        ? 'rgba(17, 24, 39, 0.65)'
                        : '#ffffff',
                      color: isDarkMode ? '#e2e8f0' : '#1f2937',
                    }}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold"
                  style={{
                        borderColor: step.themeColor,
                        backgroundColor: isActive || isCompleted ? step.themeColor : 'transparent',
                        color: isActive || isCompleted ? '#0b1727' : step.themeColor,
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle2 size={16} color="#0f172a" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="text-xs" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                        {step.tagline}
                      </p>
            </div>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Image src="/applogo.png" alt="Humbl AI" width={120} height={40} className="h-8 w-auto md:hidden" />
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-1 rounded-full"
                  style={{ background: `linear-gradient(180deg, ${current.themeColor}, transparent)` }}
                />
                <div>
                  <h2
                    className="text-xl font-semibold sm:text-2xl"
                    style={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
                  >
                    {current.title}
              </h2>
                  <p className="text-sm sm:text-base" style={{ color: isDarkMode ? '#cbd5f5' : '#475569' }}>
                    {current.tagline}
                  </p>
                </div>
              </div>
            </div>

            <div className="md:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: current.themeColor }}>
                Your progress
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/60">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progressPercentage}%`,
                    backgroundColor: current.themeColor,
                  }}
                />
              </div>
              <p className="mt-2 text-xs font-medium" style={{ color: isDarkMode ? '#e2e8f0' : '#1f2937' }}>
                Step {currentStep + 1} of {onboardingSteps.length}
              </p>
            </div>

            {current.description && (
              <p className="text-sm sm:text-base" style={{ color: isDarkMode ? '#d1d5db' : '#1f2937' }}>
                {current.description}
              </p>
            )}

            {renderContent()}

            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                {currentStep > 0 ? (
                <button
                    type="button"
                  onClick={handlePrevious}
                    className="rounded-2xl px-5 py-2 text-sm font-semibold transition-colors duration-150"
                  style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#e2e8f0',
                      color: isDarkMode ? '#f8fafc' : '#1f2937',
                    }}
                  >
                    Back
                </button>
                ) : (
                  <span className="hidden sm:inline-block px-5 py-2 text-sm" />
              )}
              <button
                  type="button"
                onClick={handleNext}
                  disabled={isNextDisabled}
                  className="rounded-2xl px-6 py-2 text-sm font-semibold transition-transform duration-150 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                    backgroundColor: current.themeColor,
                    color: '#0b1727',
                  }}
                >
                  {currentStep === onboardingSteps.length - 1 ? 'Get started' : 'Continue'}
              </button>
            </div>

              {current.id === 'personalize' && (
                <p className="text-xs" style={{ color: isDarkMode ? '#64748b' : '#6b7280' }}>
                  You can always change focus areas from the sidebar later.
                </p>
            )}
          </div>
          </section>
        </div>
      </div>
    </div>
  );
}

