import React, { useEffect, useState } from 'react';
import { X, Sparkles, Globe, Cpu, CheckCircle2 } from 'lucide-react';
import {
  getGeminiAIPreferences,
  saveGeminiAIPreferences,
  type GeminiReasoningDepth,
} from '../engine/geminiClient';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const REASONING_OPTIONS: Array<{
  id: GeminiReasoningDepth;
  label: string;
  badge: string;
  desc: string;
}> = [
  {
    id: 'low',
    label: 'Fast',
    badge: 'LOW',
    desc: 'Lowest latency for rapid copy edits and quick slide drafts.',
  },
  {
    id: 'medium',
    label: 'Balanced',
    badge: 'MEDIUM',
    desc: 'Great mix of speed and structured 16:9 layout accuracy.',
  },
  {
    id: 'high',
    label: 'Smart Architect',
    badge: 'HIGH',
    desc: 'Default depth for strong visual hierarchy, charts, and tactical precision.',
  },
  {
    id: 'xhigh',
    label: 'Maximum Depth',
    badge: 'XHIGH',
    desc: 'Maximum reasoning depth for multi-slide narratives, complex data, and full audits.',
  },
];

export const AISettingsModal: React.FC<AISettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [reasoningDepth, setReasoningDepth] = useState<GeminiReasoningDepth>('high');
  const [defaultSearchGrounding, setDefaultSearchGrounding] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const prefs = getGeminiAIPreferences();
    setReasoningDepth(prefs.reasoningDepth);
    setDefaultSearchGrounding(prefs.defaultSearchGrounding);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveGeminiAIPreferences({ reasoningDepth, defaultSearchGrounding });
    onSaved?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSave}
        className="bg-[#12141b] border border-white/15 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-left flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c6ff1f]/10 border border-[#c6ff1f]/25 flex items-center justify-center text-[#c6ff1f]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Gemini Slide Engine Preferences
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                Tune reasoning depth and live web grounding for slide design
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reasoning Depth */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#c6ff1f]" />
            <span>Gemini Reasoning Depth</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REASONING_OPTIONS.map((opt) => {
              const active = reasoningDepth === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setReasoningDepth(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-[#c6ff1f]/10 border-[#c6ff1f]/50 text-white'
                      : 'bg-white/[0.025] border-white/10 text-white/75 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        active ? 'bg-[#c6ff1f] text-black' : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Web Grounding Toggle */}
        <label className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-3 cursor-pointer hover:border-white/25 transition-colors">
          <input
            type="checkbox"
            checked={defaultSearchGrounding}
            onChange={(e) => setDefaultSearchGrounding(e.target.checked)}
            className="mt-1 accent-[#c6ff1f]"
          />
          <div className="space-y-1">
            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Enable Google Search Grounding by Default</span>
            </div>
            <p className="text-[11px] text-white/55 leading-relaxed">
              Automatically pulls current stats, recent match records, and web sources with citations before Gemini architects your slides. Also reads any URLs pasted into your prompt.
            </p>
          </div>
        </label>

        {/* Built-in Capabilities Note */}
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-200/90 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Built-in Gemini structured JSON design schema, multimodal screenshot-to-slide analysis, and streaming generation are active and ready.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/75 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-glow px-5 py-2 rounded-xl text-black text-xs font-bold cursor-pointer"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
};
