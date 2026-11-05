import { describe, expect, it } from 'vitest';
import { checksCount, responseTabs, shownTab } from './responseTabs';

const tabs = (hasDataView: boolean, hasImage = false) => responseTabs({ hasResponse: true, hasDataView, hasImage });

describe('responseTabs', () => {
  it('offers Data when there is a view of the data', () => {
    expect(tabs(true)).toEqual(['data', 'raw', 'headers', 'sizes', 'checks']);
  });

  it('leaves it out rather than show an empty tab', () => {
    expect(tabs(false)).toEqual(['raw', 'headers', 'sizes', 'checks']);
  });

  it('has no Raw for an image, which has no text', () => {
    expect(tabs(true, true)).toEqual(['data', 'headers', 'sizes', 'checks']);
  });

  it('has none without a response', () => {
    expect(responseTabs({ hasResponse: false, hasDataView: true, hasImage: false })).toEqual([]);
  });
});

describe('shownTab', () => {
  it('opens on Data if there is one, otherwise Raw', () => {
    expect(shownTab(null, tabs(true))).toBe('data');
    expect(shownTab(null, tabs(false))).toBe('raw');
  });

  it('stays on the tab asked for', () => {
    expect(shownTab('headers', tabs(true))).toBe('headers');
    expect(shownTab('raw', tabs(true))).toBe('raw');
  });

  it('falls back when this response lacks it, and goes back when one has it', () => {
    expect(shownTab('data', tabs(false))).toBe('raw');
    expect(shownTab('data', tabs(true))).toBe('data');
    expect(shownTab('raw', tabs(true, true))).toBe('data');
  });

  it('shows the text when there are no tabs', () => {
    expect(shownTab('headers', [])).toBe('raw');
    expect(shownTab(null, [])).toBe('raw');
  });
});

describe('checksCount', () => {
  it('has nothing to say with no findings', () => {
    expect(checksCount([])).toBeNull();
  });

  it('names and counts each kind', () => {
    expect(checksCount([{ severity: 'info' }, { severity: 'info' }])).toEqual({ label: '2 notes', color: 'info' });
    expect(checksCount([{ severity: 'warning' }])).toEqual({ label: '1 issue', color: 'warning' });
    expect(checksCount([{ severity: 'error' }, { severity: 'error' }])).toEqual({ label: '2 errors', color: 'error' });
  });

  it('counts a finding without a severity as an error', () => {
    expect(checksCount([{}])).toEqual({ label: '1 error', color: 'error' });
  });

  it('counts only the worst kind, so a note is not called an error', () => {
    expect(checksCount([{ severity: 'info' }, { severity: 'error' }, { severity: 'warning' }])).toEqual({ label: '1 error', color: 'error' });
    expect(checksCount([{ severity: 'info' }, { severity: 'warning' }])).toEqual({ label: '1 issue', color: 'warning' });
  });
});
