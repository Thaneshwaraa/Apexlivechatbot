/**
 * Team registry. `id` matches the Jolpica/Ergast constructorId where one exists;
 * `aliases` let sponsor-heavy names ("Oracle Red Bull Racing"…) resolve to the
 * same team. Colours are used for embed accents.
 */
export interface TeamConfig {
  id: string;
  name: string;
  colour: string;
  aliases: string[];
}

export const TEAMS: TeamConfig[] = [
  { id: 'mclaren', name: 'McLaren', colour: '#FF8000', aliases: ['mclaren', 'mclarenf1team'] },
  { id: 'ferrari', name: 'Ferrari', colour: '#E8002D', aliases: ['ferrari', 'scuderiaferrari'] },
  { id: 'red_bull', name: 'Red Bull Racing', colour: '#3671C6', aliases: ['redbull', 'redbullracing', 'oracleredbullracing'] },
  { id: 'mercedes', name: 'Mercedes', colour: '#27F4D2', aliases: ['mercedes', 'mercedesamg', 'mercedesamgpetronas'] },
  { id: 'aston_martin', name: 'Aston Martin', colour: '#229971', aliases: ['astonmartin', 'astonmartinaramco'] },
  { id: 'alpine', name: 'Alpine', colour: '#0093CC', aliases: ['alpine', 'alpinef1team', 'bwtalpine'] },
  { id: 'williams', name: 'Williams', colour: '#64C4FF', aliases: ['williams', 'atlassianwilliams'] },
  { id: 'rb', name: 'Racing Bulls', colour: '#6692FF', aliases: ['rb', 'rbf1team', 'racingbulls', 'visacashapprb', 'alphatauri'] },
  { id: 'haas', name: 'Haas', colour: '#B6BABD', aliases: ['haas', 'haasf1team', 'moneygramhaas', 'tgrhaas'] },
  { id: 'sauber', name: 'Sauber', colour: '#52E252', aliases: ['sauber', 'kicksauber', 'stakef1team', 'alfaromeo'] },
  { id: 'audi', name: 'Audi', colour: '#F2003C', aliases: ['audi', 'audif1team', 'audirevolut'] },
  { id: 'cadillac', name: 'Cadillac', colour: '#C9CCCF', aliases: ['cadillac', 'cadillacf1team'] },
];

export const DEFAULT_ACCENT = '#E10600';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function findTeam(key: string | null | undefined): TeamConfig | undefined {
  if (!key) return undefined;
  const n = norm(key);
  if (!n) return undefined;
  const exact = TEAMS.find((t) => norm(t.id) === n || t.aliases.includes(n));
  if (exact) return exact;
  // Sponsor-heavy names like "Oracle Red Bull Racing Honda RBPT"
  return TEAMS.find((t) => t.aliases.some((a) => a.length >= 4 && n.includes(a)));
}

/** Resolve the first matching key; unknown teams get a neutral generated entry. */
export function resolveTeam(keys: (string | null | undefined)[], fallbackColour?: string | null): TeamConfig {
  for (const k of keys) {
    const t = findTeam(k);
    if (t) return t;
  }
  const name = keys.find((k): k is string => !!k) ?? 'Unknown';
  const colour = fallbackColour ? (fallbackColour.startsWith('#') ? fallbackColour : `#${fallbackColour}`) : '#8A8F98';
  return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name, colour, aliases: [] };
}
