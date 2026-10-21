// Client for the Jolpica-F1 API (Ergast-compatible).
// https://github.com/jolpica/jolpica-f1
const BASE = 'https://api.jolpi.ca/ergast/f1';

export interface JDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
  nationality: string;
}
export interface JConstructor {
  constructorId: string;
  name: string;
  nationality: string;
}
export interface JResult {
  number: string;
  position: string;
  positionText: string;
  points: string;
  grid: string;
  laps: string;
  status: string;
  Time?: { time: string };
  Driver: JDriver;
  Constructor: JConstructor;
}
export interface JQualifyingResult {
  position: string;
  Q1?: string;
  Q2?: string;
  Q3?: string;
  Driver: JDriver;
  Constructor: JConstructor;
}
export interface JSessionTime {
  date: string;
  time?: string;
}
export interface JRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: { circuitId: string; circuitName: string; Location: { locality: string; country: string } };
  FirstPractice?: JSessionTime;
  SecondPractice?: JSessionTime;
  ThirdPractice?: JSessionTime;
  Qualifying?: JSessionTime;
  Sprint?: JSessionTime;
  SprintQualifying?: JSessionTime;
  SprintShootout?: JSessionTime;
  Results?: JResult[];
  SprintResults?: JResult[];
  QualifyingResults?: JQualifyingResult[];
}
export interface JDriverStanding {
  position?: string;
  positionText: string;
  points: string;
  wins: string;
  Driver: JDriver;
  Constructors: JConstructor[];
}
export interface JConstructorStanding {
  position?: string;
  positionText: string;
  points: string;
  wins: string;
  Constructor: JConstructor;
}

interface MRData<T> {
  MRData: { total: string; limit: string; offset: string } & T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(path: string): Promise<MRData<T>> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`);
    if (res.status === 429 && attempt < 2) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Jolpica ${path} → HTTP ${res.status}`);
    return (await res.json()) as MRData<T>;
  }
}

export async function getSchedule(season = 'current'): Promise<JRace[]> {
  const d = await get<{ RaceTable: { Races: JRace[] } }>(`/${season}.json?limit=100`);
  return d.MRData.RaceTable.Races;
}

export async function getDriverStandings(season = 'current') {
  const d = await get<{ StandingsTable: { StandingsLists: { DriverStandings: JDriverStanding[] }[] } }>(
    `/${season}/driverStandings.json?limit=100`,
  );
  return d.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
}

export async function getConstructorStandings(season = 'current') {
  const d = await get<{ StandingsTable: { StandingsLists: { ConstructorStandings: JConstructorStanding[] }[] } }>(
    `/${season}/constructorStandings.json?limit=100`,
  );
  return d.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [];
}

/** One round's race, sprint or qualifying classification; null until it's published. */
export async function getRound(season: string, round: number, kind: 'results' | 'sprint' | 'qualifying'): Promise<JRace | null> {
  const d = await get<{ RaceTable: { Races: JRace[] } }>(`/${season}/${round}/${kind}.json?limit=100`);
  return d.MRData.RaceTable.Races[0] ?? null;
}
