// ============================================================
// Undo/Redo History Hook
// ============================================================
import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY = 50;

export function useHistory(initial) {
  const [state, setState] = useState(initial);
  const past = useRef([]);
  const future = useRef([]);
  const skipNext = useRef(false);

  const set = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (skipNext.current) {
        skipNext.current = false;
        return next;
      }
      past.current.push(prev);
      if (past.current.length > MAX_HISTORY) past.current.shift();
      future.current = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    setState(prev => {
      const previous = past.current.pop();
      future.current.push(prev);
      skipNext.current = true;
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    setState(prev => {
      const next = future.current.pop();
      past.current.push(prev);
      skipNext.current = true;
      return next;
    });
  }, []);

  const reset = useCallback((newState) => {
    past.current = [];
    future.current = [];
    skipNext.current = true;
    setState(newState);
  }, []);

  return {
    state,
    set,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0
  };
}
