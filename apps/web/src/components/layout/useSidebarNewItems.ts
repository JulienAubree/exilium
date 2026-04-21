import { useEffect, useRef, useState, useCallback } from 'react';

const STORAGE_KEY = 'exilium.sidebar.seenItems';

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    // quota exceeded or unavailable — silent fallback
  }
}

/**
 * Tracks which sidebar items have already been seen (clicked) by the user.
 * Items that become visible and are not yet in the seen-set are returned as "new"
 * (they get the badge + animation). The caller must call markSeen(path) when
 * the user clicks the item.
 *
 * First-ever mount initializes seenItems with the currently visible set — so
 * existing players don't get a flood of "new" badges on already-used items.
 */
export function useSidebarNewItems(visiblePaths: Set<string>): {
  newPaths: Set<string>;
  markSeen: (path: string) => void;
} {
  const [seen, setSeen] = useState<Set<string>>(() => readSeen());
  const initialized = useRef(false);

  // First mount: if localStorage has no entry yet, initialize with currently visible paths
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      const initial = new Set(visiblePaths);
      writeSeen(initial);
      setSeen(initial);
    }
  }, [visiblePaths]);

  const markSeen = useCallback((path: string) => {
    setSeen((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      writeSeen(next);
      return next;
    });
  }, []);

  const newPaths = new Set<string>();
  for (const path of visiblePaths) {
    if (!seen.has(path)) newPaths.add(path);
  }

  return { newPaths, markSeen };
}
