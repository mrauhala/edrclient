import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import type { Temporal } from '../types/api';
import type { UseQueryUrlReturn } from './useQueryUrl';
import {
  normalizeTemporal,
  expandTemporalValues,
  getOverallTemporalExtent,
  formatDateString,
  parseDuration,
} from '../DataRetrievalAPI';

export type TimeMode = 'discrete' | 'continuous' | 'fallback';

export interface StepOption {
  label: string;
  shortLabel: string;
  ms: number;
}

export interface UseTimeControlReturn {
  timeMode: TimeMode;
  timeValues: string[];
  sliderMin: number;
  sliderMax: number;
  viewMin: number;
  viewMax: number;
  isZoomed: boolean;
  zoomToSelection: () => void;
  resetZoom: () => void;
  // sliderValue: driven by local drag state OR committed query state
  sliderValue: number | number[];
  onSliderChange: (value: number | number[]) => void;
  onSliderChangeCommitted: (value: number | number[]) => void;
  stepMs: number;
  stepLabel: string;
  stepShortLabel: string;
  stepOptions: StepOption[];
  selectedStepIndex: number;
  setSelectedStepIndex: (index: number) => void;
  stepUp: () => void;
  stepDown: () => void;
  marks: { value: number }[];
  startLabel: string;
  endLabel: string;
  currentTimeLabel: string;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
}

function toEpoch(iso: string): number {
  return new Date(iso).getTime();
}

