import { afterAll, describe, expect, it } from 'vitest';
import { scaleUtc } from '@mui/x-charts-vendor/d3-scale';
import type { AxisValueFormatterContext } from '@mui/x-charts/models';
import { formatTimeTick, labelledTickIndexes } from './timeAxisTicks';

const originalTz = process.env.TZ;
afterAll(() => {
  process.env.TZ = originalTz;
});

const RANGES = [
  ['5 days from 12Z (reported bug)', '2026-10-05T12:00:00Z', '2026-10-10T09:00:00Z'],
  ['24 h from 08Z', '2026-10-05T08:00:00Z', '2026-10-06T07:00:00Z'],
  ['6 h of 5-minute data', '2026-10-05T07:50:00Z', '2026-10-05T13:50:00Z'],
  ['30 days daily', '2026-09-05T00:00:00Z', '2026-10-05T00:00:00Z'],
  ['week across DST end', '2026-10-22T00:00:00Z', '2026-10-29T00:00:00Z'],
] as const;
const WIDTHS = [280, 400, 600, 900, 1300];
const TIME_ZONES = ['Europe/Helsinki', 'UTC', 'America/New_York', 'Asia/Kolkata'];

// The axis MUI would draw: d3 time ticks with MUI's default tick count for the width
function axis(from: string, to: string, width: number) {
  const scale = scaleUtc().domain([new Date(from), new Date(to)]).range([0, width]);
  const tickNumber = Math.floor(width / 50);
  const ticks = scale.ticks(tickNumber);
  const context = { location: 'tick', scale, tickNumber, defaultTickLabel: '' } as unknown as AxisValueFormatterContext<'utc'>;
  return { scale, ticks, labels: ticks.map(tick => formatTimeTick(tick, context)) };
}

// MUI's getVisibleLabels: greedily hide labels overlapping the previous shown one (4px min gap)
function visibleUnderMui(labels: string[], offsets: number[]): number[] {
  const width = (label: string) => Math.max(...label.split('\n').map(line => line.length * 6.8));
  let previousLimit = -Infinity;
  return labels.flatMap((label, i) => {
    if (label === '') return [];
    const halfWidth = width(label) / 2;
    if (offsets[i] - halfWidth < previousLimit + 4) return [];
    previousLimit = offsets[i] + halfWidth;
    return [i];
  });
}

// UTC offsets (minutes, as getTimezoneOffset reports them) on 5 Oct 2026, to prove TZ switching works
const OFFSETS: Record<string, number> = { 'Europe/Helsinki': -180, UTC: 0, 'America/New_York': 240, 'Asia/Kolkata': -330 };

describe.each(TIME_ZONES)('formatTimeTick in %s', timeZone => {
  it('runs in that time zone', () => {
    process.env.TZ = timeZone;
    expect(new Date('2026-10-05T12:00:00Z').getTimezoneOffset()).toBe(OFFSETS[timeZone]);
  });

  describe.each(RANGES)('%s', (_name, from, to) => {
    it.each(WIDTHS)('labels a %ipx axis correctly', width => {
      process.env.TZ = timeZone;
      const { scale, ticks, labels } = axis(from, to, width);
      const shown = labels.flatMap((label, i) => (label ? [i] : []));
      expect(shown.length).toBeGreaterThan(0);

      // The date line appears on exactly the first labelled tick and wherever the day changed
      shown.forEach((i, k) => {
        const previous = k > 0 ? ticks[shown[k - 1]] : undefined;
        const newDay = !previous || previous.toISOString().slice(0, 10) !== ticks[i].toISOString().slice(0, 10);
        expect(labels[i].includes('\n'), `${labels[i]} at ${ticks[i].toISOString()}`).toBe(newDay);
      });

      // MUI's own overlap check keeps every label the formatter chose, so no date gets hidden
      expect(visibleUnderMui(labels, ticks.map(tick => scale(tick)))).toEqual(shown);

      // With sub-day steps, every midnight tick is labelled
      if (ticks.length > 1 && ticks[1].getTime() - ticks[0].getTime() < 24 * 3600 * 1000) {
        ticks.forEach((tick, i) => {
          if (tick.getUTCHours() === 0 && tick.getUTCMinutes() === 0) {
            expect(labels[i], tick.toISOString()).not.toBe('');
          }
        });
      }
    });
  });
});

describe('formatTimeTick is in UTC', () => {
  it('counts from midnight in UTC when it has to skip labels, wherever the browser is', () => {
    const SIX_HOURS = 6 * 3600 * 1000;
    const start = Date.UTC(2026, 9, 5);
    const ticks = Array.from({ length: 8 }, (_, i) => new Date(start + i * SIX_HOURS));
    // Too close together to label them all
    const position = (tick: Date) => ((tick.getTime() - start) / SIX_HOURS) * 30;
    process.env.TZ = 'Asia/Kolkata';
    expect(labelledTickIndexes(ticks, position)).toEqual([0, 2, 4, 6]);
  });

  it.each(RANGES)('labels %s the same in every time zone', (_name, from, to) => {
    process.env.TZ = 'UTC';
    const inUtc = WIDTHS.map(width => axis(from, to, width).labels);
    for (const timeZone of TIME_ZONES) {
      process.env.TZ = timeZone;
      expect(WIDTHS.map(width => axis(from, to, width).labels)).toEqual(inUtc);
    }
  });
});

describe('formatTimeTick outside the axis', () => {
  it('shows the full date and time in tooltips', () => {
    const { scale } = axis('2026-10-05T00:00:00Z', '2026-10-06T00:00:00Z', 600);
    const context = { location: 'tooltip', scale } as unknown as AxisValueFormatterContext<'utc'>;
    expect(formatTimeTick(new Date('2026-10-05T12:00:00Z'), context)).toBe('Oct 5 12:00');
  });
});
