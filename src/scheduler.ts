// Background jobs: session reminders and results announcements, broadcast to every
// server that ran /alerts setup.
import { type Client, type EmbedBuilder } from 'discord.js';
import { getSeasonYear, getSessions, KIND_SESSION, roundResult, type ResultKind, type SessionInfo } from './f1';
import { reminderEmbed, resultEmbed } from './embeds';
import { guilds, markPosted, markSent, wasPosted, wasSent, type GuildConfig } from './store';

/** Minutes before the start to remind, per session. 0 = "it's live". */
const LEADS: Record<string, number[]> = {
  Race: [1440, 60, 10, 0],
  Sprint: [60, 10, 0],
  Qualifying: [60, 10, 0],
  'Sprint Qualifying': [60, 10, 0],
};
const PRACTICE_LEADS = [10];
/** Reminders more than this late (bot was offline) are skipped instead of posted. */
const GRACE_MS = 10 * 60_000;
/** How long after a session ends we keep checking for its results. */
const RESULTS_WINDOW_MS = 24 * 3600_000;

const isPractice = (s: SessionInfo) => s.name.startsWith('Practice');

export async function broadcast(
  client: Client,
  embed: EmbedBuilder,
  wants: (g: GuildConfig) => boolean,
  ping = true,
) {
  for (const [guildId, cfg] of guilds()) {
    if (!wants(cfg)) continue;
    try {
      await sendTo(client, cfg, embed, ping);
    } catch (e) {
      console.warn(`[broadcast] guild ${guildId}:`, (e as Error).message);
    }
  }
}

export async function sendTo(client: Client, cfg: GuildConfig, embed: EmbedBuilder, ping = true) {
  const channel = await client.channels.fetch(cfg.channelId);
  if (!channel?.isSendable()) throw new Error(`can't post in channel ${cfg.channelId}`);
  const role = ping && cfg.roleId ? cfg.roleId : null;
  await channel.send({
    content: role ? `<@&${role}>` : undefined,
    embeds: [embed],
    allowedMentions: { roles: role ? [role] : [] },
  });
}

async function checkReminders(client: Client) {
  const now = Date.now();
  for (const s of await getSessions()) {
    const leads = isPractice(s) ? PRACTICE_LEADS : (LEADS[s.name] ?? []);
    for (const lead of leads) {
      const due = Date.parse(s.start) - lead * 60_000;
      if (now < due || now > due + GRACE_MS) continue;
      const key = `${s.id}:${lead}`;
      if (wasSent(key)) continue;
      markSent(key);
      console.log(`[reminder] ${s.raceName} ${s.name} (${lead} min)`);
      await broadcast(client, reminderEmbed(s, lead), (g) => !isPractice(s) || g.practice);
    }
  }
}

async function checkResults(client: Client) {
  const now = Date.now();
  const season = await getSeasonYear();
  const recent = (await getSessions()).filter((s) => {
    const end = Date.parse(s.end);
    return end < now && now - end < RESULTS_WINDOW_MS;
  });
  for (const [kind, name] of Object.entries(KIND_SESSION) as [ResultKind, string][]) {
    for (const s of recent.filter((x) => x.name === name)) {
      if (wasPosted(s.id)) continue;
      const race = await roundResult(season, s.round, kind);
      if (!race) continue;
      markPosted(s.id);
      console.log(`[results] ${s.raceName} ${s.name}`);
      await broadcast(client, resultEmbed(race, kind), (g) => g.results, false);
    }
  }
}

function every(ms: number, label: string, job: () => Promise<void>) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (e) {
      console.warn(`[${label}]`, (e as Error).message);
    } finally {
      running = false;
    }
  };
  void run();
  setInterval(run, ms);
}

export function startScheduler(client: Client) {
  every(30_000, 'reminders', () => checkReminders(client));
  every(5 * 60_000, 'results', () => checkResults(client));
}
