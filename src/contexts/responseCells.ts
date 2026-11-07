import { createContext, useContext, useLayoutEffect } from 'react';
import type { CellFigures } from '../coverage/cellFigures';
import { codesFor, colourRange, figuresInScope, scopeOf, sliceIndex, type Flip, type RangeMode, type RangeScope } from '../coverage/cellSelection';
import type { Highlight, RampKind } from '../coverage/colourScale';
import type { CellParameter, CellsReading, DrawableCells } from '../coverage/coverageCells';
import type { PlotView } from '../coverage/paintCells';

// The cells of the latest response, above the pane and the map, so that the two show the same thing: the same
// parameter, step and colours. This view never sends a request.

export interface CellsChoices {
  parameterId: string | null;
  steps: Record<string, number>;
  range: RangeMode;
  setLo: number | null;
  setHi: number | null;
  ramp: RampKind;
  scope: RangeScope | null;
  flip: Flip;
  onMap: boolean;
  opacity: number;
  zoom: PlotView | null;
  pin: number | null;
  // Lit by clicking a bar in the legend, and by pointing at one
  litPinned: Highlight | null;
  litHover: Highlight | null;
}

export const INITIAL_CHOICES: CellsChoices = {
  parameterId: null,
  steps: {},
  range: 'auto',
  setLo: null,
  setHi: null,
  ramp: 'sequential',
  scope: null,
  flip: 'none',
  onMap: true,
  opacity: 0.85,
  zoom: null,
  pin: null,
  litPinned: null,
  litHover: null,
};

// A new response keeps which parameter and step are being watched, and how it's shown. What was about the last one goes
export const afterNewResponse = (choices: CellsChoices): CellsChoices => ({
  ...choices,
  range: 'auto',
  setLo: null,
  setHi: null,
  scope: null,
  flip: 'none',
  zoom: null,
  pin: null,
  litPinned: null,
  litHover: null,
});

// What the choices come to
export interface CellsPicture {
  cells: DrawableCells;
  parameter: CellParameter;
  slice: number;
  scope: RangeScope;
  figures: CellFigures;
  lo: number | null;
  hi: number | null;
  codes: Uint16Array;
}

export function pictureOf(reading: CellsReading | null, { parameterId, steps, range, setLo, setHi, ramp, scope, flip }: CellsChoices): CellsPicture | null {
  if (!reading?.drawable) return null;
  const parameter = reading.parameters.find(candidate => candidate.id === parameterId) ?? reading.parameters[0];
  const theScope = scopeOf(reading, scope);
  const figures = figuresInScope(parameter, reading, theScope, steps);
  const [lo, hi] = colourRange(figures, range, setLo, setHi, ramp);
  const slice = sliceIndex(reading.dims, steps);
  return { cells: reading, parameter, slice, scope: theScope, figures, lo, hi, codes: codesFor(parameter, reading, slice, lo, hi, flip) };
}

export interface CellHover {
  cell: number;
  // How many cells share the pixel it was pointed at through
  under: number;
}

// Pointing changes nothing in React's tree but the readout, so that moving the pointer doesn't re-render the pane
export interface HoverStore {
  get: () => CellHover | null;
  set: (hover: CellHover | null) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createHoverStore(): HoverStore {
  let current: CellHover | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(hover) {
      if (hover?.cell === current?.cell && hover?.under === current?.under) return;
      current = hover;
      listeners.forEach(listener => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export interface ResponseCellsValue {
  reading: CellsReading | null;
  picture: CellsPicture | null;
  choices: CellsChoices;
  choose: (patch: Partial<CellsChoices>) => void;
  // What the legend has lit
  lit: Highlight | null;
  hover: HoverStore;
  // The request this response answered
  url: string;
  openInRaw: ((pointer: string) => void) | null;
  drawAnyway: () => void;
}

export interface CellsSource {
  json: unknown;
  url: string;
  openInRaw: ((pointer: string) => void) | null;
}

export const NO_SOURCE: CellsSource = { json: null, url: '', openInRaw: null };

export const ResponseCellsContext = createContext<ResponseCellsValue>({
  reading: null,
  picture: null,
  choices: INITIAL_CHOICES,
  choose: () => {},
  lit: null,
  hover: createHoverStore(),
  url: '',
  openInRaw: null,
  drawAnyway: () => {},
});
export const PublishContext = createContext<(source: CellsSource) => void>(() => {});

export function useResponseCells() {
  return useContext(ResponseCellsContext);
}

// For the pane that shows the response to the request: what it holds is what the map draws. Null clears it, the moment
// a new request is sent, so the map never shows old data under a new request
export function usePublishResponseCells(json: unknown, url: string, openInRaw: (pointer: string) => void) {
  const publish = useContext(PublishContext);
  useLayoutEffect(() => {
    publish({ json, url, openInRaw });
  }, [publish, json, url, openInRaw]);
}
