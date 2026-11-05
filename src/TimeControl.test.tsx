import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TimeControl from './TimeControl';
import { NO_TIME_LABEL } from './hooks/useTimeControl';
import type { Temporal } from './types/api';
import type { UseQueryUrlReturn } from './hooks/useQueryUrl';

const TIMES: Temporal = { values: ['2026-11-05T00:00:00Z', '2026-11-05T06:00:00Z', '2026-11-05T12:00:00Z'] } as Temporal;
const NON_GREGORIAN: Temporal = { interval: [['2026-11-01T00:00:00Z', '2026-11-05T00:00:00Z']], trs: 'datetime' } as Temporal;

const render = (temporal: Temporal, state: Partial<UseQueryUrlReturn> = {}) => renderToStaticMarkup(
  <TimeControl
    temporal={temporal}
    queryState={{
      selectedDatetime: '', datetimeMode: 'individual', startDatetime: '', endDatetime: '',
      setSelectedDatetime: () => {}, setDatetimeMode: () => {}, setStartDatetime: () => {}, setEndDatetime: () => {},
      ...state,
    } as UseQueryUrlReturn}
  />,
);

// MUI's stylesheet in the output names the class either way, so look at the elements' own classes
const noTrack = /class="[^"]*MuiSlider-trackFalse/;

describe('TimeControl', () => {
  it('says plainly that no time is being sent', () => {
    const html = render(TIMES);
    expect(html).toContain(NO_TIME_LABEL);
    expect(html).not.toContain('Latest');
    expect(html).not.toContain('Clear time');
    expect(html).toMatch(noTrack);
  });

  it('shows a chosen time, with a way to leave it out again', () => {
    const html = render(TIMES, { selectedDatetime: '2026-11-05T06:00:00Z' });
    expect(html).not.toContain(NO_TIME_LABEL);
    expect(html).toContain('Clear time');
    expect(html).not.toMatch(noTrack);
  });

  it('offers the same for a range', () => {
    expect(render(TIMES, { datetimeMode: 'range' })).not.toContain('Clear time');
    expect(render(TIMES, { datetimeMode: 'range', startDatetime: '2026-11-05T00:00:00Z' })).toContain('Clear time');
  });

  it('offers the same with the date picker', () => {
    expect(render(NON_GREGORIAN)).not.toContain('Clear time');
    expect(render(NON_GREGORIAN, { selectedDatetime: '2026-11-02T00:00:00Z' })).toContain('Clear time');
  });
});
