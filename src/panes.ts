export type Pane = 'api' | 'request' | 'map' | 'response';
export type OpenPanes = Record<Pane, boolean>;

export const MIN_REQUEST_WIDTH = 320;
export const DEFAULT_REQUEST_WIDTH = 480;
// Room the browser leaves at the top of the request pane when it scrolls a field into view, so that it's not left under the
// row pinned there: that row at its tallest, on a phone, and a little more
export const PINNED_ROW_ROOM = 56;
export const MIN_MAP_WIDTH = 360;
export const MIN_RESPONSE_WIDTH = 320;
export const DEFAULT_RESPONSE_WIDTH = 520;
export const DIVIDER_WIDTH = 6;
// Widths are preferences, and only the minimums decide what fits. Below this the three don't fit side by side. Any two
// do, down to the md breakpoint, where phones' one at a time begins
export const ALL_PANES_WIDTH = MIN_REQUEST_WIDTH + DIVIDER_WIDTH + MIN_MAP_WIDTH + DIVIDER_WIDTH + MIN_RESPONSE_WIDTH;

export const INITIAL_PANES: OpenPanes = { api: true, request: false, map: true, response: false };

// The API's list and a collection's request take turns in one place, on the left
export const leftPaneOpen = (open: OpenPanes) => open.api || open.request;
const isLeftPane = (pane: Pane) => pane === 'api' || pane === 'request';

// Opens a pane. When all three places wouldn't fit, the left one makes room, or Response if the left one is being opened
export function withPaneOpen(open: OpenPanes, pane: Pane, allFit: boolean): OpenPanes {
  if (open[pane]) return open;
  const next = { ...open, [pane]: true };
  if (pane === 'api') next.request = false;
  if (pane === 'request') next.api = false;
  if (allFit || !(leftPaneOpen(next) && next.map && next.response)) return next;
  return isLeftPane(pane) ? { ...next, response: false } : { ...next, api: false, request: false };
}

// Opens or closes a pane. Leaving the API's list goes back to the collection that's open, if one is. The last
// one stays open, or nothing would be left on screen
export function withPaneToggled(open: OpenPanes, pane: Pane, allFit: boolean, hasCollection: boolean): OpenPanes {
  if (!open[pane]) return withPaneOpen(open, pane, allFit);
  if (pane === 'api' && hasCollection) return withPaneOpen(open, 'request', allFit);
  const next = { ...open, [pane]: false };
  return leftPaneOpen(next) || next.map || next.response ? next : open;
}

// When the window has narrowed
export function withPanesFitted(open: OpenPanes, allFit: boolean): OpenPanes {
  return !allFit && leftPaneOpen(open) && open.map && open.response ? { ...open, api: false, request: false } : open;
}

// A collection opening replaces the API's list, and one closing brings it back. Panes elsewhere stay as they are.
export function withCollectionFollowed(open: OpenPanes, hasCollection: boolean): OpenPanes {
  if (hasCollection && open.api) return { ...open, api: false, request: true };
  if (!hasCollection && open.request) return { ...open, api: true, request: false };
  return open;
}

export function phonePaneFollowingCollection(current: Pane, hasCollection: boolean): Pane {
  if (hasCollection && current === 'api') return 'request';
  if (!hasCollection && current === 'request') return 'api';
  return current;
}

// On a phone one pane shows at a time. Toggling the one showing goes back to the map, or from the map or the API's
// list to the collection that's open. Without one, the map goes to the list.
export function phonePaneToggled(current: Pane, pane: Pane, hasCollection: boolean): Pane {
  if (current !== pane) return pane;
  if (pane === 'map') return hasCollection ? 'request' : 'api';
  return pane === 'api' && hasCollection ? 'request' : 'map';
}

// Keeps a pane at its minimum or more, and the pane beside it at that one's, given the room the two share
export function clampPaneWidth(width: number, available: number, minWidth: number, minBeside: number): number {
  return Math.max(minWidth, Math.min(width, available - DIVIDER_WIDTH - minBeside));
}

// What's left of the row beside the left pane at its narrowest. Widening the left pane takes from the map and then from
// the response, which gets the room back once the left pane narrows: without that, narrowing it gave the room to the
// response, and it couldn't be widened again
export function minBesideLeftPane(open: OpenPanes): number {
  if (open.map && open.response) return MIN_MAP_WIDTH + DIVIDER_WIDTH + MIN_RESPONSE_WIDTH;
  return open.map ? MIN_MAP_WIDTH : MIN_RESPONSE_WIDTH;
}

// What an arrow key does to the width of the pane on that side of a divider: it moves the divider that way
export function widthStep(side: 'left' | 'right', key: string, step: number): number {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return 0;
  return (key === 'ArrowRight') === (side === 'left') ? step : -step;
}

// The width remembered in the browser, if it's usable
export function parsePaneWidth(saved: string | null, minWidth: number, fallback: number): number {
  const width = Number(saved);
  return Number.isFinite(width) && width >= minWidth ? width : fallback;
}
