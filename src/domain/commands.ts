import { DomainError } from './errors';
import { computeOutcome, currentRevision, revisionTotal, type Outcome } from './outcome';
import {
  MAX_POINTS,
  type AppliedBonus,
  type EntryKind,
  type EntryRevision,
  type GameState,
  type OperationRecord,
  type OperationType,
  type RevisionReason,
  type ScoreEntry,
} from './types';

export type GameCommand =
  | {
      type: 'add_entry';
      commandId: string;
      kind: EntryKind;
      sideId: string | null;
      basePoints: number;
      /** Códigos de bonificación de las reglas de la partida. */
      bonusCodes: string[];
    }
  | { type: 'edit_entry'; commandId: string; entryId: string; basePoints: number; bonusCodes: string[] }
  | { type: 'reassign_entry'; commandId: string; entryId: string; sideId: string }
  | { type: 'void_entry'; commandId: string; entryId: string }
  | { type: 'undo'; commandId: string };

export interface CommandContext {
  now: number;
  newId: () => string;
}

/** Filas nuevas que la capa de datos debe insertar en una sola transacción. */
export interface CommandChange {
  operation: OperationRecord;
  newEntry: ScoreEntry | null;
  newRevision: { entryId: string; revision: EntryRevision } | null;
  /** commandId de la operación que queda marcada como deshecha. */
  markUndone: string | null;
}

export interface CommandResult {
  state: GameState;
  outcome: Outcome;
  change: CommandChange;
}

export function validatePoints(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_POINTS) {
    throw new DomainError('invalid_points', `Los puntos deben ser un entero entre 0 y ${MAX_POINTS}.`);
  }
}

function resolveBonuses(state: GameState, codes: string[]): AppliedBonus[] {
  const seen = new Set<string>();
  return codes.map((code) => {
    const rule = state.rules.bonuses.find((b) => b.code === code);
    if (!rule) throw new DomainError('unknown_bonus', `La bonificación «${code}» no está activa en esta partida.`);
    if (seen.has(code) && !rule.repeatable) {
      throw new DomainError('duplicate_bonus', `«${rule.label}» no puede sumarse dos veces a la misma mano.`);
    }
    seen.add(code);
    return { code: rule.code, label: rule.label, value: rule.value };
  });
}

function requireSide(state: GameState, sideId: string | null): string {
  if (sideId === null) throw new DomainError('side_required', 'Elige a qué equipo se anota.');
  if (!state.sides.some((s) => s.id === sideId)) {
    throw new DomainError('unknown_side', 'Ese equipo no pertenece a la partida.');
  }
  return sideId;
}

function findEntry(state: GameState, entryId: string): ScoreEntry {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) throw new DomainError('unknown_entry', 'No se encontró ese apunte.');
  return entry;
}

/** Valida el contenido de un apunte según su tipo. */
function validateContent(kind: EntryKind, basePoints: number, bonuses: AppliedBonus[]): void {
  validatePoints(basePoints);
  if (kind === 'scoreless_hand') {
    if (basePoints !== 0 || bonuses.length > 0) {
      throw new DomainError('invalid_points', 'Una mano sin puntos no lleva cantidad.');
    }
    return;
  }
  if (kind === 'bonus') {
    if (bonuses.length === 0 || basePoints !== 0) {
      throw new DomainError('bonus_required', 'Un apunte de bonificación necesita al menos una bonificación.');
    }
    return;
  }
  if (revisionTotal({ basePoints, bonuses }) === 0) {
    throw new DomainError('empty_hand', 'Escribe una cantidad o usa «Mano sin puntos».');
  }
}

function withRevision(state: GameState, entryId: string, revision: EntryRevision): GameState {
  return {
    ...state,
    entries: state.entries.map((e) => (e.id === entryId ? { ...e, revisions: [...e.revisions, revision] } : e)),
  };
}

