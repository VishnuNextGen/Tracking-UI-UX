import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X, Check } from 'lucide-react';
import { Logo, Wordmark } from '../Logo';
import {
  USER_PERSONA_OPTIONS,
  normalizeUserPersonas,
  type UserPersona,
  type UserProfile,
} from '../../types/user';

interface OnboardingModalProps {
  isOpen: boolean;
  initialUser: UserProfile;
  onComplete: (payload: { displayName: string; personas: UserPersona[] }) => void;
  onSkip: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  initialUser,
  onComplete,
  onSkip,
}) => {
  const defaultPlaceholderNames = new Set([
    'Vishnu P V',
    'Vishnu P V (Lead Coach)',
    'Guest User',
    'Workspace User',
    'User',
  ]);

  const [name, setName] = useState<string>(() =>
    initialUser.displayName && !defaultPlaceholderNames.has(initialUser.displayName)
      ? initialUser.displayName
      : ''
  );
  const [selectedPersonas, setSelectedPersonas] = useState<UserPersona[]>(() => {
    const existing = normalizeUserPersonas(initialUser.personas);
    return existing.length > 0 ? existing : ['analyst'];
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(
        initialUser.displayName && !defaultPlaceholderNames.has(initialUser.displayName)
          ? initialUser.displayName
          : ''
      );
      const existing = normalizeUserPersonas(initialUser.personas);
      setSelectedPersonas(existing.length > 0 ? existing : ['analyst']);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialUser]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onSkip]);

  if (!isOpen) return null;

  const togglePersona = (id: UserPersona) => {
    setSelectedPersonas((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete({
      displayName: name.trim(),
      personas: selectedPersonas,
    });
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[220] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onSkip}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 6 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[360px] bg-[#121216] border border-white/[0.1] rounded-2xl p-4 sm:p-5 shadow-2xl text-left select-none"
        >
          {/* Compact Header */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 min-w-0">
              <Logo className="w-5 h-5 shrink-0" />
              <Wordmark className="scale-[0.55] origin-left -ml-2.5 shrink-0" />
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Skip for now"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
            {/* Title */}
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Quick workspace setup
              </h2>
              <p className="text-[11px] text-white/50 mt-0.5">
                Tell us your name and what you do.
              </p>
            </div>

            {/* Name Input */}
            <div>
              <label
                htmlFor="onboarding-name-input"
                className="block text-xs font-medium text-white/75 mb-1"
              >
                Your name
              </label>
              <input
                ref={inputRef}
                id="onboarding-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                maxLength={60}
                className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.07] border border-white/10 focus:border-[#c6ff1f]/60 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none transition-colors select-text"
              />
            </div>

            {/* Compact Multi-Select Persona Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-white/75">
                  I am a...
                </label>
                <span className="text-[11px] text-white/40">Select one or more</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {USER_PERSONA_OPTIONS.map((option) => {
                  const isSelected = selectedPersonas.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => togglePersona(option.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#c6ff1f]/15 border-[#c6ff1f]/50 text-[#c6ff1f] font-semibold'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <span>{option.label}</span>
                      {isSelected && <Check className="w-3 h-3 shrink-0 text-[#c6ff1f]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-1 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onSkip}
                className="px-2 py-1.5 rounded-lg text-xs font-medium text-white/45 hover:text-white/80 transition-colors cursor-pointer"
              >
                Skip
              </button>

              <button
                type="submit"
                className="btn-glow px-4 py-1.5 rounded-lg text-xs font-bold text-black inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#c6ff1f]/15"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
