import { describe, expect, it } from 'vitest';
import {
  ALL_PANES_WIDTH,
  DEFAULT_REQUEST_WIDTH,
  DIVIDER_WIDTH,
  INITIAL_PANES,
  MIN_MAP_WIDTH,
  MIN_REQUEST_WIDTH,
  MIN_RESPONSE_WIDTH,
  clampPaneWidth,
  minBesideLeftPane,
  leftPaneOpen,
  parsePaneWidth,
  widthStep,
  phonePaneFollowingCollection,
  phonePaneToggled,
  withCollectionFollowed,
  withPaneOpen,
  withPaneToggled,
  withPanesFitted,
} from './panes';
import type { OpenPanes } from './panes';

// What's in the left place, then whether the map and the response are open
const panes = (left: 'api' | 'request' | null, map: boolean, response: boolean): OpenPanes => ({
  api: left === 'api',
  request: left === 'request',
  map,
  response,
});

describe('INITIAL_PANES', () => {
  it("starts on the API's list, beside the map", () => {
    expect(INITIAL_PANES).toEqual(panes('api', true, false));
  });
});

describe('leftPaneOpen', () => {
  it('is either of the two that take turns there', () => {
    expect(leftPaneOpen(panes('api', false, false))).toBe(true);
    expect(leftPaneOpen(panes('request', false, false))).toBe(true);
    expect(leftPaneOpen(panes(null, true, true))).toBe(false);
  });
});

describe('withPaneOpen', () => {
  it('opens a third place beside the others when all fit', () => {
    expect(withPaneOpen(panes('request', true, false), 'response', true)).toEqual(panes('request', true, true));
    expect(withPaneOpen(panes('api', true, false), 'response', true)).toEqual(panes('api', true, true));
  });

  it('lets the API and the request take turns', () => {
    expect(withPaneOpen(panes('api', true, false), 'request', true)).toEqual(panes('request', true, false));
    expect(withPaneOpen(panes('request', true, false), 'api', true)).toEqual(panes('api', true, false));
    expect(withPaneOpen(panes('request', true, true), 'api', false)).toEqual(panes('api', true, false));
  });

  it('closes the left place to make room for the response, keeping the map', () => {
    expect(withPaneOpen(panes('request', true, false), 'response', false)).toEqual(panes(null, true, true));
    expect(withPaneOpen(panes('api', true, false), 'response', false)).toEqual(panes(null, true, true));
  });

  it('closes the left place to make room for the map', () => {
    expect(withPaneOpen(panes('request', false, true), 'map', false)).toEqual(panes(null, true, true));
    expect(withPaneOpen(panes('api', false, true), 'map', false)).toEqual(panes(null, true, true));
  });

  it('closes the response to make room for the left place', () => {
    expect(withPaneOpen(panes(null, true, true), 'request', false)).toEqual(panes('request', true, false));
    expect(withPaneOpen(panes(null, true, true), 'api', false)).toEqual(panes('api', true, false));
  });

  it('closes nothing when two places fit', () => {
    expect(withPaneOpen(panes('request', false, false), 'response', false)).toEqual(panes('request', false, true));
    expect(withPaneOpen(panes('api', false, false), 'map', false)).toEqual(panes('api', true, false));
    expect(withPaneOpen(panes(null, true, false), 'request', false)).toEqual(panes('request', true, false));
    expect(withPaneOpen(panes(null, false, true), 'map', false)).toEqual(panes(null, true, true));
  });

  it('leaves an open pane alone, keeping the same object', () => {
    const open = panes('request', true, false);
    expect(withPaneOpen(open, 'request', true)).toBe(open);
  });
});