function operation(
  type: OperationType,
  commandId: string,
  entryId: string,
  revision: number,
  now: number,
  undoes: string | null = null,
): OperationRecord {
  return { commandId, type, entryId, revision, undoneBy: null, undoes, committedAt: now };
}

/** Operación más reciente sobre apuntes que todavía puede deshacerse (pila). */
export function findUndoTarget(state: GameState): OperationRecord | undefined {
  for (let i = state.operations.length - 1; i >= 0; i -= 1) {
    const op = state.operations[i];
    if (op && op.type !== 'undo' && op.undoneBy === null) return op;
  }
  return undefined;
}

/**
 * Aplica un comando de forma pura. No asigna marcas de tiempo al orden: la secuencia
 * del apunte nuevo es la siguiente a la mayor existente.
 */
export function applyCommand(state: GameState, command: GameCommand, ctx: CommandContext): CommandResult {
  if (state.status === 'abandoned') {
    throw new DomainError('game_abandoned', 'La partida fue abandonada; no admite cambios.');
  }
  const before = computeOutcome(state);
  const revisionRow = (
    entry: ScoreEntry | null,
    fields: Pick<EntryRevision, 'sideId' | 'basePoints' | 'bonuses' | 'voided'>,
    reason: RevisionReason,
  ): EntryRevision => ({
    id: ctx.newId(),
    revision: entry ? currentRevision(entry).revision + 1 : 1,
    reason,
    commandId: command.commandId,
    createdAt: ctx.now,
    ...fields,
  });

  let next: GameState;
  let change: CommandChange;

  switch (command.type) {
    case 'add_entry': {
      if (before.status === 'finished') {
        throw new DomainError('game_finished', 'La partida ya terminó. Corrige un apunte para reabrirla.');
      }
      const bonuses = resolveBonuses(state, command.bonusCodes);
      validateContent(command.kind, command.basePoints, bonuses);
      const sideId = command.kind === 'scoreless_hand' ? null : requireSide(state, command.sideId);
      const sequence = state.entries.reduce((max, e) => Math.max(max, e.sequence), 0) + 1;
      const revision = revisionRow(null, { sideId, basePoints: command.basePoints, bonuses, voided: false }, 'created');
      const entry: ScoreEntry = {
        id: ctx.newId(),
        sequence,
        kind: command.kind,
        createdAt: ctx.now,
        revisions: [revision],
      };
      next = { ...state, entries: [...state.entries, entry] };
      change = {
        operation: operation('add_entry', command.commandId, entry.id, 1, ctx.now),
        newEntry: entry,
        newRevision: null,
        markUndone: null,
      };
      break;
    }
    case 'edit_entry':
    case 'reassign_entry':
    case 'void_entry': {
      const entry = findEntry(state, command.entryId);
      const current = currentRevision(entry);
      if (current.voided) throw new DomainError('entry_voided', 'Ese apunte está anulado.');
      let fields: Pick<EntryRevision, 'sideId' | 'basePoints' | 'bonuses' | 'voided'>;
      let reason: RevisionReason;
      if (command.type === 'edit_entry') {
        if (entry.kind === 'scoreless_hand') {
          throw new DomainError('not_editable', 'Una mano sin puntos solo puede anularse.');
        }
        const bonuses = resolveBonuses(state, command.bonusCodes);
        validateContent(entry.kind, command.basePoints, bonuses);
        if (command.basePoints === current.basePoints && JSON.stringify(bonuses) === JSON.stringify(current.bonuses)) {
          throw new DomainError('no_change', 'La corrección no cambia nada.');
        }
        fields = { sideId: current.sideId, basePoints: command.basePoints, bonuses, voided: false };
        reason = 'edited';
      } else if (command.type === 'reassign_entry') {
        if (entry.kind === 'scoreless_hand') {
          throw new DomainError('not_editable', 'Una mano sin puntos no tiene equipo.');
        }
        const sideId = requireSide(state, command.sideId);
        if (sideId === current.sideId) throw new DomainError('no_change', 'Ese apunte ya es de ese equipo.');
        fields = { sideId, basePoints: current.basePoints, bonuses: current.bonuses, voided: false };
        reason = 'reassigned';
      } else {
        fields = { sideId: current.sideId, basePoints: current.basePoints, bonuses: current.bonuses, voided: true };
        reason = 'voided';
      }
      const revision = revisionRow(entry, fields, reason);
      next = withRevision(state, entry.id, revision);
      change = {
        operation: operation(command.type, command.commandId, entry.id, revision.revision, ctx.now),
        newEntry: null,
        newRevision: { entryId: entry.id, revision },
        markUndone: null,
      };
      break;
    }
    case 'undo': {
      const target = findUndoTarget(state);
      if (!target) throw new DomainError('nothing_to_undo', 'No hay nada que deshacer.');
      const entry = findEntry(state, target.entryId);
      const current = currentRevision(entry);
      let fields: Pick<EntryRevision, 'sideId' | 'basePoints' | 'bonuses' | 'voided'>;
      if (target.type === 'add_entry') {
        fields = { sideId: current.sideId, basePoints: current.basePoints, bonuses: current.bonuses, voided: true };
      } else {
        // Restaura la revisión inmediatamente anterior a la creada por la operación.
        const previous = entry.revisions.find((r) => r.revision === target.revision - 1);
        if (!previous) throw new DomainError('nothing_to_undo', 'No se encontró la versión anterior.');
        fields = {
          sideId: previous.sideId,
          basePoints: previous.basePoints,
          bonuses: previous.bonuses,
          voided: previous.voided,
        };
      }
      const revision = revisionRow(entry, fields, 'undo');
      next = withRevision(state, entry.id, revision);
      next = {
        ...next,
        operations: next.operations.map((op) =>
          op.commandId === target.commandId ? { ...op, undoneBy: command.commandId } : op,
        ),
      };
      change = {
        operation: operation('undo', command.commandId, entry.id, revision.revision, ctx.now, target.commandId),
        newEntry: null,
        newRevision: { entryId: entry.id, revision },
        markUndone: target.commandId,
      };
      break;
    }
  }

  next = { ...next, operations: [...next.operations, change.operation] };
  const outcome = computeOutcome(next);
  const wasFinished = before.status === 'finished';
  next = {
    ...next,
    status: outcome.status,
    endedAt: outcome.status === 'finished' ? (wasFinished && state.endedAt !== null ? state.endedAt : ctx.now) : null,
    revision: state.revision + 1,
  };
  return { state: next, outcome, change };
}

