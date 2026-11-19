import Dexie, { type Table } from 'dexie';
import type { PresentationProject, PresentationAssetRecord } from '../types/presentation';

export interface PresentationPreferenceRecord {
  key: string;
  value: any;
}

class PresentationStudioDatabase extends Dexie {
  presentations!: Table<PresentationProject, string>;
  assets!: Table<PresentationAssetRecord, string>;
  preferences!: Table<PresentationPreferenceRecord, string>;

  constructor() {
    super('TacstemPresentationStudioDB');
    this.version(1).stores({
      presentations: 'id, updatedAt, favourite, title',
      assets: 'id, presentationId, createdAt',
      preferences: 'key',
    });
  }
}

export const presentationDb = new PresentationStudioDatabase();
