import { EmbedBuilder } from 'discord.js';
import { DEFAULT_ACCENT, resolveTeam } from './shared/teams';
import type { JConstructorStanding, JDriverStanding, JRace } from './shared/jolpica';
import type { ResultKind, SessionInfo } from './f1';

export const SITE_URL = (process.env.SITE_URL || 'https://thaneshwaraa.github.io/Apexlive').replace(/\/$/, '');
const FOOTER = { text: 'ApexLive · unofficial fan project · data: Jolpica-F1' };
const NOT_CLASSIFIED = new Set(['R', 'N', 'D', 'E', 'W', 'F']);
const MEDALS = ['🥇', '🥈', '🥉'];

const colour = (hex: string) => parseInt(hex.replace('#', ''), 16);
const unix = (iso: string) => Math.floor(Date.parse(iso) / 1000);
/** Discord renders these in each reader's own timezone. */

// Fixed display timezone (default IST). Set DISPLAY_TZ=local to show each reader's own timezone instead.
const TZ = process.env.DISPLAY_TZ || 'Asia/Kolkata';
const TZ_LABEL = process.env.DISPLAY_TZ_LABEL || (TZ === 'Asia/Kolkata' ? 'IST' : TZ);
const inTz = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  `${new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour12: true, ...opts }).format(new Date(iso))} ${TZ_LABEL}`;
const local = TZ === 'local';

export const when = (iso: string) =>
  local
    ? `<t:${unix(iso)}:F> (<t:${unix(iso)}:R>)`
    : `**${inTz(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}** (<t:${unix(iso)}:R>)`;
