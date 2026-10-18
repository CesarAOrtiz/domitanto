import {
  applyCommand,
  buildGame,
  computeOutcome,
  previewCommand,
  rematchSetup,
  type CommandPreview,
  type GameCommand,
  type GameSetup,
  type GameState,
  type Outcome,
} from '../domain';
import type { SqlDriver } from '../data/driver';
import {
  findActiveGameId,
  findOperation,
  insertGame,
  insertGameOperation,
  listGames,
  loadGame,
  persistChange,
  updateGameHeader,
  type GameSummary,
} from '../data/gameRepository';

export interface Clock {
  now(): number;
}

export interface IdSource {
  newId(): string;
}

export class ActiveGameExistsError extends Error {
  constructor(readonly activeGameId: string) {
    super('Ya hay una partida activa. Continúala o abandónala antes de crear otra.');
    this.name = 'ActiveGameExistsError';
  }
}

export class GameNotFoundError extends Error {
  constructor(readonly gameId: string) {
    super('No se encontró la partida.');
    this.name = 'GameNotFoundError';
  }
}

export interface GameSnapshot {
  state: GameState;
  outcome: Outcome;
}

export interface ExecuteResult extends GameSnapshot {
  /** Verdadero si el commandId ya estaba confirmado y no se aplicó otra vez. */
  replayed: boolean;
}

function snapshot(state: GameState): GameSnapshot {
  return { state, outcome: computeOutcome(state) };
}

/**
 * Casos de uso de partida. Cada operación es una transacción: revisión, operación y
 * estado de la partida se confirman juntos o no se confirman.
 */
export class GameService {
  constructor(
    private readonly db: SqlDriver,
    private readonly clock: Clock,
    private readonly ids: IdSource,
  ) {}

  private ctx() {
    return { now: this.clock.now(), newId: () => this.ids.newId() };
  }

  async activeGameId(): Promise<string | null> {
    return findActiveGameId(this.db);
  }

  async getGame(gameId: string): Promise<GameSnapshot> {
    const state = await loadGame(this.db, gameId);
    if (!state) throw new GameNotFoundError(gameId);
    return snapshot(state);
  }

  async recentGames(limit?: number): Promise<GameSummary[]> {
    return listGames(this.db, limit);
  }

  /** Últimas partidas cerradas (terminadas o abandonadas), con su desenlace. */
  async recentClosed(limit = 3): Promise<GameSnapshot[]> {
    const summaries = (await listGames(this.db, limit + 1)).filter((g) => g.status !== 'active').slice(0, limit);
    const snapshots: GameSnapshot[] = [];
    for (const g of summaries) snapshots.push(await this.getGame(g.id));
    return snapshots;
  }

  /** Crea una partida. Reintentar con el mismo commandId devuelve la misma partida. */
  async createGame(setup: GameSetup, commandId: string): Promise<string> {
    return this.db.transaction(async (tx) => {
      const previous = await findOperation(tx, commandId);
      if (previous?.result) return previous.result;
      const active = await findActiveGameId(tx);
      if (active) throw new ActiveGameExistsError(active);
      const ctx = this.ctx();
      const game = buildGame(setup, ctx);
      await insertGame(tx, game);
      await insertGameOperation(tx, commandId, game.id, 'create_game', setup, ctx.now);
      return game.id;
    });
  }

  async rematch(gameId: string, commandId: string): Promise<string> {
    const { state } = await this.getGame(gameId);
    return this.createGame(rematchSetup(state), commandId);
  }

  async abandon(gameId: string, commandId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (await findOperation(tx, commandId)) return;
      const state = await loadGame(tx, gameId);
      if (!state) throw new GameNotFoundError(gameId);
      if (state.status !== 'active') return;
      const now = this.clock.now();
      await updateGameHeader(tx, { id: gameId, status: 'abandoned', endedAt: now, revision: state.revision + 1 }, null);
      await insertGameOperation(tx, commandId, gameId, 'abandon_game', {}, now);
    });
  }

  async preview(gameId: string, command: GameCommand): Promise<CommandPreview> {
    const { state } = await this.getGame(gameId);
    return previewCommand(state, command, this.ctx());
  }

  /**
   * Ejecuta un comando de forma idempotente: si el commandId ya se confirmó (por ejemplo,
   * se perdió la respuesta de un commit), devuelve el estado actual sin duplicar.
   */
  async execute(gameId: string, command: GameCommand): Promise<ExecuteResult> {
    return this.db.transaction(async (tx) => {
      const previous = await findOperation(tx, command.commandId);
      const state = await loadGame(tx, gameId);
      if (!state) throw new GameNotFoundError(gameId);
      if (previous) return { ...snapshot(state), replayed: true };

      const result = applyCommand(state, command, this.ctx());
      if (state.status === 'finished' && result.state.status === 'active') {
        const active = await findActiveGameId(tx);
        if (active && active !== gameId) throw new ActiveGameExistsError(active);
      }
      await persistChange(tx, gameId, result.change, command);
      await updateGameHeader(tx, result.state, result.outcome.winnerSideId);
      return { state: result.state, outcome: result.outcome, replayed: false };
    });
  }
}
