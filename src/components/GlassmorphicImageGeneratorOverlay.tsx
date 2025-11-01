'use client';

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  isGenerating: boolean;
  progress?: number; // 0 - 100
  message?: string;
  imagePreviewUrl?: string | null;
};

// Glassmorphic overlay used while an image is being generated.
// TailwindCSS is used for styling. Framer Motion for subtle animation.
// Works nicely as a full-screen overlay or as a panel.
export default function GlassmorphicImageGeneratorOverlay({
  isGenerating,
  progress = 0,
  message = "Generating image...",
  imagePreviewUrl = null,
}: Props) {
  // Generate unique filter ID for each instance
  const filterId = useMemo(() => `glass-noise-${Math.random().toString(36).substring(7)}`, []);
  
  return (
    <AnimatePresence>
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          aria-live="polite"
          aria-hidden={!isGenerating}
        >
          {/* Backdrop layer */}
          <div className="absolute inset-0 pointer-events-none">
            {/* blurred background using backdrop-filter (Tailwind's backdrop-blur) */}
            <div className="w-full h-full backdrop-blur-[6px] bg-black/30" />
            {/* subtle radial vignette */}
            <div className="w-full h-full bg-gradient-to-b from-transparent via-black/10 to-black/40 mix-blend-overlay" />
          </div>

          {/* Card */}
          <div className="relative w-full max-w-2xl mx-auto">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl p-6 backdrop-saturate-150" style={{ backgroundColor: 'rgba(31, 31, 31, 0.8)' }}>
              <div className="flex gap-4 items-center">
                {/* Tiny preview if available */}
                <div className="w-20 h-20 rounded-lg flex-shrink-0 overflow-hidden border border-white/10 bg-white/5">
                  {imagePreviewUrl ? (
                    // preview image softly blurred behind glass
                    <img
                      src={imagePreviewUrl}
                      alt="preview"
                      className="w-full h-full object-cover opacity-70 filter blur-[1px]"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-white/70">Preview</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold leading-tight text-white">{message}</h3>
                  <p className="mt-1 text-sm text-white/70">This may take a few seconds — we're composing pixels.</p>
                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="w-full bg-white/6 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(2, Math.min(100, progress))}%`, background: 'linear-gradient(90deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))' }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-white/60">{Math.round(progress)}% complete</div>
                  </div>
                </div>
                {/* Animated glass icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/6 border border-white/8">
                  <svg className="w-6 h-6 text-white/90 animate-pulse" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M3 7h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                    <path d="M6 7v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                  </svg>
                </div>
              </div>
              {/* Decorative glass sheen / noise */}
              <div className="pointer-events-none mt-4">
                <div className="relative rounded-xl overflow-hidden">
                  <div className="absolute inset-0" aria-hidden>
                    <svg className="w-full h-full block opacity-6" preserveAspectRatio="none" viewBox="0 0 600 200">
                      <filter id={filterId}>
                        <feTurbulence baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
                        <feColorMatrix type="saturate" values="0" />
                        <feComposite operator="in" in2="SourceGraphic" />
                      </filter>
                      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