const shortTime = (iso: string) =>
  local ? `<t:${unix(iso)}:f>` : inTz(iso, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const dayTime = (iso: string) =>
  local ? `<t:${unix(iso)}:D> <t:${unix(iso)}:t>` : inTz(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function sessionEmoji(name: string) {
  if (name === 'Race') return '🏁';
  if (name === 'Sprint') return '⚡';
  if (name.includes('Qualifying')) return '⏱️';
  return '🛠️';
}

const isLive = (s: SessionInfo, now = Date.now()) => Date.parse(s.start) <= now && now < Date.parse(s.end);

export function nextEmbed(s: SessionInfo, weekend: SessionInfo[]) {
  const lines = weekend.map((x) => {
    const done = Date.parse(x.end) < Date.now();
    const label = `${sessionEmoji(x.name)} **${x.name}** — ${shortTime(x.start)}`;
    return done ? `~~${label}~~` : isLive(x) ? `${label} · 🔴 **LIVE**` : label;
  });
  return new EmbedBuilder()
    .setColor(colour(DEFAULT_ACCENT))
    .setTitle(`Round ${s.round} · ${s.raceName}`)
    .setURL(`${SITE_URL}/calendar/`)
    .setDescription(
      `${s.circuit} · ${s.locality}, ${s.country}\n\n` +
        (isLive(s) ? `🔴 **${s.name} is live now** — [follow along](${SITE_URL}/live/)` : `**Next up: ${s.name}**\n${when(s.start)}`),
    )
    .addFields({ name: 'Weekend schedule', value: lines.join('\n') })
    .setFooter(FOOTER);
}

export function scheduleEmbed(year: string, races: SessionInfo[]) {
  return new EmbedBuilder()
    .setColor(colour(DEFAULT_ACCENT))
    .setTitle(`F1 ${year} · upcoming races`)
    .setURL(`${SITE_URL}/calendar/`)
    .setDescription(
      races.length
        ? races.map((r) => `**R${r.round}** ${r.raceName}\n${r.locality}, ${r.country} · ${dayTime(r.start)}`).join('\n\n')
        : 'No more races this season.',
    )
    .addFields({ name: 'Add to your calendar', value: `[All sessions](${SITE_URL}/calendar.ics) · [Races only](${SITE_URL}/races.ics)` })
    .setFooter(FOOTER);
}

const LEAD_TEXT: Record<number, string> = { 1440: 'is tomorrow', 60: 'starts in 1 hour', 10: 'starts in 10 minutes' };

export function reminderEmbed(s: SessionInfo, lead: number) {
  const live = lead === 0;
  return new EmbedBuilder()
    .setColor(colour(live ? '#2ECC71' : DEFAULT_ACCENT))
    .setTitle(`${live ? '🟢' : sessionEmoji(s.name)} ${s.raceName} — ${s.name} ${live ? 'is LIVE' : (LEAD_TEXT[lead] ?? `starts in ${lead} minutes`)}`)
    .setURL(live ? `${SITE_URL}/live/` : `${SITE_URL}/calendar/`)
    .setDescription(
      `Round ${s.round} · ${s.circuit}, ${s.country}\n${when(s.start)}` +
        (live ? `\n\nFollow the live tracker: ${SITE_URL}/live/` : ''),
    )
    .setFooter(FOOTER);
}

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
const code = (d: { code?: string; familyName: string }) => d.code ?? d.familyName.slice(0, 3).toUpperCase();

export function resultEmbed(race: JRace, kind: ResultKind) {
  const title = kind === 'results' ? 'Race' : kind === 'sprint' ? 'Sprint' : 'Qualifying';
  let rows: string[];
  let winnerTeam: string;
  let extra = '';
  if (kind === 'qualifying') {
    const q = race.QualifyingResults ?? [];
    winnerTeam = resolveTeam([q[0]?.Constructor.constructorId, q[0]?.Constructor.name]).colour;
    rows = q.slice(0, 10).map((r) => {
      const t = r.Q3 ?? r.Q2 ?? r.Q1 ?? '';
      return `${pad(r.position, 3)}${pad(code(r.Driver), 5)}${pad(resolveTeam([r.Constructor.constructorId, r.Constructor.name]).name, 16)}${t}`;
    });
  } else {
    const res = (kind === 'results' ? race.Results : race.SprintResults) ?? [];
    winnerTeam = resolveTeam([res[0]?.Constructor.constructorId, res[0]?.Constructor.name]).colour;
    rows = res.slice(0, 10).map((r) => {
      const gap = r.position === '1' ? (r.Time?.time ?? '') : (r.Time?.time ?? r.status);
      return `${pad(r.positionText, 3)}${pad(code(r.Driver), 5)}${pad(resolveTeam([r.Constructor.constructorId, r.Constructor.name]).name, 16)}${pad(gap, 12)}${r.points.padStart(3)} pts`;
    });
    const podium = res
      .slice(0, 3)
      .map((r, i) => `${MEDALS[i]} **${r.Driver.givenName} ${r.Driver.familyName}**`)
      .join('\n');
    const out = res.filter((r) => NOT_CLASSIFIED.has(r.positionText)).map((r) => code(r.Driver));
    extra = `${podium}\n` + (out.length ? `\nNot classified: ${out.join(', ')}\n` : '');
  }
  return new EmbedBuilder()
    .setColor(colour(winnerTeam))
    .setTitle(`${sessionEmoji(title)} ${race.raceName} — ${title} results`)
    .setURL(`${SITE_URL}/standings/`)
    .setDescription(`Round ${race.round} · ${race.Circuit.circuitName}\n\n${extra}\`\`\`\n${rows.join('\n')}\n\`\`\``)
    .setFooter(FOOTER);
}

export function driverStandingsEmbed(list: JDriverStanding[]) {
  const leader = Number(list[0]?.points ?? 0);
  const rows = list.map((s) => {
    const c = s.Constructors[s.Constructors.length - 1];
    const team = c ? resolveTeam([c.constructorId, c.name]).name : '';
    const gap = s === list[0] ? '' : `-${leader - Number(s.points)}`;
    return `${pad(s.positionText, 3)}${pad(code(s.Driver), 5)}${pad(team, 16)}${s.points.padStart(4)} ${gap}`;
  });
  return new EmbedBuilder()
    .setColor(colour(list[0] ? resolveTeam([list[0].Constructors.at(-1)?.constructorId]).colour : DEFAULT_ACCENT))
    .setTitle("🏆 Drivers' championship")
    .setURL(`${SITE_URL}/standings/`)
    .setDescription(rows.length ? `\`\`\`\n${rows.join('\n')}\n\`\`\`` : 'No standings yet.')
    .setFooter(FOOTER);
}

export function constructorStandingsEmbed(list: JConstructorStanding[]) {
  const rows = list.map((s) => {
    const t = resolveTeam([s.Constructor.constructorId, s.Constructor.name]);
    return `${pad(s.positionText, 3)}${pad(t.name, 18)}${s.points.padStart(4)} pts  ${s.wins} ${s.wins === '1' ? 'win' : 'wins'}`;
  });
  return new EmbedBuilder()
    .setColor(colour(list[0] ? resolveTeam([list[0].Constructor.constructorId]).colour : DEFAULT_ACCENT))
    .setTitle("🏆 Constructors' championship")
    .setURL(`${SITE_URL}/standings/`)
    .setDescription(rows.length ? `\`\`\`\n${rows.join('\n')}\n\`\`\`` : 'No standings yet.')
    .setFooter(FOOTER);
}
