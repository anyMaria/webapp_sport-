import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { AppDB, loadSettings, saveSettings } from './db'
import { BackupError, exportBackup, parseBackup, restoreBackup } from './backup'
import { DEFAULT_SETTINGS } from './settings'

let n = 0
const fresh = () => new AppDB(`test-${n++}`)

async function fill(db: AppDB) {
  await db.sources.put({ id: 's1', kind: 'file', title: 'Dos', durationSec: 900, originLabel: 'TikTok', opfsPath: 'a.mp4', sizeBytes: 5, createdAt: '2026-11-10T10:00:00Z' })
  await db.exercises.put({ id: 'e1', sourceId: 's1', name: 'Chat-vache', startSec: 41, endSec: 84, tags: ['dos'], thumbId: 't1', createdAt: '2026-11-10T10:00:00Z' })
  await db.workouts.put({ id: 'w1', name: 'Posture bureau', items: [{ exerciseId: 'e1', durationSec: 30, restAfterSec: 0 }], isExpress: false, createdAt: 'x', updatedAt: 'y' })
  await db.sessionLogs.put({ id: 'l1', workoutId: 'w1', startedAt: 'a', endedAt: 'b', activeSec: 600, plannedSec: 700, extensions: 2, isExpress: false, counted: true })
  await db.stickerUnlocks.put({ stickerId: 'lune', reason: 'week', weekKey: '2026-W46', unlockedAt: 'z', revealed: false })
  await db.jokerUses.put({ monthKey: '2026-11', weekKey: '2026-W45' })
  await saveSettings({ weeklyGoal: 3, voiceName: 'Amélie' }, db)
  await db.thumbs.put({ id: 't1', blob: new Blob([new Uint8Array([1, 2, 3, 255, 0, 7])], { type: 'image/jpeg' }) })
}

describe('sauvegarde et restauration', () => {
  it('restaure à l’identique, sans passer par la mémoire de la base d’origine', async () => {
    const a = fresh()
    await fill(a)
    const text = JSON.stringify(await exportBackup(a))

    const b = fresh()
    await b.sources.put({ id: 'ancien', kind: 'youtube', title: 'à effacer', durationSec: 1, originLabel: 'YouTube', createdAt: 'x' })
    await restoreBackup(b, parseBackup(text))

    for (const t of ['sources', 'exercises', 'workouts', 'sessionLogs', 'stickerUnlocks', 'jokerUses', 'settings'] as const) {
      expect(await b[t].toArray()).toEqual(await a[t].toArray())
    }
    const thumb = await b.thumbs.get('t1')
    expect(thumb?.blob.type).toBe('image/jpeg')
    expect([...new Uint8Array(await thumb!.blob.arrayBuffer())]).toEqual([1, 2, 3, 255, 0, 7])
  })

  it('refuse un fichier invalide sans rien modifier', async () => {
    expect(() => parseBackup('pas du json')).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ app: 'autre' }))).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ app: 'webapp-sport', version: 99 }))).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ app: 'webapp-sport', version: 1 }))).toThrow(BackupError)
  })

  it('complète les réglages manquants avec les valeurs par défaut', async () => {
    const d = fresh()
    expect(await loadSettings(d)).toEqual(DEFAULT_SETTINGS)
    await d.settings.put({ id: 'main', weeklyGoal: 3 } as never)
    expect((await loadSettings(d)).countdownSec).toBe(5)
  })
})
