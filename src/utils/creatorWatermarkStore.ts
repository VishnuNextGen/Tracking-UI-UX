import { getCurrentUser } from './userPlanStore';

export type CreatorWatermarkFontId =
  | 'outfit'
  | 'plex'
  | 'bebas'
  | 'mono'
  | 'playfair'
  | 'impact';

export type CreatorWatermarkImageShape = 'original' | 'rounded' | 'circle';

export interface CreatorWatermarkConfig {
  enabled: boolean;
  text: string;
  color: string;
  sizeScale: number; // 0.6 .. 2.2 (1.0 = canonical 1080p broadcast baseline)
  fontId: CreatorWatermarkFontId;
  imageDataUrl?: string | null;
  imagePosition?: 'left' | 'right';
  imageShape?: CreatorWatermarkImageShape;
}

export interface CreatorFontOption {
  id: CreatorWatermarkFontId;
  label: string;
  fontFamily: string;
}

export const CREATOR_FONT_OPTIONS: CreatorFontOption[] = [
  {
    id: 'outfit',
    label: 'Outfit',
    fontFamily: '"Outfit", "IBM Plex Sans", -apple-system, sans-serif',
  },
  {
    id: 'plex',
    label: 'IBM Plex',
    fontFamily: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  {
    id: 'bebas',
    label: 'Bebas',
    fontFamily: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
  },
  {
    id: 'mono',
    label: 'Mono',
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  },
  {
    id: 'playfair',
    label: 'Serif',
    fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
  },
  {
    id: 'impact',
    label: 'Impact',
    fontFamily: 'Impact, "Arial Black", sans-serif',
  },
];

export const DEFAULT_CREATOR_WATERMARK: CreatorWatermarkConfig = {
  enabled: true,
  text: '',
  color: '#ffffff',
  sizeScale: 1,
  fontId: 'outfit',
  imageDataUrl: null,
  imagePosition: 'left',
  imageShape: 'original',
};

const STORAGE_PREFIX = 'tacstem_creator_watermark_v1_';

function getStorageKey(): string {
  try {
    const user = getCurrentUser();
    return `${STORAGE_PREFIX}${user?.id || 'default'}`;
  } catch {
    return `${STORAGE_PREFIX}default`;
  }
}

export function resolveCreatorFontFamily(fontId?: CreatorWatermarkFontId): string {
  const found = CREATOR_FONT_OPTIONS.find(f => f.id === fontId);
  return found ? found.fontFamily : CREATOR_FONT_OPTIONS[0].fontFamily;
}

export function hasActiveCreatorWatermark(config?: CreatorWatermarkConfig | null): boolean {
  if (!config || config.enabled === false) return false;
  return Boolean((config.text && config.text.trim().length > 0) || config.imageDataUrl);
}

export function getCreatorWatermarkConfig(): CreatorWatermarkConfig {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_CREATOR_WATERMARK };
    }
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return { ...DEFAULT_CREATOR_WATERMARK };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled !== false,
      text: typeof parsed.text === 'string' ? parsed.text : '',
      color: typeof parsed.color === 'string' && parsed.color ? parsed.color : '#ffffff',
      sizeScale:
        typeof parsed.sizeScale === 'number' && Number.isFinite(parsed.sizeScale)
          ? Math.max(0.55, Math.min(2.4, parsed.sizeScale))
          : 1,
      fontId: CREATOR_FONT_OPTIONS.some(f => f.id === parsed.fontId) ? parsed.fontId : 'outfit',
      imageDataUrl: typeof parsed.imageDataUrl === 'string' ? parsed.imageDataUrl : null,
      imagePosition: parsed.imagePosition === 'right' ? 'right' : 'left',
      imageShape:
        parsed.imageShape === 'circle' || parsed.imageShape === 'rounded'
          ? parsed.imageShape
          : 'original',
    };
  } catch {
    return { ...DEFAULT_CREATOR_WATERMARK };
  }
}

export function saveCreatorWatermarkConfig(
  updates: Partial<CreatorWatermarkConfig>
): CreatorWatermarkConfig {
  const current = getCreatorWatermarkConfig();
  const next: CreatorWatermarkConfig = {
    ...current,
    ...updates,
    sizeScale:
      updates.sizeScale !== undefined
        ? Math.max(0.55, Math.min(2.4, updates.sizeScale))
        : current.sizeScale,
  };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getStorageKey(), JSON.stringify(next));
    }
  } catch (err) {
    console.warn('Failed to persist creator watermark config:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tacstem_creator_watermark_updated', { detail: next }));
  }

  return next;
}

/**
 * Downscales an uploaded logo/avatar file to a crisp <=256px PNG data URL
 * so localStorage never overflows and Worker MP4 export decodes instantaneously.
 */
export function downscaleImageFileToDataUrl(file: File, maxDim = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 128;
          const h = img.naturalHeight || img.height || 128;
          const scale = Math.min(1, maxDim / Math.max(w, h));
          const targetW = Math.max(1, Math.round(w * scale));
          const targetH = Math.max(1, Math.round(h * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}
