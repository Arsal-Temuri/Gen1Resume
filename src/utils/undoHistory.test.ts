import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUndoHistory,
  pushHistorySnapshot,
  redoHistoryStep,
  undoHistoryStep,
} from './undoHistory';

test('undo and redo restore exact deep-cloned states and clear future on new edit', () => {
  let history = createUndoHistory<{ text: string; count: number }>();
  let current = { text: 'v1', count: 1 };

  // Edit 1: v1 -> v2
  history = pushHistorySnapshot(history, current);
  current = { text: 'v2', count: 2 };

  // Edit 2: v2 -> v3
  history = pushHistorySnapshot(history, current);
  current = { text: 'v3', count: 3 };

  assert.equal(history.past.length, 2);
  assert.equal(history.future.length, 0);

  // Undo back to v2
  const u1 = undoHistoryStep(history, current);
  assert.deepEqual(u1.restored, { text: 'v2', count: 2 });
  history = u1.history;
  current = u1.restored!;
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 1);

  // Undo back to v1
  const u2 = undoHistoryStep(history, current);
  assert.deepEqual(u2.restored, { text: 'v1', count: 1 });
  history = u2.history;
  current = u2.restored!;
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, 2);

  // Redo forward to v2
  const r1 = redoHistoryStep(history, current);
  assert.deepEqual(r1.restored, { text: 'v2', count: 2 });
  history = r1.history;
  current = r1.restored!;
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 1);

  // New edit branches history and clears redo stack
  history = pushHistorySnapshot(history, current);
  current = { text: 'v2-branch', count: 99 };
  assert.equal(history.future.length, 0);
  assert.equal(history.past.length, 2);
});

test('undo stack enforces maximum step bound', () => {
  let history = createUndoHistory<number>();
  for (let i = 0; i < 40; i++) {
    history = pushHistorySnapshot(history, i, 30);
  }
  assert.equal(history.past.length, 30);
  assert.equal(history.past[0], 10);
  assert.equal(history.past[29], 39);
});
