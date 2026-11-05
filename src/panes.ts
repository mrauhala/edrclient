export type Pane = 'request' | 'map' | 'response';
export type OpenPanes = Record<Pane, boolean>;

export const REQUEST_WIDTH = 480;
export const MIN_MAP_WIDTH = 360;
export const MIN_RESPONSE_WIDTH = 320;
export const DEFAULT_RESPONSE_WIDTH = 520;
export const DIVIDER_WIDTH = 6;
// Below this the three don't fit side by side. Any two do, down to the md breakpoint, where phones' one at a time begins
export const ALL_PANES_WIDTH = REQUEST_WIDTH + MIN_MAP_WIDTH + DIVIDER_WIDTH + MIN_RESPONSE_WIDTH;

export const INITIAL_PANES: OpenPanes = { request: true, map: true, response: false };

// Opens a pane. When all three wouldn't fit, Request makes room, or Response if Request is being opened
export function withPaneOpen(open: OpenPanes, pane: Pane, allFit: boolean): OpenPanes {
  if (open[pane]) return open;
  const next = { ...open, [pane]: true };
  if (allFit || !(next.request && next.map && next.response)) return next;
  return { ...next, [pane === 'request' ? 'response' : 'request']: false };
}

// Opens or closes a pane. The last one stays open, or nothing would be left on screen
export function withPaneToggled(open: OpenPanes, pane: Pane, allFit: boolean): OpenPanes {
  if (!open[pane]) return withPaneOpen(open, pane, allFit);
  const next = { ...open, [pane]: false };
  return next.request || next.map || next.response ? next : open;
}

// When the window has narrowed
export function withPanesFitted(open: OpenPanes, allFit: boolean): OpenPanes {
  return !allFit && open.request && open.map && open.response ? { ...open, request: false } : open;
}

// On a phone one pane shows at a time. Toggling the one showing goes back to the map, or from the map to the list
export function phonePaneToggled(current: Pane, pane: Pane): Pane {
  if (current !== pane) return pane;
  return pane === 'map' ? 'request' : 'map';
}

// Keeps the map at its minimum, given the room the map and the response share
export function clampResponseWidth(width: number, available: number): number {
  return Math.max(MIN_RESPONSE_WIDTH, Math.min(width, available - DIVIDER_WIDTH - MIN_MAP_WIDTH));
}

// The width remembered in the browser, if it's usable
export function parseResponseWidth(saved: string | null): number {
  const width = Number(saved);
  return saved && Number.isFinite(width) && width >= MIN_RESPONSE_WIDTH ? width : DEFAULT_RESPONSE_WIDTH;
}
