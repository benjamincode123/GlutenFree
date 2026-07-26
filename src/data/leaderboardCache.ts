import type { LeaderboardSnapshot } from '../data/leaderboardApi';

let memorySnapshot: LeaderboardSnapshot | null = null;

export function getCachedLeaderboardSync(): LeaderboardSnapshot | null {
  return memorySnapshot;
}

export function saveCachedLeaderboard(snapshot: LeaderboardSnapshot): void {
  memorySnapshot = snapshot;
}

export function clearCachedLeaderboard(): void {
  memorySnapshot = null;
}
