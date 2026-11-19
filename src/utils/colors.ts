export const fadeColor = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const adjustBrightness = (hex: string, percent: number) => {
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + percent));
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + percent));
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + percent));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export const shiftColor = (hex: string, amt: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const f = (c: number) => clamp(Math.round(c + (amt / 100) * 255), 0, 255);
  return `#${f(r).toString(16).padStart(2, '0')}${f(g).toString(16).padStart(2, '0')}${f(b).toString(16).padStart(2, '0')}`;
};

export const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
};

export const getContrastColor = (color: string): string => {
  if (!color) return '#ffffff';
  const clean = color.trim().toLowerCase();
  let r = 255;
  let g = 255;
  let b = 255;

  if (clean.startsWith('rgb')) {
    const match = clean.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      r = parseInt(match[1], 10);
      g = parseInt(match[2], 10);
      b = parseInt(match[3], 10);
    }
  } else {
    let cleanHex = clean;
    if (cleanHex.startsWith('#')) cleanHex = cleanHex.slice(1);
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    if (cleanHex.length >= 6) {
      r = parseInt(cleanHex.slice(0, 2), 16);
      g = parseInt(cleanHex.slice(2, 4), 16);
      b = parseInt(cleanHex.slice(4, 6), 16);
    }
  }

  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';
  // Standard perceived luminance (YIQ)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#000000' : '#ffffff';
};

export const hslToHex = (h: number, s: number, l: number): string => {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const val = Math.max(0, Math.min(255, Math.round((n + m) * 255)));
    return val.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  if (!hex || typeof hex !== 'string') return null;
  let clean = hex.trim();
  if (clean.startsWith('#')) clean = clean.slice(1);
  if (clean.length === 3) {
    clean = clean.split('').map(ch => ch + ch).join('');
  }
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
};

/**
 * Calculates human perceptual color distance using weighted Euclidean formula (redmean).
 */
export const colorDistance = (hex1: string, hex2: string): number => {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return 999;
  const rmean = (c1.r + c2.r) / 2;
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(
    (((512 + rmean) * dr * dr) >> 8) +
    4 * dg * dg +
    (((767 - rmean) * db * db) >> 8)
  );
};

/**
 * Generates a vibrant, distinct random color from across the full 360° color spectrum,
 * maximizing distance from existing colors.
 */
export const getRandomDistinctColor = (existingColors: string[] = []): string => {
  const validExisting = existingColors
    .filter(c => typeof c === 'string' && c.trim().length > 0)
    .map(c => c.trim().toLowerCase());

  // Base vibrant palette options if no existing or small set
  const numCandidates = 60;
  const candidates: { hex: string; minDist: number }[] = [];

  for (let i = 0; i < numCandidates; i++) {
    // Distribute candidate hues across 360 degrees with random jitter
    const hue = (i * (360 / numCandidates) + (Math.random() * 5 - 2.5) + 360) % 360;
    // Keep colors vibrant, saturated and balanced for sports tagging
    const sat = 78 + Math.floor(Math.random() * 18); // 78% - 96%
    const lit = 50 + Math.floor(Math.random() * 14); // 50% - 64%
    const hex = hslToHex(hue, sat, lit);

    if (validExisting.length === 0) {
      candidates.push({ hex, minDist: 100 });
      continue;
    }

    // Minimum distance from any existing color
    let minD = Infinity;
    for (const ex of validExisting) {
      const d = colorDistance(hex, ex);
      if (d < minD) minD = d;
    }
    candidates.push({ hex, minDist: minD });
  }

  if (validExisting.length === 0) {
    return candidates[Math.floor(Math.random() * candidates.length)].hex;
  }

  // Sort candidates by highest minimum distance
  candidates.sort((a, b) => b.minDist - a.minDist);

  // Take top candidates with strong separation and randomly pick one to maintain variety
  const highest = candidates[0].minDist;
  const threshold = Math.max(highest * 0.85, 40);
  const viable = candidates.filter(c => c.minDist >= threshold).slice(0, 8);
  const chosen = viable[Math.floor(Math.random() * viable.length)] || candidates[0];

  return chosen.hex;
};

/**
 * Generates N distinct random colors from the full color spectrum,
 * ensuring each generated color is different from existing colors and from each other.
 */
export const getMultipleDistinctRandomColors = (count: number, existingColors: string[] = []): string[] => {
  const result: string[] = [];
  const pool = [...existingColors];
  for (let i = 0; i < count; i++) {
    const nextColor = getRandomDistinctColor(pool);
    result.push(nextColor);
    pool.push(nextColor);
  }
  return result;
};

