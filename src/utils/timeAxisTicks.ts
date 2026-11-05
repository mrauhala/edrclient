import type { AxisValueFormatterContext } from '@mui/x-charts/models';
import { utcClock, utcDay, utcMoment } from './utcTime';

// Time axis tick labels show the time, with the date added on the first labelled tick and
// wherever the day changes. MUI hides tick labels that would overlap, which can drop exactly the
// ticks carrying a date (e.g. 3-hourly ticks labelled 15, 21, 03, 09 never show midnight). So the
// formatter picks the labelled ticks itself, every n-th tick counted from midnight so that day
// boundaries stay labelled, and returns '' for the rest, which MUI then leaves unlabelled.

const DAY_MS = 24 * 60 * 60 * 1000;
// MUI's tick label font (the 12px caption), measured bold because the date labels are bold
const TICK_FONT = 'bold 12px Roboto, Helvetica, Arial, sans-serif';
const LETTER_SPACING_PX = 0.4; // caption letterSpacing 0.03333em, which canvas measureText ignores
// MUI's minimum gap between tick labels. Spacing labels by the widest label already leaves slack,
// so MUI's own overlap check never hides one of the labels picked here.
const LABEL_GAP_PX = 4;
// MUI measures a two-line label as if it were on one line, and shortens it to "00:00…" if that
// wouldn't fit beside the axis's end, which takes the date with it. Beyond the charts' margins, this
// much more room is enough, so a tick any closer to an end goes unlabelled.
const END_GAP_PX = 14;

let measureContext: CanvasRenderingContext2D | null | undefined;
const widthCache = new Map<string, number>();

function textWidth(text: string): number {
  if (measureContext === undefined) {
    measureContext = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    if (measureContext) {
      measureContext.font = TICK_FONT;
    }
  }
  if (!measureContext) {
    // No DOM (unit tests): a generous per-character estimate
    return text.length * 7;
  }
  let width = widthCache.get(text);
  if (width === undefined) {
    width = measureContext.measureText(text).width + text.length * LETTER_SPACING_PX;
    widthCache.set(text, width);
  }
  return width;
}

const formatClock = utcClock;
const formatDay = utcDay;

const startOfDay = (date: Date) => new Date(date).setUTCHours(0, 0, 0, 0);

// Indexes of the ticks to label: enough apart for their labels not to overlap and, for sub-day
// steps, aligned to midnight
export function labelledTickIndexes(ticks: Date[], position: (tick: Date) => number, ends?: number[]): number[] {
  if (ticks.length < 2) {
    return ticks.map((_, i) => i);
  }
  const step = ticks[1].getTime() - ticks[0].getTime();
  const spacing = Math.abs(position(ticks[1]) - position(ticks[0]));
  const widestLabel = Math.max(...ticks.map(tick => Math.max(textWidth(formatClock(tick)), textWidth(formatDay(tick)))));
  const every = Math.max(1, Math.ceil((widestLabel + LABEL_GAP_PX) / spacing));
  const stepsFromMidnight = (tick: Date, i: number) =>
    step < DAY_MS ? Math.round((tick.getTime() - startOfDay(tick)) / step) : i;
  const evenly = ticks.flatMap((tick, i) => (stepsFromMidnight(tick, i) % every === 0 ? [i] : []));
  if (!ends) return evenly;
  const clear = evenly.filter(i => ends.every(end => Math.abs(position(ticks[i]) - end) >= END_GAP_PX));
  return clear.length > 0 ? clear : evenly;
}

export function formatTimeTick(value: Date | number, context: AxisValueFormatterContext<'utc'>): string {
  const date = new Date(value);
  if (context.location !== 'tick') {
    return utcMoment(date);
  }
  const ticks = context.scale.ticks(context.tickNumber);
  const index = ticks.findIndex(tick => tick.getTime() === date.getTime());
  const labelled = labelledTickIndexes(ticks, tick => context.scale(tick), context.scale.range());
  const order = labelled.indexOf(index);
  if (index !== -1 && order === -1) {
    return '';
  }
  const previous = order > 0 ? ticks[labelled[order - 1]] : undefined;
  const isNewDay = !previous || utcDay(previous) !== utcDay(date);
  return isNewDay ? `${formatClock(date)}\n${formatDay(date)}` : formatClock(date);
}
