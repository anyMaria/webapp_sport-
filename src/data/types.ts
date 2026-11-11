import type { Segment } from '../import/segments'

export type SourceKind = 'file' | 'youtube'

export interface VideoSource {
  id: string
  kind: SourceKind
  title: string
  durationSec: number
  originLabel: 'TikTok' | 'Instagram' | 'YouTube' | 'Autre' // affichage seulement
  originNote?: string     // précision libre quand originLabel = "Autre"
  opfsPath?: string // kind = "file"
  sizeBytes?: number // kind = "file"
  youtubeId?: string // kind = "youtube"
  author?: string // créateur de la vidéo YouTube
  /** Découpage en cours, enregistré tout seul (brouillon). Effacé à l'enregistrement des exercices. */
  draftSegs?: Segment[]
  createdAt: string
}

export interface Exercise {
  id: string
  sourceId: string
  name: string
  startSec: number
  endSec: number
  cue?: string // consigne courte, 80 caractères au plus, lue par la voix
  tags: string[] // zone du corps, ex. "dos", "épaules", "hanches"
  thumbId?: string // vignette JPEG stockée dans IndexedDB
  createdAt: string
}

export interface WorkoutItem {
  exerciseId: string
  durationSec: number // durée voulue ; l'extrait boucle s'il est plus court
  restAfterSec: number // 0 par défaut
}

export interface Workout {
  id: string
  name: string
  items: WorkoutItem[]
  isExpress: boolean
  createdAt: string
  updatedAt: string
}

export interface SessionLog {
  id: string
  workoutId: string
  startedAt: string
  endedAt: string
  activeSec: number // temps hors pause
  plannedSec: number
  extensions: number // nombre de « Encore »
  isExpress: boolean
  counted: boolean // compte pour l'objectif de la semaine (règles en section 9)
}

export interface StickerUnlock {
  stickerId: string
  reason: 'week' | 'session' | 'milestone' | 'bonus'
  weekKey?: string // semaine ISO, ex. "2026-W46"
  sessionNo?: number // numéro de la pochette de séance (reason = "session")
  unlockedAt: string
  revealed: boolean // false tant que la pochette n'est pas ouverte
}

export interface JokerUse {
  monthKey: string
  weekKey: string
}

export type AudioMode = 'music' | 'music+beeps' | 'music+beeps+voice' | 'video'

export interface Settings {
  weeklyGoal: number // 2
  jokersPerMonth: number // 1
  slot: { days: number[]; time: string; durationMin: number } // ex. [1,2,4], "19:00", 15
  audioMode: AudioMode
  countdownSec: number // 5
  extendSec: number // 30
  beepVolume: number // 0 à 1
  voiceName?: string
  userName: string // prénom pour la salutation, vide par défaut
  slotWorkoutId?: string // séance choisie pour le créneau
  reminder: boolean // alarme 10 minutes avant, dans le fichier du calendrier
  expressFallback: boolean // bouton « Version express » sur l'accueil
  slotExportedKey?: string // créneau du dernier export au calendrier
  podium?: (string | null)[] // top 1, 2 et 3 de la collection (identifiants de stickers)
}

/** Vignette stockée à part pour ne pas alourdir les exercices. */
export interface Thumb {
  id: string
  blob: Blob
}

/** Texte affiché pour l'origine d'une vidéo : la précision saisie si elle existe. */
export const originText = (s: Pick<VideoSource, 'originLabel' | 'originNote'>) => (s.originLabel === 'Autre' && s.originNote ? s.originNote : s.originLabel)
