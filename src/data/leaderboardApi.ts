import { config } from '../config';
import {
  AppError,
  appErrorFromHttp,
  readApiErrorMessage,
} from '../errors/appError';

export interface LeaderboardEntry {
  rank: number;
  /** Present only when the user is public; otherwise null. */
  userId: number | null;
  username: string;
  xpGained: number;
  isPublic: boolean;
  /** True when this row belongs to the logged-in viewer (set server-side). */
  isViewer: boolean;
}

export interface LeaderboardPeriod {
  period: 'day' | 'week' | 'month' | string;
  windowStartUtc: string;
  entries: LeaderboardEntry[];
}

export interface LeaderboardSnapshot {
  generatedAtUtc: string;
  nextRefreshUtc: string;
  day: LeaderboardPeriod;
  week: LeaderboardPeriod;
  month: LeaderboardPeriod;
}

function leaderboardUrl(): string {
  return `${config.apiBaseUrl.replace(/\/+$/, '')}/api/leaderboard`;
}

export async function fetchLeaderboard(token: string): Promise<LeaderboardSnapshot> {
  let response: Response;
  try {
    response = await fetch(leaderboardUrl(), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    const apiError = await readApiErrorMessage(response);
    throw appErrorFromHttp(response.status, apiError, 'unauthorized');
  }
  return (await response.json()) as LeaderboardSnapshot;
}
