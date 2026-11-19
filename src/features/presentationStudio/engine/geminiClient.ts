export type GeminiReasoningDepth = 'low' | 'medium' | 'high' | 'xhigh';

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ReferenceImagePayload {
  mimeType: string;
  data: string;
  name?: string;
}

export interface GeminiAIPreferences {
  reasoningDepth: GeminiReasoningDepth;
  defaultSearchGrounding: boolean;
}

const PREFS_STORAGE_KEY = 'tacstem_ps_gemini_prefs_v1';

export function getGeminiAIPreferences(): GeminiAIPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const depth = parsed?.reasoningDepth;
      return {
        reasoningDepth:
          depth === 'low' || depth === 'medium' || depth === 'high' || depth === 'xhigh'
            ? depth
            : 'high',
        defaultSearchGrounding: Boolean(parsed?.defaultSearchGrounding),
      };
    }
  } catch {
    // ignore
  }
  return { reasoningDepth: 'high', defaultSearchGrounding: false };
}

export function saveGeminiAIPreferences(next: Partial<GeminiAIPreferences>): GeminiAIPreferences {
  const merged = { ...getGeminiAIPreferences(), ...next };
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
  return merged;
}

export async function fileToReferenceImage(file: File): Promise<ReferenceImagePayload> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  // Downscale large screenshots smoothly to <= 1400px longest side to keep Gemini multimodal fast
  const resizedDataUrl = await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1400;
      let w = img.naturalWidth || 1000;
      let h = img.naturalHeight || 1000;
      if (w <= maxDim && h <= maxDim) {
        resolve(dataUrl);
        return;
      }
      const scale = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

  const match = resizedDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Unsupported image format for Gemini analysis.');
  }
  return {
    mimeType: match[1],
    data: match[2],
    name: file.name,
  };
}

export async function callGeminiSlidesApi<T = any>(endpoint: string, body: any): Promise<T> {
  const res = await fetch(`/api/gemini/slides/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `Gemini API request failed (${res.status}).`);
  }
  return payload as T;
}

export async function streamGeminiDeckGeneration(
  body: any,
  onProgress?: (event: { phase: string; message: string; sources?: GroundingSource[] }) => void
): Promise<{ rawJson: string; sources: GroundingSource[] }> {
  const res = await fetch('/api/gemini/slides/generate-deck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(errPayload?.error || `Gemini stream request failed (${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: { rawJson: string; sources: GroundingSource[] } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const lines = block.split('\n');
      let eventType = 'message';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataStr += line.slice(5).trim();
        }
      }
      if (!dataStr) continue;
      let parsed: any;
      try {
        parsed = JSON.parse(dataStr);
      } catch {
        continue;
      }

      if (eventType === 'progress') {
        onProgress?.(parsed);
      } else if (eventType === 'done') {
        finalResult = parsed;
      } else if (eventType === 'error') {
        throw new Error(parsed?.error || 'Gemini generation error.');
      }
    }
  }

  if (!finalResult) {
    throw new Error('Gemini stream ended without a final slide deck.');
  }
  return finalResult;
}