describe('withPaneToggled', () => {
  it('closes an open pane', () => {
    expect(withPaneToggled(panes('request', true, false), 'request', true, true)).toEqual(panes(null, true, false));
    expect(withPaneToggled(panes('request', true, false), 'map', true, true)).toEqual(panes('request', false, false));
    expect(withPaneToggled(panes('api', true, false), 'api', true, false)).toEqual(panes(null, true, false));
  });

  it('opens a closed pane, making room if needed', () => {
    expect(withPaneToggled(panes('request', true, false), 'response', false, true)).toEqual(panes(null, true, true));
  });

  it('goes from the request to the list, and back to the collection that is open', () => {
    expect(withPaneToggled(panes('request', true, false), 'api', true, true)).toEqual(panes('api', true, false));
    expect(withPaneToggled(panes('api', true, false), 'api', true, true)).toEqual(panes('request', true, false));
    expect(withPaneToggled(panes('api', false, false), 'api', true, true)).toEqual(panes('request', false, false));
  });

  it('goes to the request from the list, open collection or not', () => {
    expect(withPaneToggled(panes('api', true, false), 'request', true, false)).toEqual(panes('request', true, false));
    expect(withPaneToggled(panes('api', true, false), 'request', true, true)).toEqual(panes('request', true, false));
  });

  it('keeps the last pane open', () => {
    const left = panes('request', false, false);
    expect(withPaneToggled(left, 'request', true, true)).toBe(left);
    const list = panes('api', false, false);
    expect(withPaneToggled(list, 'api', true, false)).toBe(list);
    const map = panes(null, true, false);
    expect(withPaneToggled(map, 'map', true, false)).toBe(map);
    const response = panes(null, false, true);
    expect(withPaneToggled(response, 'response', true, false)).toBe(response);
  });

  it('can leave the map as the only pane, and hide it', () => {
    const map = panes(null, true, false);
    expect(withPaneToggled(panes('request', true, false), 'request', true, true)).toEqual(map);
    expect(withPaneToggled(panes('request', true, false), 'map', true, true)).toEqual(panes('request', false, false));
  });
});

describe('withPanesFitted', () => {
  it('closes the left place when the window no longer fits all three', () => {
    expect(withPanesFitted(panes('request', true, true), false)).toEqual(panes(null, true, true));
    expect(withPanesFitted(panes('api', true, true), false)).toEqual(panes(null, true, true));
  });

  it('changes nothing when they fit, or when only two are open', () => {
    const all = panes('request', true, true);
    expect(withPanesFitted(all, true)).toBe(all);
    const two = panes('request', true, false);
    expect(withPanesFitted(two, false)).toBe(two);
    const noLeft = panes(null, true, true);
    expect(withPanesFitted(noLeft, false)).toBe(noLeft);
  });
});

describe('withCollectionFollowed', () => {
  it('replaces the list with the request when a collection opens', () => {
    expect(withCollectionFollowed(panes('api', true, true), true)).toEqual(panes('request', true, true));
  });

  it('brings the list back when the collection closes', () => {
    expect(withCollectionFollowed(panes('request', true, true), false)).toEqual(panes('api', true, true));
  });

  it('leaves other arrangements alone', () => {
    for (const open of [panes(null, true, true), panes('request', true, false)]) {
      expect(withCollectionFollowed(open, true)).toBe(open);
    }
    for (const open of [panes(null, true, true), panes('api', true, false)]) {
      expect(withCollectionFollowed(open, false)).toBe(open);
    }
  });
});

describe('phonePaneFollowingCollection', () => {
  it('goes between the list and the request', () => {
    expect(phonePaneFollowingCollection('api', true)).toBe('request');
    expect(phonePaneFollowingCollection('request', false)).toBe('api');
  });

  it("doesn't pull you off the map or the response", () => {
    for (const hasCollection of [true, false]) {
      expect(phonePaneFollowingCollection('map', hasCollection)).toBe('map');
      expect(phonePaneFollowingCollection('response', hasCollection)).toBe('response');
    }
  });

  it('stays where it already follows', () => {
    expect(phonePaneFollowingCollection('request', true)).toBe('request');
    expect(phonePaneFollowingCollection('api', false)).toBe('api');
  });
});

describe('phonePaneToggled', () => {
  it('switches to another pane', () => {
    expect(phonePaneToggled('request', 'response', true)).toBe('response');
    expect(phonePaneToggled('map', 'api', false)).toBe('api');
  });

  it('goes back to the map from the request or the response', () => {
    expect(phonePaneToggled('request', 'request', true)).toBe('map');
    expect(phonePaneToggled('request', 'request', false)).toBe('map');
    expect(phonePaneToggled('response', 'response', true)).toBe('map');
  });

  it('goes from the map to the collection that is open, or else the list', () => {
    expect(phonePaneToggled('map', 'map', true)).toBe('request');
    expect(phonePaneToggled('map', 'map', false)).toBe('api');
  });

  it('goes from the list to the collection that is open, or else the map', () => {
    expect(phonePaneToggled('api', 'api', true)).toBe('request');
    expect(phonePaneToggled('api', 'api', false)).toBe('map');
  });
});

