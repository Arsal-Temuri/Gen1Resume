export const MAX_UNDO_STEPS = 30;

export interface UndoHistoryState<T> {
  past: T[];
  future: T[];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createUndoHistory<T>(): UndoHistoryState<T> {
  return { past: [], future: [] };
}

export function pushHistorySnapshot<T>(
  history: UndoHistoryState<T>,
  currentSnapshot: T,
  maxSteps: number = MAX_UNDO_STEPS
): UndoHistoryState<T> {
  const nextPast = [...history.past, deepClone(currentSnapshot)];
  const trimmedPast =
    nextPast.length > maxSteps ? nextPast.slice(nextPast.length - maxSteps) : nextPast;
  return {
    past: trimmedPast,
    future: [],
  };
}

export function undoHistoryStep<T>(
  history: UndoHistoryState<T>,
  currentSnapshot: T,
  maxSteps: number = MAX_UNDO_STEPS
): { history: UndoHistoryState<T>; restored: T | null } {
  if (history.past.length === 0) {
    return { history, restored: null };
  }
  const restored = deepClone(history.past[history.past.length - 1]);
  const nextPast = history.past.slice(0, -1);
  const nextFuture = [...history.future, deepClone(currentSnapshot)];
  const trimmedFuture =
    nextFuture.length > maxSteps ? nextFuture.slice(nextFuture.length - maxSteps) : nextFuture;

  return {
    history: {
      past: nextPast,
      future: trimmedFuture,
    },
    restored,
  };
}

export function redoHistoryStep<T>(
  history: UndoHistoryState<T>,
  currentSnapshot: T,
  maxSteps: number = MAX_UNDO_STEPS
): { history: UndoHistoryState<T>; restored: T | null } {
  if (history.future.length === 0) {
    return { history, restored: null };
  }
  const restored = deepClone(history.future[history.future.length - 1]);
  const nextFuture = history.future.slice(0, -1);
  const nextPast = [...history.past, deepClone(currentSnapshot)];
  const trimmedPast =
    nextPast.length > maxSteps ? nextPast.slice(nextPast.length - maxSteps) : nextPast;

  return {
    history: {
      past: trimmedPast,
      future: nextFuture,
    },
    restored,
  };
}
