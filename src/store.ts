// Tiny JSON file store: per-server settings plus which reminders/results were already sent,
// so a restart doesn't post them twice.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface GuildConfig {
  channelId: string;
  roleId: string | null;
  /** Also remind for practice sessions. */
  practice: boolean;
  /** Post race, sprint and qualifying results when they're published. */
  results: boolean;
}

interface State {
  guilds: Record<string, GuildConfig>;
  sent: string[];
  posted: string[];
}

const FILE = resolve(process.env.DATA_FILE || 'data/state.json');
const KEEP = 500;

function load(): State {
  try {
    const s = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<State>;
    return { guilds: s.guilds ?? {}, sent: s.sent ?? [], posted: s.posted ?? [] };
  } catch {
    return { guilds: {}, sent: [], posted: [] };
  }
}

const state = load();

function save() {
  mkdirSync(dirname(FILE), { recursive: true });
  state.sent = state.sent.slice(-KEEP);
  state.posted = state.posted.slice(-KEEP);
  writeFileSync(`${FILE}.tmp`, JSON.stringify(state, null, 2));
  renameSync(`${FILE}.tmp`, FILE);
}

export const guilds = () => Object.entries(state.guilds);
export const getGuild = (id: string): GuildConfig | undefined => state.guilds[id];

export function setGuild(id: string, cfg: GuildConfig) {
  state.guilds[id] = cfg;
  save();
}

export function removeGuild(id: string) {
  if (!state.guilds[id]) return;
  delete state.guilds[id];
  save();
}

export const wasSent = (key: string) => state.sent.includes(key);
export function markSent(key: string) {
  state.sent.push(key);
  save();
}

export const wasPosted = (key: string) => state.posted.includes(key);
export function markPosted(key: string) {
  state.posted.push(key);
  save();
}
