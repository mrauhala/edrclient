import { useEffect, useCallback, useMemo } from 'react';
import { useMapsLayers, type MapsBundleState } from '../contexts/MapsLayerContext';

export interface BundleView extends MapsBundleState {
  // Frame instants indexed by frameIndex (ISO strings), for the playback bar's time label/scrubber.
  frameTimes: string[];
}

export interface UseMapsAnimationReturn {
  bundles: BundleView[];
  togglePlay: (id: string) => void;
  stepForward: (id: string) => void;
  stepBackward: (id: string) => void;
  jumpToStart: (id: string) => void;
  jumpToEnd: (id: string) => void;
  seek: (id: string, index: number) => void;
  setFps: (id: string, fps: number) => void;
  removeBundle: (id: string) => void;
}

// Drives animation-bundle playback: derives per-bundle frame times, exposes transport controls,
// and runs one interval per playing bundle that advances its currentIndex (looping).
export function useMapsAnimation(): UseMapsAnimationReturn {
  const { mapsLayers, setMapsLayers, mapsBundles, setMapsBundles } = useMapsLayers();

  const frameTimesByBundle = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const l of mapsLayers) {
      if (!l.bundleId) continue;
      (m[l.bundleId] ||= [])[l.frameIndex ?? 0] = l.frameTime ?? l.datetime ?? '';
    }
    return m;
  }, [mapsLayers]);

  const bundles = useMemo<BundleView[]>(
    () => Object.values(mapsBundles).map(b => ({ ...b, frameTimes: frameTimesByBundle[b.bundleId] ?? [] })),
    [mapsBundles, frameTimesByBundle],
  );

  const update = useCallback(
    (id: string, fn: (b: MapsBundleState) => MapsBundleState) => {
      setMapsBundles(prev => (prev[id] ? { ...prev, [id]: fn(prev[id]) } : prev));
    },
    [setMapsBundles],
  );

  const wrap = (b: MapsBundleState, i: number) => ((i % b.frameCount) + b.frameCount) % b.frameCount;

  const togglePlay = useCallback((id: string) => update(id, b => ({ ...b, isPlaying: !b.isPlaying })), [update]);
  const stepForward = useCallback((id: string) => update(id, b => ({ ...b, isPlaying: false, currentIndex: wrap(b, b.currentIndex + 1) })), [update]);
  const stepBackward = useCallback((id: string) => update(id, b => ({ ...b, isPlaying: false, currentIndex: wrap(b, b.currentIndex - 1) })), [update]);
  const jumpToStart = useCallback((id: string) => update(id, b => ({ ...b, isPlaying: false, currentIndex: 0 })), [update]);
  const jumpToEnd = useCallback((id: string) => update(id, b => ({ ...b, isPlaying: false, currentIndex: b.frameCount - 1 })), [update]);
  const seek = useCallback((id: string, index: number) => update(id, b => ({ ...b, isPlaying: false, currentIndex: wrap(b, index) })), [update]);
  const setFps = useCallback((id: string, fps: number) => update(id, b => ({ ...b, fps })), [update]);

  const removeBundle = useCallback(
    (id: string) => {
      setMapsLayers(prev => prev.filter(l => l.bundleId !== id));
      setMapsBundles(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [setMapsLayers, setMapsBundles],
  );

  // Keyed on the control fields only (NOT currentIndex) so a tick doesn't recreate the intervals.
  const timerKey = Object.values(mapsBundles)
    .map(b => `${b.bundleId}:${b.isPlaying ? 1 : 0}:${b.fps}:${b.frameCount}`)
    .join('|');
  useEffect(() => {
    const playing = Object.values(mapsBundles).filter(b => b.isPlaying && b.frameCount > 1);
    if (!playing.length) return;
    const timers = playing.map(b =>
      setInterval(() => {
        setMapsBundles(prev => {
          const cur = prev[b.bundleId];
          if (!cur) return prev;
          return { ...prev, [b.bundleId]: { ...cur, currentIndex: (cur.currentIndex + 1) % cur.frameCount } };
        });
      }, Math.max(100, 1000 / Math.max(0.1, b.fps))),
    );
    return () => timers.forEach(clearInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerKey, setMapsBundles]);

  return { bundles, togglePlay, stepForward, stepBackward, jumpToStart, jumpToEnd, seek, setFps, removeBundle };
}