function fromEpoch(epoch: number): string {
  return new Date(epoch).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function snapFloor(epoch: number, stepMs: number): number {
  if (stepMs <= 0) return epoch;
  return Math.floor(epoch / stepMs) * stepMs;
}

function snapNearest(epoch: number, stepMs: number): number {
  if (stepMs <= 0) return epoch;
  return Math.round(epoch / stepMs) * stepMs;
}

function snapCeil(epoch: number, stepMs: number): number {
  if (stepMs <= 0) return epoch;
  return Math.ceil(epoch / stepMs) * stepMs;
}

const ALL_STEP_OPTIONS: StepOption[] = [
  { label: '1 min', shortLabel: '1m', ms: 60 * 1000 },
  { label: '5 min', shortLabel: '5m', ms: 5 * 60 * 1000 },
  { label: '10 min', shortLabel: '10m', ms: 10 * 60 * 1000 },
  { label: '15 min', shortLabel: '15m', ms: 15 * 60 * 1000 },
  { label: '30 min', shortLabel: '30m', ms: 30 * 60 * 1000 },
  { label: '1 hour', shortLabel: '1h', ms: 60 * 60 * 1000 },
  { label: '3 hours', shortLabel: '3h', ms: 3 * 60 * 60 * 1000 },
  { label: '6 hours', shortLabel: '6h', ms: 6 * 60 * 60 * 1000 },
  { label: '12 hours', shortLabel: '12h', ms: 12 * 60 * 60 * 1000 },
  { label: '1 day', shortLabel: '1d', ms: 24 * 60 * 60 * 1000 },
  { label: '1 week', shortLabel: '1w', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '1 month', shortLabel: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
];

function getStepOptions(spanMs: number): StepOption[] {
  return ALL_STEP_OPTIONS.filter(opt => opt.ms <= spanMs / 2 && opt.ms >= spanMs / 10000);
}

function getDefaultStepIndex(options: StepOption[], spanMs: number): number {
  const targetStepMs = spanMs / 100;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < options.length; i++) {
    const dist = Math.abs(Math.log(options[i].ms / targetStepMs));
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return bestIdx;
}

function detectRepeatingDuration(temporal: Temporal): number | null {
  if (!temporal.values) return null;
  for (const v of temporal.values) {
    if (typeof v === 'string') {
      const match = v.match(/^R\d+\/[^/]+\/(.+)$/);
      if (match) return parseDuration(match[1]);
    }
  }
  return null;
}

function formatStepLabelMs(ms: number): string {
  if (ms < 60 * 1000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / (60 * 1000))} min`;
  if (ms < 24 * 60 * 60 * 1000) {
    const h = Math.round(ms / (60 * 60 * 1000));
    return h === 1 ? '1 hour' : `${h} hours`;
  }
  if (ms < 7 * 24 * 60 * 60 * 1000) {
    const d = Math.round(ms / (24 * 60 * 60 * 1000));
    return d === 1 ? '1 day' : `${d} days`;
  }
  const w = Math.round(ms / (7 * 24 * 60 * 60 * 1000));
  return w === 1 ? '1 week' : `${w} weeks`;
}

function formatShortStepLabel(ms: number): string {
  if (ms < 60 * 1000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / (60 * 1000))}m`;
  if (ms < 24 * 60 * 60 * 1000) return `${Math.round(ms / (60 * 60 * 1000))}h`;
  if (ms < 7 * 24 * 60 * 60 * 1000) return `${Math.round(ms / (24 * 60 * 60 * 1000))}d`;
  return `${Math.round(ms / (7 * 24 * 60 * 60 * 1000))}w`;
}

function computeDefaultStepIndex(
  options: StepOption[],
  rawBounds: { min: number; max: number } | null,
  temporal: Temporal | undefined,
): number {
  if (options.length === 0 || !rawBounds) return 0;
  if (temporal) {
    const duration = detectRepeatingDuration(temporal);
    if (duration) {
      const nativeIdx = options.findIndex(o => o.ms === duration);
      if (nativeIdx >= 0) return nativeIdx;
    }
  }
  return getDefaultStepIndex(options, rawBounds.max - rawBounds.min);
}

// Generate tick marks, capped at ~25 visible. Uses a multiple of stepMs if needed.
function generateContinuousMarks(viewMin: number, viewMax: number, stepMs: number): { value: number }[] {
  const MAX_MARKS = 25;
  const span = viewMax - viewMin;
  if (stepMs <= 0 || span <= 0) return [];

  const rawCount = Math.floor(span / stepMs);
  const multiplier = rawCount > MAX_MARKS ? Math.ceil(rawCount / MAX_MARKS) : 1;
  const markInterval = stepMs * multiplier;

  const start = snapCeil(viewMin, markInterval);
  const result: { value: number }[] = [];
  for (let t = start; t <= viewMax && result.length <= MAX_MARKS; t += markInterval) {
    result.push({ value: t });
  }
  return result;
}

export function useTimeControl(
  temporal: Temporal | undefined,
  queryState: UseQueryUrlReturn
): UseTimeControlReturn {
  const {
    selectedDatetime, setSelectedDatetime,
    datetimeMode,
    startDatetime, setStartDatetime,
    endDatetime, setEndDatetime,
  } = queryState;

  // ── Temporal data ──
  const timeValues = useMemo(() => {
    if (!temporal) return [];
    return expandTemporalValues(temporal, 1000);
  }, [temporal]);

  const rawBounds = useMemo(() => {
    if (!temporal) return null;
    const normalized = normalizeTemporal(temporal);
    if (!normalized) return null;
    const { intervals, trs } = normalized;
    if (trs && !trs.includes('Gregorian')) return null;

    if (intervals.length > 0) {
      const overall = getOverallTemporalExtent(intervals);
      if (overall && overall[0] !== null && overall[1] !== null) {
        const min = toEpoch(overall[0]);
        const max = toEpoch(overall[1]);
        if (!isNaN(min) && !isNaN(max) && min < max) return { min, max };
      }
    }
    if (timeValues.length >= 2) {
      const min = toEpoch(timeValues[0]);
      const max = toEpoch(timeValues[timeValues.length - 1]);
      if (!isNaN(min) && !isNaN(max) && min < max) return { min, max };
    }
    return null;
  }, [temporal, timeValues]);

  const timeMode: TimeMode = useMemo(() => {
    if (!temporal || !rawBounds) return 'fallback';
    const hasValues = temporal.values && temporal.values.length > 0;
    if (hasValues && timeValues.length <= 250) return 'discrete';
    return 'continuous';
  }, [temporal, rawBounds, timeValues.length]);

  // ── Step options ──
  const stepOptions = useMemo(() => {
    if (!rawBounds || timeMode === 'discrete') return [];
    if (temporal) {
      const duration = detectRepeatingDuration(temporal);
      if (duration) {
        const options = getStepOptions(rawBounds.max - rawBounds.min);
        const hasNative = options.some(o => o.ms === duration);
        if (!hasNative) {
          const sl = formatShortStepLabel(duration);
          return [...options, { label: `${formatStepLabelMs(duration)} (native)`, shortLabel: sl, ms: duration }]
            .sort((a, b) => a.ms - b.ms);
        }
        return options;
      }
    }
    return getStepOptions(rawBounds.max - rawBounds.min);
  }, [temporal, rawBounds, timeMode]);

  const defaultStepIndex = useMemo(
    () => computeDefaultStepIndex(stepOptions, rawBounds, temporal),
    [stepOptions, rawBounds, temporal],
  );

  const [selectedStepIndex, setSelectedStepIndex] = useState(defaultStepIndex);

  const prevDefaultRef = useRef(defaultStepIndex);
  useEffect(() => {
    if (prevDefaultRef.current !== defaultStepIndex) {
      prevDefaultRef.current = defaultStepIndex;
      setSelectedStepIndex(defaultStepIndex);
    }
  }, [defaultStepIndex]);

  const stepUp = useCallback(() => {
    setSelectedStepIndex(prev => Math.min(stepOptions.length - 1, prev + 1));
  }, [stepOptions.length]);

  const stepDown = useCallback(() => {
    setSelectedStepIndex(prev => Math.max(0, prev - 1));
  }, []);

  const stepMs = useMemo(() => {
    if (timeMode === 'discrete' && timeValues.length >= 2) {
      return toEpoch(timeValues[1]) - toEpoch(timeValues[0]);
    }
    if (stepOptions.length > 0 && selectedStepIndex >= 0 && selectedStepIndex < stepOptions.length) {
      return stepOptions[selectedStepIndex].ms;
    }
    return 60 * 60 * 1000;
  }, [timeMode, timeValues, stepOptions, selectedStepIndex]);

  // ── Slider bounds (snapped to step) ──
  const sliderMin = useMemo(() => {
    if (!rawBounds) return 0;
    if (timeMode === 'discrete') return rawBounds.min;
    return snapFloor(rawBounds.min, stepMs);
  }, [rawBounds, timeMode, stepMs]);

  const sliderMax = useMemo(() => {
    if (!rawBounds) return 0;
    if (timeMode === 'discrete') return rawBounds.max;
    return snapCeil(rawBounds.max, stepMs);
  }, [rawBounds, timeMode, stepMs]);

  // ── Viewport zoom ──
  const [viewMin, setViewMin] = useState<number | null>(null);
  const [viewMax, setViewMax] = useState<number | null>(null);

  useEffect(() => { setViewMin(null); setViewMax(null); }, [rawBounds]);

  const effectiveViewMin = viewMin ?? sliderMin;
  const effectiveViewMax = viewMax ?? sliderMax;
  const isZoomed = viewMin !== null || viewMax !== null;

  // Manual zoom only — no auto-zoom during drag
  const zoomToSelection = useCallback(() => {
    if (datetimeMode !== 'range' || !startDatetime || !endDatetime) return;
    const s = toEpoch(startDatetime);
    const e = toEpoch(endDatetime);
    const rangeSize = e - s;
    if (rangeSize <= 0) return;
    const padding = rangeSize * 2;
    setViewMin(snapFloor(Math.max(sliderMin, s - padding), stepMs));
    setViewMax(snapCeil(Math.min(sliderMax, e + padding), stepMs));
  }, [datetimeMode, startDatetime, endDatetime, sliderMin, sliderMax, stepMs]);

  const resetZoom = useCallback(() => { setViewMin(null); setViewMax(null); }, []);

  // ── Marks ──
  // Discrete: always provide marks (MUI step=null REQUIRES marks for valid positions)
  // Continuous: tick marks based on step, limited to ~25
  const marks = useMemo(() => {
    if (timeMode === 'discrete') {
      // Always provide all values as marks — MUI step=null needs them for snapping
      return timeValues.map(v => ({ value: toEpoch(v) }));
    }
    return generateContinuousMarks(effectiveViewMin, effectiveViewMax, stepMs);
  }, [timeMode, timeValues, effectiveViewMin, effectiveViewMax, stepMs]);

  // ── Labels ──
  const startLabel = rawBounds ? formatDateString(fromEpoch(effectiveViewMin)) : '';
  const endLabel = rawBounds ? formatDateString(fromEpoch(effectiveViewMax)) : '';

  // ── Default to latest time ──
  useEffect(() => {
    if (!rawBounds || timeMode === 'fallback') return;
    if (datetimeMode === 'individual' && !selectedDatetime) {
      if (timeMode === 'discrete' && timeValues.length > 0) {
        setSelectedDatetime(timeValues[timeValues.length - 1]);
      } else {
        setSelectedDatetime(fromEpoch(snapFloor(rawBounds.max, stepMs)));
      }
    }
  }, [rawBounds, timeMode, datetimeMode, selectedDatetime, stepMs, timeValues, setSelectedDatetime]);

  // ── Re-snap on step change ──
  const prevStepRef = useRef(stepMs);
  useEffect(() => {
    if (prevStepRef.current === stepMs) return;
    prevStepRef.current = stepMs;
    if (timeMode !== 'continuous') return;

    if (datetimeMode === 'individual' && selectedDatetime) {
      const snapped = snapNearest(toEpoch(selectedDatetime), stepMs);
      setSelectedDatetime(fromEpoch(Math.max(sliderMin, Math.min(sliderMax, snapped))));
    }
    if (datetimeMode === 'range') {
      if (startDatetime) setStartDatetime(fromEpoch(Math.max(sliderMin, snapNearest(toEpoch(startDatetime), stepMs))));
      if (endDatetime) setEndDatetime(fromEpoch(Math.min(sliderMax, snapNearest(toEpoch(endDatetime), stepMs))));
    }
    setViewMin(null);
    setViewMax(null);
  }, [stepMs, timeMode, datetimeMode, selectedDatetime, startDatetime, endDatetime, sliderMin, sliderMax, setSelectedDatetime, setStartDatetime, setEndDatetime]);

  // ── Local drag state ──
  // During drag, we store the raw slider value locally for smooth UX.
  // On commit (mouse up), we snap and write to query state.
  const [dragValue, setDragValue] = useState<number | number[] | null>(null);
  const isDragging = dragValue !== null;

  // Committed slider value from query state
  const committedValue = useMemo((): number | number[] => {
    const vMin = effectiveViewMin;
    const vMax = effectiveViewMax;
    if (datetimeMode === 'range') {
      const s = startDatetime ? toEpoch(startDatetime) : vMin;
      const e = endDatetime ? toEpoch(endDatetime) : vMax;
      return [
        Math.max(vMin, Math.min(vMax, isNaN(s) ? vMin : s)),
        Math.max(vMin, Math.min(vMax, isNaN(e) ? vMax : e)),
      ];
    }
    const v = selectedDatetime ? toEpoch(selectedDatetime) : vMax;
    return Math.max(vMin, Math.min(vMax, isNaN(v) ? vMax : v));
  }, [datetimeMode, selectedDatetime, startDatetime, endDatetime, effectiveViewMin, effectiveViewMax]);

  // The value the slider actually renders — local drag state if dragging, committed otherwise
  const sliderValue = isDragging ? dragValue : committedValue;

  const currentTimeLabel = useMemo(() => {
    if (datetimeMode === 'range') {
      const s = startDatetime ? formatDateString(startDatetime) : 'Start';
      const e = endDatetime ? formatDateString(endDatetime) : 'End';
      return `${s} \u2013 ${e}`;
    }
    return selectedDatetime ? formatDateString(selectedDatetime) : 'Latest';
  }, [datetimeMode, selectedDatetime, startDatetime, endDatetime]);

  const findNearestValue = useCallback((epoch: number): string => {
    if (timeValues.length === 0) return fromEpoch(epoch);
    let nearest = timeValues[0];
    let minDist = Math.abs(toEpoch(timeValues[0]) - epoch);
    for (let i = 1; i < timeValues.length; i++) {
      const dist = Math.abs(toEpoch(timeValues[i]) - epoch);
      if (dist < minDist) { minDist = dist; nearest = timeValues[i]; }
    }
    return nearest;
  }, [timeValues]);

  // ── Commit helpers (snap + write to query state) ──
  const commitTime = useCallback((epoch: number) => {
    const clamped = Math.max(sliderMin, Math.min(sliderMax, epoch));
    if (timeMode === 'discrete') {
      setSelectedDatetime(findNearestValue(clamped));
    } else {
      const snapped = snapNearest(clamped, stepMs);
      setSelectedDatetime(fromEpoch(Math.max(sliderMin, Math.min(sliderMax, snapped))));
    }
  }, [sliderMin, sliderMax, timeMode, stepMs, findNearestValue, setSelectedDatetime]);

  const commitRange = useCallback((startEpoch: number, endEpoch: number) => {
    if (timeMode === 'discrete') {
      setStartDatetime(findNearestValue(Math.max(sliderMin, Math.min(sliderMax, startEpoch))));
      setEndDatetime(findNearestValue(Math.max(sliderMin, Math.min(sliderMax, endEpoch))));
    } else {
      setStartDatetime(fromEpoch(Math.max(sliderMin, snapNearest(startEpoch, stepMs))));
      setEndDatetime(fromEpoch(Math.min(sliderMax, snapNearest(endEpoch, stepMs))));
    }
  }, [sliderMin, sliderMax, timeMode, stepMs, findNearestValue, setStartDatetime, setEndDatetime]);

  // ── Slider event handlers ──
  // onChange: store raw value locally for responsive drag (no snapping, no query state writes)
  const onSliderChange = useCallback((value: number | number[]) => {
    setDragValue(value);
  }, []);

  // onChangeCommitted: snap, write to query state, clear local drag
  const onSliderChangeCommitted = useCallback((value: number | number[]) => {
    setDragValue(null);
    if (Array.isArray(value)) {
      commitRange(value[0], value[1]);
    } else {
      commitTime(value);
    }
  }, [commitTime, commitRange]);

  // ── Transport buttons (always commit immediately) ──
  const stepForward = useCallback(() => {
    if (datetimeMode === 'range') {
      const s = startDatetime ? toEpoch(startDatetime) : sliderMin;
      const e = endDatetime ? toEpoch(endDatetime) : sliderMax;
      const rangeSize = e - s;
      const newStart = Math.min(sliderMax - rangeSize, s + stepMs);
      commitRange(newStart, newStart + rangeSize);
      return;
    }
    if (timeMode === 'discrete') {
      const currentEpoch = selectedDatetime ? toEpoch(selectedDatetime) : sliderMin;
      const idx = timeValues.findIndex(v => toEpoch(v) >= currentEpoch);
      const nextIdx = Math.min(timeValues.length - 1, (idx >= 0 ? idx : 0) + 1);
      setSelectedDatetime(timeValues[nextIdx]);
    } else {
      const current = selectedDatetime ? toEpoch(selectedDatetime) : sliderMax;
      commitTime(current + stepMs);
    }
  }, [datetimeMode, selectedDatetime, startDatetime, endDatetime, sliderMin, sliderMax, stepMs, timeMode, timeValues, setSelectedDatetime, commitTime, commitRange]);

  const stepBackward = useCallback(() => {
    if (datetimeMode === 'range') {
      const s = startDatetime ? toEpoch(startDatetime) : sliderMin;
      const e = endDatetime ? toEpoch(endDatetime) : sliderMax;
      const rangeSize = e - s;
      const newStart = Math.max(sliderMin, s - stepMs);
      commitRange(newStart, newStart + rangeSize);
      return;
    }
    if (timeMode === 'discrete') {
      const currentEpoch = selectedDatetime ? toEpoch(selectedDatetime) : sliderMax;
      const idx = timeValues.findIndex(v => toEpoch(v) >= currentEpoch);
      const prevIdx = Math.max(0, (idx >= 0 ? idx : timeValues.length) - 1);
      setSelectedDatetime(timeValues[prevIdx]);
    } else {
      const current = selectedDatetime ? toEpoch(selectedDatetime) : sliderMax;
      commitTime(current - stepMs);
    }
  }, [datetimeMode, selectedDatetime, startDatetime, endDatetime, sliderMin, sliderMax, stepMs, timeMode, timeValues, setSelectedDatetime, commitTime, commitRange]);

  const jumpToStart = useCallback(() => {
    if (datetimeMode === 'range') {
      const s = startDatetime ? toEpoch(startDatetime) : sliderMin;
      const e = endDatetime ? toEpoch(endDatetime) : sliderMax;
      const rangeSize = e - s;
      commitRange(sliderMin, Math.min(sliderMin + rangeSize, sliderMax));
      return;
    }
    if (timeMode === 'discrete' && timeValues.length > 0) {
      setSelectedDatetime(timeValues[0]);
    } else {
      setSelectedDatetime(fromEpoch(sliderMin));
    }
  }, [datetimeMode, startDatetime, endDatetime, sliderMin, sliderMax, timeMode, timeValues, setSelectedDatetime, commitRange]);

  const jumpToEnd = useCallback(() => {
    if (datetimeMode === 'range') {
      const s = startDatetime ? toEpoch(startDatetime) : sliderMin;
      const e = endDatetime ? toEpoch(endDatetime) : sliderMax;
      const rangeSize = e - s;
      commitRange(Math.max(sliderMax - rangeSize, sliderMin), sliderMax);
      return;
    }
    if (timeMode === 'discrete' && timeValues.length > 0) {
      setSelectedDatetime(timeValues[timeValues.length - 1]);
    } else {
      setSelectedDatetime(fromEpoch(snapFloor(rawBounds?.max ?? sliderMax, stepMs)));
    }
  }, [datetimeMode, startDatetime, endDatetime, sliderMin, sliderMax, rawBounds, stepMs, timeMode, timeValues, setSelectedDatetime, commitRange]);

  const stepLabel = useMemo(() => {
    if (timeMode === 'discrete' && timeValues.length >= 2) {
      return formatStepLabelMs(toEpoch(timeValues[1]) - toEpoch(timeValues[0]));
    }
    if (stepOptions.length > 0 && selectedStepIndex >= 0 && selectedStepIndex < stepOptions.length) {
      return stepOptions[selectedStepIndex].label;
    }
    return '';
  }, [timeMode, timeValues, stepOptions, selectedStepIndex]);

  const stepShortLabel = useMemo(() => {
    if (timeMode === 'discrete' && timeValues.length >= 2) {
      return formatShortStepLabel(toEpoch(timeValues[1]) - toEpoch(timeValues[0]));
    }
    if (stepOptions.length > 0 && selectedStepIndex >= 0 && selectedStepIndex < stepOptions.length) {
      return stepOptions[selectedStepIndex].shortLabel;
    }
    return '';
  }, [timeMode, timeValues, stepOptions, selectedStepIndex]);

  return {
    timeMode,
    timeValues,
    sliderMin,
    sliderMax,
    viewMin: effectiveViewMin,
    viewMax: effectiveViewMax,
    isZoomed,
    zoomToSelection,
    resetZoom,
    sliderValue,
    onSliderChange,
    onSliderChangeCommitted,
    stepMs,
    stepLabel,
    stepShortLabel,
    stepOptions,
    selectedStepIndex,
    setSelectedStepIndex,
    stepUp,
    stepDown,
    marks,
    startLabel,
    endLabel,
    currentTimeLabel,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
  };
}