export interface CommandPreview {
  before: Outcome;
  after: Outcome;
  winnerChanged: boolean;
  statusChanged: boolean;
  /** Apuntes que pasarían a quedar fuera de resultado. */
  newlyExcluded: number[];
  /** Apuntes que volverían a contar. */
  reactivated: number[];
}

/** Previsualiza las consecuencias de un comando sin persistir nada. */
export function previewCommand(state: GameState, command: GameCommand, ctx: CommandContext): CommandPreview {
  const before = computeOutcome(state);
  const { outcome: after } = applyCommand(state, command, ctx);
  const stateOf = (o: Outcome) => new Map(o.entries.map((v) => [v.entry.sequence, v.state]));
  const b = stateOf(before);
  const a = stateOf(after);
  const newlyExcluded: number[] = [];
  const reactivated: number[] = [];
  for (const [sequence, s] of a) {
    const prev = b.get(sequence);
    if (s === 'out_of_result' && prev === 'counted') newlyExcluded.push(sequence);
    if (s === 'counted' && prev === 'out_of_result') reactivated.push(sequence);
  }
  return {
    before,
    after,
    winnerChanged: before.winnerSideId !== after.winnerSideId,
    statusChanged: before.status !== after.status,
    newlyExcluded,
    reactivated,
  };
}
