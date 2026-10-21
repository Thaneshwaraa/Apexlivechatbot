/** One timed session of a race weekend (practice, qualifying, sprint, race). */
export interface SessionInfo {
  /** stable id, e.g. "2026-r18-race" */
  id: string;
  round: number;
  raceName: string;
  circuit: string;
  locality: string;
  country: string;
  name: string;
  start: string; // ISO
  end: string; // ISO (estimated from typical session length)
}
