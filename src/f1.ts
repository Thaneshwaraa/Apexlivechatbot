// Data access with small in-memory caches (Jolpica allows ~4 req/s and ~500 req/h).
import {
  getConstructorStandings,
  getDriverStandings,
  getRound,
  getSchedule,
  type JRace,
} from './shared/jolpica';
import { seasonSessions } from './shared/sessions';
import type { SessionInfo } from './shared/types';

export type { SessionInfo };
export type ResultKind = 'results' | 'sprint' | 'qualifying';

/** Which session each result kind belongs to. */
export const KIND_SESSION: Record<ResultKind, string> = { results: 'Race', sprint: 'Sprint', qualifying: 'Qualifying' };

function memo<T>(ttlMs: number, fn: () => Promise<T>) {
  let value: T | undefined;
  let at = 0;
  return async (force = false): Promise<T> => {
    if (!force && value !== undefined && Date.now() - at < ttlMs) return value;
    try {
      value = await fn();
      at = Date.now();
    } catch (e) {
      // Serve stale data rather than failing if we have any.
      if (value === undefined) throw e;
      console.warn('[f1] refresh failed, using cached data:', (e as Error).message);
    }
    return value;
  };
}

const schedule = memo<JRace[]>(6 * 3600_000, () => getSchedule());

export async function getSessions(force = false): Promise<SessionInfo[]> {
  return seasonSessions(await schedule(force));
}

export async function getSeasonYear(): Promise<string> {
  return (await schedule())[0]?.season ?? String(new Date().getFullYear());
}

/** The session running now, or the next one to start. */
export const currentOrNext = (list: SessionInfo[], now = Date.now()) => list.find((s) => Date.parse(s.end) > now) ?? null;

export const driverStandings = memo(10 * 60_000, () => getDriverStandings());
export const constructorStandings = memo(10 * 60_000, () => getConstructorStandings());

const roundCache = new Map<string, JRace>();

/** Published classification for a round, or null if it isn't out yet. Published results are cached for good. */
export async function roundResult(season: string, round: number, kind: ResultKind): Promise<JRace | null> {
  const key = `${season}-${round}-${kind}`;
  const hit = roundCache.get(key);
  if (hit) return hit;
  const race = await getRound(season, round, kind);
  const rows = race && (kind === 'results' ? race.Results : kind === 'sprint' ? race.SprintResults : race.QualifyingResults);
  if (!race || !rows?.length) return null;
  roundCache.set(key, race);
  return race;
}

/** Most recent round that has published results of this kind. */
export async function latestResult(kind: ResultKind): Promise<JRace | null> {
  const season = await getSeasonYear();
  const past = (await getSessions()).filter((s) => s.name === KIND_SESSION[kind] && Date.parse(s.end) < Date.now()).reverse();
  for (const s of past.slice(0, 3)) {
    const r = await roundResult(season, s.round, kind);
    if (r) return r;
  }
  return null;
}
