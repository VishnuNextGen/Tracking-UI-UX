import { presentationDb } from './presentationDatabase';
import type {
  PresentationProject,
  PresentationAssetRecord,
  PresentationExportBundle,
} from '../types/presentation';
import { createPresentationFromTemplate, uid } from '../constants/themesAndLayouts';

const assetObjectUrlCache = new Map<string, string>();

export async function listPresentations(): Promise<PresentationProject[]> {
  try {
    const all = await presentationDb.presentations.toArray();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error('[PresentationStudio] Failed to list presentations:', err);
    return [];
  }
}

export async function getPresentationById(id: string): Promise<PresentationProject | undefined> {
  return presentationDb.presentations.get(id);
}

export async function savePresentation(project: PresentationProject): Promise<PresentationProject> {
  const updated: PresentationProject = {
    ...project,
    updatedAt: Date.now(),
  };
  await presentationDb.presentations.put(updated);
  return updated;
}

export async function createPresentation(options: {
  templateId?: string;
  title?: string;
  description?: string;
}): Promise<PresentationProject> {
  const project = createPresentationFromTemplate(
    options.templateId || 'blank',
    options.title,
    options.description
  );
  await presentationDb.presentations.put(project);
  return project;
}

export async function duplicatePresentation(id: string): Promise<PresentationProject | null> {
  const source = await presentationDb.presentations.get(id);
  if (!source) return null;

  const newPresId = uid('pres');
  const cloned: PresentationProject = JSON.parse(JSON.stringify(source));
  cloned.id = newPresId;
  cloned.title = `${source.title} (Copy)`;
  cloned.createdAt = Date.now();
  cloned.updatedAt = Date.now();
  cloned.favourite = false;

  // Clone associated image assets in IndexedDB so deleting one project doesn't break the copy
  const sourceAssets = await presentationDb.assets.where('presentationId').equals(id).toArray();
  const assetIdMap = new Map<string, string>();
  for (const asset of sourceAssets) {
    const newAssetId = uid('asset');
    assetIdMap.set(asset.id, newAssetId);
    await presentationDb.assets.put({
      ...asset,
      id: newAssetId,
      presentationId: newPresId,
      createdAt: Date.now(),
    });
  }

  // Remap assetId references on slides
  cloned.slides = cloned.slides.map((slide) => ({
    ...slide,
    id: uid('slide'),
    elements: slide.elements.map((el) => {
      const nextEl = { ...el, id: uid('el') };
      if ((nextEl.type === 'image' || nextEl.type === 'player-card') && nextEl.assetId) {
        const mapped = assetIdMap.get(nextEl.assetId);
        if (mapped) nextEl.assetId = mapped;
      }
      return nextEl;
    }),
  }));

  await presentationDb.presentations.put(cloned);
  return cloned;
}

export async function renamePresentation(
  id: string,
  title: string,
  description?: string
): Promise<PresentationProject | null> {
  const existing = await presentationDb.presentations.get(id);
  if (!existing) return null;
  const updated: PresentationProject = {
    ...existing,
    title: title.trim() || existing.title,
    description: description !== undefined ? description.trim() : existing.description,
    updatedAt: Date.now(),
  };
  await presentationDb.presentations.put(updated);
  return updated;
}

export async function togglePresentationFavourite(id: string): Promise<PresentationProject | null> {
  const existing = await presentationDb.presentations.get(id);
  if (!existing) return null;
  const updated: PresentationProject = {
    ...existing,
    favourite: !existing.favourite,
    updatedAt: Date.now(),
  };
  await presentationDb.presentations.put(updated);
  return updated;
}

export async function deletePresentation(id: string): Promise<void> {
  const assets = await presentationDb.assets.where('presentationId').equals(id).toArray();
  for (const asset of assets) {
    const cachedUrl = assetObjectUrlCache.get(asset.id);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      assetObjectUrlCache.delete(asset.id);
    }
  }
  await presentationDb.transaction('rw', presentationDb.presentations, presentationDb.assets, async () => {
    await presentationDb.assets.where('presentationId').equals(id).delete();
    await presentationDb.presentations.delete(id);
  });
}

