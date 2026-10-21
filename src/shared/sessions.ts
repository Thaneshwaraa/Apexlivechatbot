// Every timed session of a season, from the Jolpica schedule.
import type { JRace } from './jolpica';
import type { SessionInfo } from './types';

// Typical session lengths, used for calendar events and "live now" detection.
const SESSIONS: { key: keyof JRace | 'race'; name: string; minutes: number }[] = [
  { key: 'FirstPractice', name: 'Practice 1', minutes: 60 },
  { key: 'SprintQualifying', name: 'Sprint Qualifying', minutes: 45 },
  { key: 'SprintShootout', name: 'Sprint Qualifying', minutes: 45 },
  { key: 'SecondPractice', name: 'Practice 2', minutes: 60 },
  { key: 'ThirdPractice', name: 'Practice 3', minutes: 60 },
  { key: 'Sprint', name: 'Sprint', minutes: 60 },
  { key: 'Qualifying', name: 'Qualifying', minutes: 60 },
  { key: 'race', name: 'Race', minutes: 120 },
];

/** Every timed session of the season, sorted by start time. */
export function seasonSessions(schedule: JRace[]): SessionInfo[] {
  const out: SessionInfo[] = [];
  for (const race of schedule) {
    const seen = new Set<string>();
    for (const def of SESSIONS) {
      const t = (def.key === 'race' ? race : race[def.key]) as { date?: string; time?: string } | undefined;
      // Sessions without a published time can't be put in a calendar reliably.
      if (!t?.date || !t.time || seen.has(def.name)) continue;
      seen.add(def.name);
      const start = new Date(`${t.date}T${t.time}`);
      if (Number.isNaN(start.getTime())) continue;
      out.push({
        id: `${race.season}-r${race.round}-${def.name.toLowerCase().replace(/\s+/g, '-')}`,
        round: Number(race.round),
        raceName: race.raceName,
        circuit: race.Circuit.circuitName,
        locality: race.Circuit.Location.locality,
        country: race.Circuit.Location.country,
        name: def.name,
        start: start.toISOString(),
        end: new Date(start.getTime() + def.minutes * 60_000).toISOString(),
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
