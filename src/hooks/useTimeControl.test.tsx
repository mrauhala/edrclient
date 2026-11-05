import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Temporal } from '../types/api';
import { NO_TIME_LABEL, useTimeControl, type UseTimeControlReturn } from './useTimeControl';
import type { UseQueryUrlReturn } from './useQueryUrl';

// The server renderer skips effects, and a default time would be set in one: collect them to run after
const effects = vi.hoisted(() => [] as (() => void)[]);
vi.mock('react', async importOriginal => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: (effect: () => void) => { effects.push(effect); },
}));

const DISCRETE: Temporal = { values: ['2026-11-05T00:00:00Z', '2026-11-05T06:00:00Z', '2026-11-05T12:00:00Z'] } as Temporal;
const CONTINUOUS: Temporal = { interval: [['2026-11-01T00:00:00Z', '2026-11-05T00:00:00Z']] } as Temporal;

const setters = { setSelectedDatetime: vi.fn(), setStartDatetime: vi.fn(), setEndDatetime: vi.fn() };

const rendered = vi.fn<(tc: UseTimeControlReturn) => void>();

function control(temporal: Temporal, state: Partial<UseQueryUrlReturn> = {}): UseTimeControlReturn {
  const Harness = () => {
    rendered(useTimeControl(temporal, {
      selectedDatetime: '', datetimeMode: 'individual', startDatetime: '', endDatetime: '', ...setters, ...state,
    } as UseQueryUrlReturn));
    return null;
  };
  renderToStaticMarkup(<Harness />);
  effects.splice(0).forEach(effect => effect());
  return rendered.mock.lastCall![0];
}

const noTimeWasSet = () => {
  expect(setters.setSelectedDatetime).not.toHaveBeenCalled();
  expect(setters.setStartDatetime).not.toHaveBeenCalled();
  expect(setters.setEndDatetime).not.toHaveBeenCalled();
};

describe('useTimeControl', () => {
  beforeEach(() => {
    effects.length = 0;
    Object.values(setters).forEach(setter => setter.mockClear());
  });

  it.each([['a list of times', DISCRETE], ['an interval', CONTINUOUS]])('sets no time of its own for %s', (_name, temporal) => {
    const tc = control(temporal);
    noTimeWasSet();
    expect(tc.hasTime).toBe(false);
    expect(tc.currentTimeLabel).toBe(NO_TIME_LABEL);
  });

  it('sets none in range mode either', () => {
    const tc = control(CONTINUOUS, { datetimeMode: 'range' });
    noTimeWasSet();
    expect(tc.hasTime).toBe(false);
    expect(tc.currentTimeLabel).toBe(NO_TIME_LABEL);
  });

  it('leaves a chosen time as it is', () => {
    const tc = control(DISCRETE, { selectedDatetime: '2026-11-05T06:00:00Z' });
    noTimeWasSet();
    expect(tc.hasTime).toBe(true);
    expect(tc.currentTimeLabel).toContain('06:00');
  });

  it('counts half a range as chosen, and says which half is missing', () => {
    const tc = control(CONTINUOUS, { datetimeMode: 'range', startDatetime: '2026-11-02T00:00:00Z' });
    expect(tc.hasTime).toBe(true);
    expect(tc.currentTimeLabel).toMatch(/– End$/);
    expect(control(CONTINUOUS, { datetimeMode: 'range', endDatetime: '2026-11-02T00:00:00Z' }).hasTime).toBe(true);
  });

  it("doesn't count a time from the other mode", () => {
    expect(control(DISCRETE, { datetimeMode: 'range', selectedDatetime: '2026-11-05T06:00:00Z' }).hasTime).toBe(false);
    expect(control(CONTINUOUS, { startDatetime: '2026-11-02T00:00:00Z' }).hasTime).toBe(false);
  });

  it('takes a time once the slider is moved', () => {
    control(DISCRETE).onSliderChangeCommitted(Date.parse('2026-11-05T06:00:00Z'));
    expect(setters.setSelectedDatetime).toHaveBeenCalledWith('2026-11-05T06:00:00Z');
  });

  it('takes the latest time when asked for it', () => {
    control(DISCRETE).jumpToEnd();
    expect(setters.setSelectedDatetime).toHaveBeenCalledWith('2026-11-05T12:00:00Z');
  });

  it('clears a single time and a range', () => {
    control(DISCRETE, { selectedDatetime: '2026-11-05T06:00:00Z' }).clearTime();
    expect(setters.setSelectedDatetime).toHaveBeenCalledWith('');
    expect(setters.setStartDatetime).toHaveBeenCalledWith('');
    expect(setters.setEndDatetime).toHaveBeenCalledWith('');
  });
});
