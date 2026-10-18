import {
  DomainError,
  gamesOf,
  isDecisive,
  pairRecords,
  partnersOf,
  playedWithin,
  playerRecord,
  playerRecords,
  summarizeSession,
  type GameResult,
  type PairRecord,
  type PlayerRecord,
  type SessionSummary,
} from '../domain';
import type { SqlDriver } from '../data/driver';
import {
  deleteGroup,
  getGroup,
  getPlayer,
  insertGroup,
  insertPlayer,
  listGroups,
  listPlayers,
  renameGroup,
  renamePlayer,
  setGroupMembers,
  setPlayerArchived,
  type Group,
  type Player,
} from '../data/peopleRepository';
import { getSession, latestSession, listResults, type SessionRow } from '../data/sessionRepository';
import { SESSION_GAP_MS, type Clock, type IdSource } from './gameService';

export const MAX_NAME = 40;

function cleanName(name: string, what: string): string {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
  if (!clean) throw new DomainError('invalid_setup', `Escribe un nombre para ${what}.`);
  return clean;
}

export interface PlayerProfile {
  player: Player;
  record: PlayerRecord | null;
  partners: PairRecord[];
  /** Últimas partidas decisivas, de la más reciente a la más antigua. */
  recent: { result: GameResult; won: boolean }[];
}

export interface GroupOverview {
  group: Group;
  members: Player[];
  /** Partidas decisivas donde todos los jugadores eran del grupo. */
  decisive: number;
  players: PlayerRecord[];
  pairs: PairRecord[];
}

export interface SessionOverview {
  session: SessionRow;
  group: Group | null;
  summary: SessionSummary;
}

/**
 * Jugadores, grupos y sesiones. Todo vive en este teléfono; las cifras se calculan
 * desde las partidas guardadas cada vez, así que siempre reflejan las correcciones.
 */
export class PeopleService {
  constructor(
    private readonly db: SqlDriver,
    private readonly clock: Clock,
    private readonly ids: IdSource,
  ) {}

  // Jugadores

  async players(): Promise<Player[]> {
    return listPlayers(this.db);
  }

  async createPlayer(name: string): Promise<Player> {
    const id = this.ids.newId();
    await insertPlayer(this.db, id, cleanName(name, 'el jugador'), this.clock.now());
    return (await getPlayer(this.db, id))!;
  }

  async renamePlayer(id: string, name: string): Promise<void> {
    await renamePlayer(this.db, id, cleanName(name, 'el jugador'));
  }

  /** Archivar lo oculta de las sugerencias; su historial y estadísticas se conservan. */
  async setArchived(id: string, archived: boolean): Promise<void> {
    await setPlayerArchived(this.db, id, archived ? this.clock.now() : null);
  }

  async playerProfile(id: string): Promise<PlayerProfile | null> {
    const player = await getPlayer(this.db, id);
    if (!player) return null;
    const results = await listResults(this.db, { playerId: id });
    return {
      player,
      record: playerRecord(results, id),
      partners: partnersOf(results, id),
      recent: gamesOf(results, id).reverse().slice(0, 10),
    };
  }

  /** Récord de todos los jugadores, para la lista. */
  async playerRecords(): Promise<Map<string, PlayerRecord>> {
    const records = playerRecords(await listResults(this.db));
    return new Map(records.map((r) => [r.playerId, r]));
  }

  /** Todas las partidas con su resultado, para el historial y las comparaciones. */
  async allResults(): Promise<GameResult[]> {
    return listResults(this.db);
  }

  // Grupos

  async groups(): Promise<Group[]> {
    return listGroups(this.db);
  }

  async group(id: string): Promise<Group | null> {
    return getGroup(this.db, id);
  }

  async saveGroup(input: { id?: string; name: string; memberIds: string[] }): Promise<string> {
    const name = cleanName(input.name, 'el grupo');
    const memberIds = [...new Set(input.memberIds)];
    return this.db.transaction(async (tx) => {
      const id = input.id ?? this.ids.newId();
      if (input.id) await renameGroup(tx, id, name);
      else await insertGroup(tx, id, name, this.clock.now());
      await setGroupMembers(tx, id, memberIds);
      return id;
    });
  }

  /** Borra solo la lista: partidas, jugadores y estadísticas se quedan. */
  async deleteGroup(id: string): Promise<void> {
    await this.db.transaction((tx) => deleteGroup(tx, id));
  }

  async groupOverview(id: string): Promise<GroupOverview | null> {
    const group = await getGroup(this.db, id);
    if (!group) return null;
    const members = new Set(group.memberIds);
    const all = await listPlayers(this.db);
    const results = (await listResults(this.db)).filter((r) => playedWithin(r, members));
    return {
      group,
      members: group.memberIds.map((pid) => all.find((p) => p.id === pid)).filter((p): p is Player => !!p),
      decisive: results.filter(isDecisive).length,
      players: playerRecords(results),
      pairs: pairRecords(results),
    };
  }

  // Sesiones

  async sessionOverview(id: string): Promise<SessionOverview | null> {
    const session = await getSession(this.db, id);
    if (!session) return null;
    const results = await listResults(this.db, { sessionId: id });
    const group = session.groupId ? await getGroup(this.db, session.groupId) : null;
    return { session, group, summary: summarizeSession(results) };
  }

  /** La sesión de esta noche, si sigue abierta y ya tiene alguna partida. */
  async currentSession(): Promise<SessionRow | null> {
    const latest = await latestSession(this.db);
    if (!latest || latest.endedAt !== null || latest.gameCount === 0) return null;
    return this.clock.now() - latest.lastActivityAt <= SESSION_GAP_MS ? latest : null;
  }
}