export async function saveImageAsset(
  presentationId: string,
  file: File
): Promise<PresentationAssetRecord> {
  const dimensions = await readImageDimensions(file).catch(() => ({ width: undefined, height: undefined }));
  const record: PresentationAssetRecord = {
    id: uid('asset'),
    presentationId,
    name: file.name,
    mimeType: file.type || 'image/png',
    blob: file,
    width: dimensions.width,
    height: dimensions.height,
    createdAt: Date.now(),
  };
  await presentationDb.assets.put(record);
  const url = URL.createObjectURL(file);
  assetObjectUrlCache.set(record.id, url);
  return record;
}

export async function getImageAssetUrl(assetId: string): Promise<string | null> {
  const cached = assetObjectUrlCache.get(assetId);
  if (cached) return cached;
  const record = await presentationDb.assets.get(assetId);
  if (!record || !record.blob) return null;
  const url = URL.createObjectURL(record.blob);
  assetObjectUrlCache.set(assetId, url);
  return url;
}

function readImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, fallbackMime = 'image/png'): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
  const bstr = atob(parts[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Exports a presentation + embedded image assets as portable JSON.
 * Strictly NEVER includes any API keys or credentials.
 */
export async function exportPresentationBundle(project: PresentationProject): Promise<PresentationExportBundle> {
  const assets = await presentationDb.assets.where('presentationId').equals(project.id).toArray();
  const embeddedAssets = await Promise.all(
    assets.map(async (asset) => ({
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      dataUrl: await blobToDataUrl(asset.blob),
      width: asset.width,
      height: asset.height,
    }))
  );

  return {
    schema: 'tacstem.presentation.studio.v1',
    version: 1,
    exportedAt: Date.now(),
    presentation: project,
    embeddedAssets,
  };
}

export async function importPresentationBundle(rawJson: string): Promise<PresentationProject> {
  const parsed = JSON.parse(rawJson);
  const rawPres: PresentationProject =
    parsed?.schema === 'tacstem.presentation.studio.v1' && parsed.presentation
      ? parsed.presentation
      : parsed;

  if (!rawPres || !Array.isArray(rawPres.slides)) {
    throw new Error('Invalid presentation JSON format.');
  }

  const newPresId = uid('pres');
  const assetIdMap = new Map<string, string>();

  if (Array.isArray(parsed?.embeddedAssets)) {
    for (const asset of parsed.embeddedAssets) {
      if (asset?.id && asset?.dataUrl) {
        const newAssetId = uid('asset');
        assetIdMap.set(asset.id, newAssetId);
        const blob = dataUrlToBlob(asset.dataUrl, asset.mimeType);
        await presentationDb.assets.put({
          id: newAssetId,
          presentationId: newPresId,
          name: asset.name || 'imported-image',
          mimeType: asset.mimeType || 'image/png',
          blob,
          width: asset.width,
          height: asset.height,
          createdAt: Date.now(),
        });
      }
    }
  }

  const now = Date.now();
  const imported: PresentationProject = {
    ...rawPres,
    id: newPresId,
    title: rawPres.title || 'Imported Presentation',
    description: rawPres.description || '',
    themeId: rawPres.themeId || 'dark-professional',
    sections: Array.isArray(rawPres.sections) && rawPres.sections.length > 0
      ? rawPres.sections
      : [{ id: 'sec_main', title: 'Main Deck' }],
    aspectRatio: '16:9',
    createdAt: now,
    updatedAt: now,
    slides: rawPres.slides.map((s) => ({
      ...s,
      id: uid('slide'),
      elements: (s.elements || []).map((el) => {
        const nextEl = { ...el, id: uid('el') };
        if ((nextEl.type === 'image' || nextEl.type === 'player-card') && nextEl.assetId) {
          const mapped = assetIdMap.get(nextEl.assetId);
          if (mapped) nextEl.assetId = mapped;
        }
        return nextEl;
      }),
    })),
  };

  await presentationDb.presentations.put(imported);
  return imported;
}

export async function getStudioPreference<T>(key: string, fallback: T): Promise<T> {
  try {
    const rec = await presentationDb.preferences.get(key);
    return rec ? (rec.value as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setStudioPreference(key: string, value: any): Promise<void> {
  try {
    await presentationDb.preferences.put({ key, value });
  } catch (err) {
    console.warn('[PresentationStudio] Failed to save preference:', err);
  }
}
