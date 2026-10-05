import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ValidationError } from '../DataRetrievalAPI';
import { findLineForJsonPointer, findCollectionRange, getCollectionIndexFromPath } from '../utils/jsonPointerToLine';

export interface UseValidationErrorNavigationReturn {
  errorLines: Set<number>;
  errorLineList: { line: number; errors: ValidationError[] }[];
  gutterRanges: { start: number; end: number }[];
  currentErrorIdx: number;
  currentError: { line: number; errors: ValidationError[] } | undefined;
  scrollLine: number | undefined; // the current error's line, else the line scrollToPath points at
  handlePrevError: () => void;
  handleNextError: () => void;
}

export function useValidationErrorNavigation(
  validationErrors: ValidationError[],
  formattedData: string,
  contentType: string | null,
  scrollToPath: string | undefined,
  open: boolean,
): UseValidationErrorNavigationReturn {
  // Compute error line numbers, collection gutter ranges, and per-line error map
  const { errorLines, errorLineList, gutterRanges, initialErrorIdx, targetLine } = useMemo(() => {
    const isJson = !!formattedData && !!contentType?.includes('json');
    // The requested place, also when there's nothing to highlight there (e.g. an API docs operation)
    const targetLine = isJson && scrollToPath && scrollToPath !== 'root' ? findLineForJsonPointer(formattedData, scrollToPath) : 0;
    const empty = {
      errorLines: new Set<number>(),
      errorLineList: [] as { line: number; errors: ValidationError[] }[],
      gutterRanges: [] as { start: number; end: number }[],
      initialErrorIdx: 0,
      targetLine,
    };
    if (!validationErrors.length || !isJson) return empty;

    const errLines = new Set<number>();
    const byLine = new Map<number, ValidationError[]>();
    const ranges: { start: number; end: number }[] = [];
    const seenCollections = new Set<number>();

    for (const err of validationErrors) {
      if (!err.path || err.path === 'root') continue;
      const line = findLineForJsonPointer(formattedData, err.path);
      if (line > 0) {
        errLines.add(line);
        if (!byLine.has(line)) byLine.set(line, []);
        byLine.get(line)!.push(err);
      }

      const collIdx = getCollectionIndexFromPath(err.path);
      if (collIdx !== null && !seenCollections.has(collIdx)) {
        seenCollections.add(collIdx);
        const range = findCollectionRange(formattedData, collIdx);
        if (range) ranges.push(range);
      }
    }

    // Build sorted list of unique error lines with their errors
    const sortedLines = Array.from(byLine.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([line, errors]) => ({ line, errors }));

    // Find initial index based on scrollToPath
    let initIdx = 0;
    if (targetLine > 0) {
      const idx = sortedLines.findIndex(e => e.line === targetLine);
      if (idx >= 0) initIdx = idx;
    }

    return { errorLines: errLines, errorLineList: sortedLines, gutterRanges: ranges, initialErrorIdx: initIdx, targetLine };
  }, [validationErrors, formattedData, contentType, scrollToPath]);

  // Navigation state
  const [currentErrorIdx, setCurrentErrorIdx] = useState(0);

  // Reset navigation index when errors change or when initially opened
  useEffect(() => {
    setCurrentErrorIdx(initialErrorIdx);
  }, [initialErrorIdx]);

  const currentError = errorLineList[currentErrorIdx];

  // Stabilized callbacks using functional setState — no deps on currentErrorIdx
  const handlePrevError = useCallback(() => {
    setCurrentErrorIdx(prev => (prev <= 0 ? prev : prev - 1));
  }, []);

  const handleNextError = useCallback(() => {
    setCurrentErrorIdx(prev => (prev >= errorLineList.length - 1 ? prev : prev + 1));
  }, [errorLineList.length]);

  // Keyboard navigation: Ctrl/Cmd + ArrowUp/Down for prev/next error
  useEffect(() => {
    if (!open || !errorLineList.length) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); handlePrevError(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); handleNextError(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, errorLineList.length, handlePrevError, handleNextError]);

  return {
    errorLines,
    errorLineList,
    gutterRanges,
    currentErrorIdx,
    currentError,
    scrollLine: currentError?.line ?? (targetLine || undefined),
    handlePrevError,
    handleNextError,
  };
}
