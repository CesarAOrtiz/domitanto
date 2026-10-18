// Tipos del dominio de La Mesa. TypeScript puro: sin React, SQLite ni Expo.

export type GameMode = 'pairs' | 'individual';

/** Estado persistido. `finished` se deriva siempre del resultado de los apuntes. */
export type GameStatus = 'active' | 'finished' | 'abandoned';

export type EntryKind = 'hand' | 'bonus' | 'scoreless_hand';

export type RevisionReason = 'created' | 'edited' | 'reassigned' | 'voided' | 'undo';

/** Regla de bonificación de la casa tal como quedó fijada al crear la partida. */
export interface BonusRule {
  code: string;
  label: string;
  value: number;
  /** Si es falso, no puede sumarse dos veces a la misma mano. */
  repeatable: boolean;
}

/** Reglas congeladas en la partida: cambiar ajustes globales después no las altera. */
export interface RulesSnapshot {
  version: 1;
  target: number;
  /** Solo las bonificaciones activadas para esta partida. */
  bonuses: BonusRule[];
}

/** Bonificación aplicada: copia etiqueta y valor usados, no una referencia mutable. */
export interface AppliedBonus {
  code: string;
  label: string;
  value: number;
}

export interface Participant {
  id: string;
  playerId: string | null;
  displayName: string;
  seat: number | null;
}

export interface Side {
  id: string;
  /** Posición fija en pantalla (0 = A, 1 = B, ...). Nunca se reordena por quién gana. */
  position: number;
  displayName: string;
  compositionKey: string | null;
  participants: Participant[];
}

export interface EntryRevision {
  id: string;
  revision: number;
  sideId: string | null;
  basePoints: number;
  bonuses: AppliedBonus[];
  reason: RevisionReason;
  voided: boolean;
  commandId: string;
  createdAt: number;
}

export interface ScoreEntry {
  id: string;
  sequence: number;
  kind: EntryKind;
  createdAt: number;
  /** En orden ascendente de `revision`; la vigente es la última. */
  revisions: EntryRevision[];
}

export type OperationType = 'add_entry' | 'edit_entry' | 'reassign_entry' | 'void_entry' | 'undo';

/** Rastro de operaciones sobre apuntes, necesario para deshacer. */
export interface OperationRecord {
  commandId: string;
  type: OperationType;
  entryId: string;
  /** Revisión creada por esta operación. */
  revision: number;
  /** commandId de la operación que la deshizo, si existe. */
  undoneBy: string | null;
  /** Para `undo`: la operación que compensa. */
  undoes: string | null;
  committedAt: number;
}

export interface GameState {
  id: string;
  sessionId: string | null;
  mode: GameMode;
  rules: RulesSnapshot;
  status: GameStatus;
  sides: Side[];
  entries: ScoreEntry[];
  operations: OperationRecord[];
  startedAt: number;
  endedAt: number | null;
  revision: number;
}

export const MIN_TARGET = 1;
export const MAX_TARGET = 9999;
export const MAX_POINTS = 9999;
export const DEFAULT_TARGET = 200;
export const TARGET_PRESETS = [100, 150, 200] as const;
