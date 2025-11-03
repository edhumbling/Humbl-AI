'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Image as ImageIcon, Search, Mic, ChevronRight, Star } from 'lucide-react';
import Image from 'next/image';

interface OnboardingProps {
  theme: 'dark' | 'light';
  onClose: () => void;
}

const onboardingSteps = [
  {
    icon: MessageSquare,
    title: 'Chat with AI',
    description: 'Ask anything and get intelligent responses powered by advanced AI',
    color: '#f1d08c',
  },
  {
    icon: Search,
    title: 'Web Search',
    description: 'Get real-time information from the web when you need it',
    color: '#4a9eff',
  },
  {
    icon: ImageIcon,
    title: 'Generate Images',
    description: 'Create stunning images from text descriptions with AI',
    color: '#ff6b9d',
  },
  {
    icon: Mic,
    title: 'Voice Search',
    description: 'Speak your queries naturally using voice input',
    color: '#9b59b6',
  },
];

export default function Onboarding({ theme, onClose }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showSkipButton, setShowSkipButton] = useState(true);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Mark onboarding as completed in localStorage
    localStorage.setItem('humbl_onboarding_completed', 'true');
    onClose();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const currentFeature = onboardingSteps[currentStep];
  const IconComponent = currentFeature.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Blurred background overlay */}
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)' }}
      />

      {/* Onboarding content */}
      <div className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 transform">
        <div
          className="transition-colors duration-300"
          style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff' }}
        >
          {/* Close button */}
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={handleComplete}
              className="p-2 rounded-full transition-colors duration-300"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  theme === 'dark' ? 'rgba(75, 85, 99, 0.8)' : 'rgba(209, 213, 219, 0.9)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)')
              }
            >
              <X size={18} style={{ color: theme === 'dark' ? '#d1d5db' : '#6b7280' }} />
            </button>
          </div>

          {/* Logo at top */}
          <div className="flex justify-center pt-8 pb-4">
            <Image src="/applogo.png" alt="Humbl AI" width={120} height={40} className="h-8 w-auto opacity-90" />
          </div>

          {/* Feature showcase */}
          <div className="px-6 py-4">
            {/* Icon with animated background */}
            <div className="flex justify-center mb-6">
              <div
                className="relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500"
                style={{
                  backgroundColor: currentFeature.color + '20',
                }}
              >
                <IconComponent size={40} style={{ color: currentFeature.color }} />
                {/* Star decoration */}
                <div className="absolute -top-2 -right-2">
                  <Star size={16} style={{ color: currentFeature.color, opacity: 0.6 }} />
                </div>
              </div>
            </div>

            {/* Title and description */}
            <div className="text-center mb-8">
              <h2
                className="text-2xl sm:text-3xl font-bold mb-3 transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}
              >
                {currentFeature.title}
              </h2>
              <p
                className="text-base sm:text-lg transition-colors duration-300 px-2"
                style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
              >
                {currentFeature.description}
              </p>
            </div>

            {/* Progress indicator */}
            <div className="flex justify-center gap-2 mb-8">
              {onboardingSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentStep ? 'w-8' : index < currentStep ? 'w-2' : 'w-2'
                  }`}
                  style={{
                    backgroundColor: index === currentStep
                      ? currentFeature.color
                      : index < currentStep
                      ? currentFeature.color
                      : theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)',
                    opacity: index === currentStep ? 1 : index < currentStep ? 0.6 : 0.3,
                  }}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handlePrevious}
                  className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)',
                    color: theme === 'dark' ? '#e5e7eb' : '#374151',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      theme === 'dark' ? 'rgba(75, 85, 99, 0.8)' : 'rgba(209, 213, 219, 0.9)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.8)')
                  }
                >
                  Previous
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                style={{
                  backgroundColor: currentFeature.color,
                  color: '#000000',
                }}
                onMouseEnter={(e) => {
                  // Darken the color on hover
                  const rgb = hexToRgb(currentFeature.color);
                  if (rgb) {
                    e.currentTarget.style.backgroundColor = `rgb(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)})`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = currentFeature.color;
                }}
              >
                {currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
                {currentStep < onboardingSteps.length - 1 && <ChevronRight size={18} />}
              </button>
            </div>

            {/* Skip button */}
            {showSkipButton && currentStep === 0 && (
              <div className="text-center mt-4">
                <button
                  onClick={handleSkip}
                  className="text-sm transition-colors duration-300 hover:underline"
                  style={{ color: theme === 'dark' ? '#6b7280' : '#9ca3af' }}
                >
                  Skip tour
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

