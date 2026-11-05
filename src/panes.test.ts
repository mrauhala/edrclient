import { describe, expect, it } from 'vitest';
import {
  ALL_PANES_WIDTH,
  DEFAULT_RESPONSE_WIDTH,
  INITIAL_PANES,
  MIN_RESPONSE_WIDTH,
  clampResponseWidth,
  parseResponseWidth,
  phonePaneToggled,
  withPaneOpen,
  withPaneToggled,
  withPanesFitted,
} from './panes';
import type { OpenPanes } from './panes';

const panes = (request: boolean, map: boolean, response: boolean): OpenPanes => ({ request, map, response });

describe('withPaneOpen', () => {
  it('opens a third pane beside the others when all fit', () => {
    expect(withPaneOpen(panes(true, true, false), 'response', true)).toEqual(panes(true, true, true));
  });

  it('closes Request to make room for the response, keeping the map', () => {
    expect(withPaneOpen(panes(true, true, false), 'response', false)).toEqual(panes(false, true, true));
  });

  it('closes Request to make room for the map', () => {
    expect(withPaneOpen(panes(true, false, true), 'map', false)).toEqual(panes(false, true, true));
  });

  it('closes the response to make room for Request', () => {
    expect(withPaneOpen(panes(false, true, true), 'request', false)).toEqual(panes(true, true, false));
  });

  it('closes nothing when two panes fit', () => {
    expect(withPaneOpen(panes(false, true, false), 'response', false)).toEqual(panes(false, true, true));
    expect(withPaneOpen(panes(true, false, false), 'map', false)).toEqual(panes(true, true, false));
    expect(withPaneOpen(panes(false, false, true), 'request', false)).toEqual(panes(true, false, true));
  });

  it('leaves an open pane alone, keeping the same object', () => {
    const open = panes(true, true, true);
    expect(withPaneOpen(open, 'map', false)).toBe(open);
  });
});

describe('withPaneToggled', () => {
  it('closes an open pane', () => {
    expect(withPaneToggled(panes(true, true, true), 'map', true)).toEqual(panes(true, false, true));
  });

  it('opens a closed pane, making room if needed', () => {
    expect(withPaneToggled(panes(true, true, false), 'response', false)).toEqual(panes(false, true, true));
  });

  it('keeps the last pane open', () => {
    const open = panes(false, true, false);
    expect(withPaneToggled(open, 'map', true)).toBe(open);
  });

  it('can leave the map as the only pane, and hide it', () => {
    let open = withPaneToggled(INITIAL_PANES, 'request', true);
    expect(open).toEqual(panes(false, true, false));
    open = withPaneToggled(open, 'response', true);
    open = withPaneToggled(open, 'map', true);
    expect(open).toEqual(panes(false, false, true));
  });
});

describe('withPanesFitted', () => {
  it('closes Request when the window no longer fits all three', () => {
    expect(withPanesFitted(panes(true, true, true), false)).toEqual(panes(false, true, true));
  });

  it('changes nothing when they fit, or when only two are open', () => {
    const all = panes(true, true, true);
    const two = panes(true, true, false);
    expect(withPanesFitted(all, true)).toBe(all);
    expect(withPanesFitted(two, false)).toBe(two);
  });
});

describe('phonePaneToggled', () => {
  it('switches to another pane', () => {
    expect(phonePaneToggled('request', 'response')).toBe('response');
  });

  it('goes back to the map from the list or the response', () => {
    expect(phonePaneToggled('request', 'request')).toBe('map');
    expect(phonePaneToggled('response', 'response')).toBe('map');
  });

  it('goes from the map to the list', () => {
    expect(phonePaneToggled('map', 'map')).toBe('request');
  });
});

describe('clampResponseWidth', () => {
  const available = 1000;

  it('keeps a width that fits', () => {
    expect(clampResponseWidth(520, available)).toBe(520);
  });

  it('leaves the map its minimum', () => {
    expect(clampResponseWidth(900, available)).toBe(634);
  });

  it('never goes below the minimum', () => {
    expect(clampResponseWidth(100, available)).toBe(MIN_RESPONSE_WIDTH);
    expect(clampResponseWidth(500, 500)).toBe(MIN_RESPONSE_WIDTH);
  });
});

describe('parseResponseWidth', () => {
  it('uses a saved width', () => {
    expect(parseResponseWidth('700')).toBe(700);
  });

  it.each([[null], [''], ['abc'], ['100'], ['Infinity']])('falls back to the default for %s', saved => {
    expect(parseResponseWidth(saved)).toBe(DEFAULT_RESPONSE_WIDTH);
  });
});

describe('ALL_PANES_WIDTH', () => {
  it('is above the md breakpoint, so two panes always fit beside each other there', () => {
    expect(ALL_PANES_WIDTH).toBeGreaterThan(900);
  });
});
