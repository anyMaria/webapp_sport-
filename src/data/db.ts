import Dexie, { type EntityTable } from 'dexie'
import type {
  Exercise,
  JokerUse,
  SessionLog,
  Settings,
  StickerUnlock,
  Thumb,
  VideoSource,
  Workout,
} from './types'
import { DEFAULT_SETTINGS } from './settings'

export type SettingsRow = Settings & { id: 'main' }

export class AppDB extends Dexie {
  sources!: EntityTable<VideoSource, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  sessionLogs!: EntityTable<SessionLog, 'id'>
  stickerUnlocks!: EntityTable<StickerUnlock, 'stickerId'>
  jokerUses!: EntityTable<JokerUse, 'monthKey'>
  settings!: EntityTable<SettingsRow, 'id'>
  thumbs!: EntityTable<Thumb, 'id'>

  constructor(name = 'webapp-sport') {
    super(name)
    this.version(1).stores({
      sources: 'id, kind, createdAt',
      exercises: 'id, sourceId, createdAt',
      workouts: 'id, updatedAt',
      sessionLogs: 'id, workoutId, startedAt',
      stickerUnlocks: 'stickerId, weekKey',
      jokerUses: 'monthKey',
      settings: 'id',
      thumbs: 'id',
    })
  }
}

export const db = new AppDB()

export async function loadSettings(d: AppDB = db): Promise<Settings> {
  const row = await d.settings.get('main')
  // Fusion avec les valeurs par défaut : un réglage ajouté plus tard ne casse pas une ancienne base.
  const { id: _id, ...rest } = row ?? { id: 'main' as const }
  void _id
  return { ...DEFAULT_SETTINGS, ...rest }
}

export async function saveSettings(patch: Partial<Settings>, d: AppDB = db): Promise<void> {
  const current = await loadSettings(d)
  await d.settings.put({ ...current, ...patch, id: 'main' })
}
