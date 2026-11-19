import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Sparkles, Eye } from 'lucide-react';
import type { WatermarkTier } from '../../types/user';
import {
  getCreatorWatermarkConfig,
  hasActiveCreatorWatermark,
  type CreatorWatermarkConfig,
} from '../../utils/creatorWatermarkStore';
import { renderWatermarkOverlay } from '../../utils/watermarkRenderer';

interface WatermarkPreviewCardProps {
  tier: WatermarkTier;
  compact?: boolean;
}

export const WatermarkPreviewCard: React.FC<WatermarkPreviewCardProps> = ({
  tier,
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [creatorConfig, setCreatorConfig] = useState<CreatorWatermarkConfig>(() =>
    getCreatorWatermarkConfig()
  );
  const [imgTick, setImgTick] = useState(0);

  useEffect(() => {
    const syncCreator = () => setCreatorConfig(getCreatorWatermarkConfig());
    const syncImg = () => setImgTick(t => t + 1);
    window.addEventListener('tacstem_creator_watermark_updated', syncCreator);
    window.addEventListener('tacstem_user_plan_updated', syncCreator);
    window.addEventListener('tacstem_creator_watermark_image_ready', syncImg);
    return () => {
      window.removeEventListener('tacstem_creator_watermark_updated', syncCreator);
      window.removeEventListener('tacstem_user_plan_updated', syncCreator);
      window.removeEventListener('tacstem_creator_watermark_image_ready', syncImg);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = 640;
    const h = 360;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw realistic miniature tactical pitch frame so watermark contrast is accurately previewed
    const grassGrad = ctx.createLinearGradient(0, 0, w, h);
    grassGrad.addColorStop(0, '#14261c');
    grassGrad.addColorStop(0.5, '#193224');
    grassGrad.addColorStop(1, '#102017');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle mowing stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.022)';
    const stripeW = w / 8;
    for (let i = 0; i < 8; i += 2) {
      ctx.fillRect(i * stripeW, 0, stripeW, h);
    }

    // Subtle pitch markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(28, 22, w - 56, h - 44);
    ctx.beginPath();
    ctx.moveTo(w / 2, 22);
    ctx.lineTo(w / 2, h - 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 52, 0, Math.PI * 2);
    ctx.stroke();

    // Sample tactical telestration ring & pass line
    ctx.save();
    ctx.strokeStyle = 'rgba(198, 255, 31, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.58);
    ctx.quadraticCurveTo(w * 0.48, h * 0.32, w * 0.66, h * 0.46);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.ellipse(w * 0.3, h * 0.58, 18, 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#c6ff1f';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(w * 0.66, h * 0.46, 18, 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Render both Tacstem tier watermark & left-bottom user Creator Watermark
    renderWatermarkOverlay(ctx, {
      tier,
      targetWidth: w,
      targetHeight: h,
      viewport: { x: 0, y: 0, w, h },
      nowMs: 1200,
      creatorWatermark: creatorConfig,
    });
  }, [tier, creatorConfig, imgTick]);

  const hasCustom = hasActiveCreatorWatermark(creatorConfig);

  const meta =
    tier === 'none'
      ? {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
          title: 'Admin Clean Master',
          detail: hasCustom
            ? `Includes your left-bottom "${creatorConfig.text || 'custom'}" watermark`
            : 'No watermark applied · Lossless stream-copy eligible',
          tone: 'text-emerald-300',
        }
      : tier === 'pro'
        ? {
            icon: <Sparkles className="w-3.5 h-3.5 text-[#c6ff1f] shrink-0" />,
            title: 'Pro Corner Wordmark',
            detail: hasCustom
              ? 'Right-bottom Tacstem + your left-bottom custom watermark'
              : 'Clean unboxed right-bottom text on editor canvas & exports',
            tone: 'text-[#c6ff1f]',
          }
        : {
            icon: <Eye className="w-3.5 h-3.5 text-amber-300 shrink-0" />,
            title: 'Free Full-Frame Text Watermark',
            detail: hasCustom
              ? 'Low-opacity text grid + your left-bottom custom watermark'
              : 'Low-opacity text grid across editor canvas, exports & recordings',
            tone: 'text-amber-300',
          };

  return (
    <div className="p-2.5 bg-[#18181d] border border-[#2b2b32] rounded-lg space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            {meta.icon}
            <span className="truncate">{meta.title}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{meta.detail}</p>
        </div>

        <div
          className={`shrink-0 rounded-md overflow-hidden border border-white/10 bg-black shadow-md ${
            compact ? 'w-24 aspect-video' : 'w-28 sm:w-32 aspect-video'
          }`}
          title="Live preview of exported video frame branding"
        >
          <canvas ref={canvasRef} className="w-full h-full block object-cover" />
        </div>
      </div>
    </div>
  );
};