describe('the left pane', () => {
  it('would like 480 px, and can go down to 320', () => {
    expect(DEFAULT_REQUEST_WIDTH).toBe(480);
    expect(MIN_REQUEST_WIDTH).toBe(320);
  });
});

describe('clampPaneWidth', () => {
  const available = 1000;
  const clamp = (width: number, room = available) => clampPaneWidth(width, room, MIN_RESPONSE_WIDTH, MIN_MAP_WIDTH);

  it('keeps a width that fits', () => {
    expect(clamp(520)).toBe(520);
  });

  it('leaves what is beside it its minimum, past the divider', () => {
    expect(clamp(900)).toBe(1000 - DIVIDER_WIDTH - MIN_MAP_WIDTH);
    expect(clamp(1000 - DIVIDER_WIDTH - MIN_MAP_WIDTH)).toBe(634);
  });

  it('never goes below its own minimum, even with no room', () => {
    expect(clamp(100)).toBe(MIN_RESPONSE_WIDTH);
    expect(clamp(500, 500)).toBe(MIN_RESPONSE_WIDTH);
  });

  it('uses the minimums it is given', () => {
    expect(clampPaneWidth(10, 1000, 200, 100)).toBe(200);
    expect(clampPaneWidth(5000, 1000, 200, 100)).toBe(894);
  });
});

describe('minBesideLeftPane', () => {
  const panes = (map: boolean, response: boolean) => ({ api: false, request: true, map, response });

  it('leaves the map its minimum', () => {
    expect(minBesideLeftPane(panes(true, false))).toBe(MIN_MAP_WIDTH);
  });

  it('leaves the response its minimum, with the map closed', () => {
    expect(minBesideLeftPane(panes(false, true))).toBe(MIN_RESPONSE_WIDTH);
  });

  it('leaves both their minimums and the divider between them', () => {
    expect(minBesideLeftPane(panes(true, true))).toBe(MIN_MAP_WIDTH + DIVIDER_WIDTH + MIN_RESPONSE_WIDTH);
  });
});

describe('widthStep', () => {
  it('moves the divider the way of the arrow, for a pane on its left', () => {
    expect(widthStep('left', 'ArrowRight', 20)).toBe(20);
    expect(widthStep('left', 'ArrowLeft', 20)).toBe(-20);
  });

  it('moves the divider the way of the arrow, for a pane on its right', () => {
    expect(widthStep('right', 'ArrowLeft', 20)).toBe(20);
    expect(widthStep('right', 'ArrowRight', 20)).toBe(-20);
  });

  it('ignores other keys', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'Enter', 'a']) {
      expect(widthStep('left', key, 20)).toBe(0);
      expect(widthStep('right', key, 20)).toBe(0);
    }
  });
});

describe('parsePaneWidth', () => {
  it('uses a saved width', () => {
    expect(parsePaneWidth('700', 320, 520)).toBe(700);
    expect(parsePaneWidth('320', 320, 520)).toBe(320);
  });

  it.each([[null], [''], ['abc'], ['100'], ['-5'], ['Infinity']])('falls back to the default for %s', saved => {
    expect(parsePaneWidth(saved, 320, 520)).toBe(520);
  });
});

describe('ALL_PANES_WIDTH', () => {
  it('is what their minimums and the two dividers need, since only those decide what fits', () => {
    expect(ALL_PANES_WIDTH).toBe(MIN_REQUEST_WIDTH + MIN_MAP_WIDTH + MIN_RESPONSE_WIDTH + 2 * DIVIDER_WIDTH);
    expect(ALL_PANES_WIDTH).toBe(1012);
  });

  it('is above the md breakpoint, so two panes always fit beside each other there', () => {
    expect(ALL_PANES_WIDTH).toBeGreaterThan(900);
  });
});
