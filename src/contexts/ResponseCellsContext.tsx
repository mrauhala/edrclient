import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { readCells, type CellsReading } from '../coverage/coverageCells';
import {
  INITIAL_CHOICES, NO_SOURCE, PublishContext, ResponseCellsContext, afterNewResponse, createHoverStore, pictureOf,
  type CellsChoices, type CellsSource,
} from './responseCells';

export function ResponseCellsProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<CellsSource>(NO_SOURCE);
  // The response it was asked for: the next one is asked about again
  const [drawnAnyway, setDrawnAnyway] = useState<unknown>(null);
  const [choices, setChoices] = useState<CellsChoices>(INITIAL_CHOICES);
  const [hover] = useState(createHoverStore);

  const reading = useMemo(() => (source.json === null ? null : readCells(source.json, { drawAnyway: drawnAnyway === source.json })), [source.json, drawnAnyway]);

  // During rendering, so that nothing paints the new response with the last one's pin
  const [readingSeen, setReadingSeen] = useState<CellsReading | null>(null);
  if (readingSeen !== reading) {
    setReadingSeen(reading);
    setChoices(afterNewResponse);
  }
  useLayoutEffect(() => hover.set(null), [reading, hover]);

  const { parameterId, steps, range, setLo, setHi, ramp, scope, flip, litHover, litPinned } = choices;
  // Only what the picture is made from: moving the pin or the opacity leaves it as it is
  const picture = useMemo(
    () => pictureOf(reading, { ...INITIAL_CHOICES, parameterId, steps, range, setLo, setHi, ramp, scope, flip }),
    [reading, parameterId, steps, range, setLo, setHi, ramp, scope, flip],
  );

  const choose = useCallback((patch: Partial<CellsChoices>) => setChoices(current => ({ ...current, ...patch })), []);
  const drawAnyway = useCallback(() => setDrawnAnyway(source.json), [source.json]);

  const value = useMemo(() => ({
    reading,
    picture,
    choices,
    choose,
    lit: litHover ?? litPinned,
    hover,
    url: source.url,
    openInRaw: source.openInRaw,
    drawAnyway,
  }), [reading, picture, choices, choose, litHover, litPinned, hover, source.url, source.openInRaw, drawAnyway]);

  return (
    <PublishContext.Provider value={setSource}>
      <ResponseCellsContext.Provider value={value}>{children}</ResponseCellsContext.Provider>
    </PublishContext.Provider>
  );
}
