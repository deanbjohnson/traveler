export interface SearchProgress {
  current: number;
  total: number;
  startedAt: number;
  updatedAt: number;
  message?: string;
  done?: boolean;
}

// Use a global store so multiple route handlers share the same map in dev/prod
const g = globalThis as any;
if (!g.__TRIP_PROGRESS_MAP__) {
  g.__TRIP_PROGRESS_MAP__ = new Map<string, SearchProgress>();
}
const tripIdToProgress: Map<string, SearchProgress> = g.__TRIP_PROGRESS_MAP__ as Map<string, SearchProgress>;

export function setProgress(tripId: string, progress: Partial<SearchProgress>) {
  const existing = tripIdToProgress.get(tripId);
  const merged: SearchProgress = {
    current: existing?.current ?? 0,
    total: existing?.total ?? 0,
    startedAt: existing?.startedAt ?? Date.now(),
    updatedAt: Date.now(),
    message: existing?.message,
    done: existing?.done ?? false,
    ...progress,
    updatedAt: Date.now(),
  };
  tripIdToProgress.set(tripId, merged);
}

export function getProgress(tripId: string): SearchProgress | null {
  return tripIdToProgress.get(tripId) ?? null;
}

export function resetProgress(tripId: string) {
  tripIdToProgress.delete(tripId);
}


