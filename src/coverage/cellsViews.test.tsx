import type { ReactElement } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_CHOICES, ResponseCellsContext, createHoverStore, pictureOf, type CellHover, type CellsChoices } from '../contexts/responseCells';
import CoverageData from '../CoverageData';
import ResponseCellsBar from '../ResponseCellsBar';
import CellReadout from './CellReadout';
import CellsFigures from './CellsFigures';
import CellsView from './CellsView';
import { summarizeCoverage } from './coverageSummary';
import { MOST_VALUES_DRAWN, readCells } from './coverageCells';
import { counting, grid, pointCollection, pointCoverage, pointLattice, triangles } from './cellsTestData';
import ParameterPicker from './ParameterPicker';
import StepBars from './StepBars';
import ValueLegend from './ValueLegend';
import fmiSeries from '../utils/__fixtures__/fmi-location-pointseries-5d.json';

const panes = vi.hoisted(() => ({ isMobile: false, isOpen: { map: true } as Record<string, boolean>, showPane: () => {} }));
vi.mock('../contexts/OpenRequestContext', () => ({ useOpenRequest: () => ({ openRequest: () => {} }) }));
vi.mock('../contexts/PanesContext', () => ({ usePanes: () => panes }));

const AREA = 'https://example.org/edr/collections/c/area?coords=POLYGON((1%202))&f=CoverageJSON';
const DAY = ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z', '2026-11-07T08:00:00Z'];

interface Situation {
  choices?: Partial<CellsChoices>;
  hovered?: CellHover;
  url?: string;
}

function within(json: unknown, element: ReactElement, { choices, hovered, url = AREA }: Situation = {}) {
  const reading = readCells(json);
  const merged = { ...INITIAL_CHOICES, ...choices };
  const hover = createHoverStore();
  if (hovered) hover.set(hovered);
  return renderToStaticMarkup(
    <ResponseCellsContext.Provider value={{
      reading, picture: pictureOf(reading, merged), choices: merged, choose: () => {}, lit: merged.litHover ?? merged.litPinned, hover, url, openInRaw: () => {}, drawAnyway: () => {},
    }}>
      {element}
    </ResponseCellsContext.Provider>,
  );
}

// Only what shows: the text between tags, without emotion's styles. Read tag by tag, rather than cut out by a pattern
const words = (html: string) => {
  let inStyle = false;
  const shown: string[] = [];
  for (const piece of html.split(/(<[^>]*>)/)) {
    if (piece.startsWith('<')) {
      if (/^<style[\s>]/.test(piece)) inStyle = true;
      else if (piece === '</style>') inStyle = false;
      shown.push(' ');
    } else if (!inStyle) {
      shown.push(piece);
    }
  }
  return shown.join('')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
};
const shownPart = (html: string) => html.slice(html.indexOf('aria-live="polite"'));
const keptRoom = (html: string) => html.slice(html.indexOf('aria-hidden="true"'), html.indexOf('aria-live="polite"'));

// Layout effects can't run on the server, and React says so each time
const realError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (!String(args[0]).includes('useLayoutEffect')) realError(...args);
  };
});
afterAll(() => {
  console.error = realError;
});

describe('CellReadout', () => {
  const json = grid({ x: [24, 25], y: [61, 60], values: [291.2635272979736, null, -1e34, 7] });
  const readout = (situation?: Situation, source: unknown = json) => within(source, <CellReadout />, situation);

  it('says what to do until a cell is pointed at', () => {
    expect(words(shownPart(readout()))).toContain('Point at a cell for its exact value and where it is in the response. Click to pin it.');
  });

  it('gives the exact value as sent, with its unit, where it is, and its path', () => {
    const shown = words(shownPart(readout({ hovered: { cell: 0, under: 1 } })));
    expect(shown).toContain('291.2635272979736 K');
    expect(shown).toContain('[y 0, x 0] x 24, y 61');
    expect(shown).toContain('/ranges/temperature/values/0');
  });

  it('says null as a word, not a number', () => {
    expect(words(shownPart(readout({ hovered: { cell: 1, under: 1 } })))).toMatch(/^.*null .*\[y 0, x 1\]/);
  });

  it('marks a value outside the range with its colour', () => {
    expect(readout({ hovered: { cell: 2, under: 1 } })).toContain('background-color:rgb(255,45,149)');
    expect(shownPart(readout({ hovered: { cell: 0, under: 1 } }))).not.toContain('background-color:rgb(255,45,149)');
  });

  it('says what isn’t a number', () => {
    const text = grid({ x: [24, 25], y: [61, 60], values: ['n/a', 1, 2, 3] });
    expect(words(shownPart(readout({ hovered: { cell: 0, under: 1 } }, text)))).toContain('"n/a" not a number');
  });

  it('says when a place isn’t in the response', () => {
    const missing = pointCollection([[24, 60], [25, 60], [26, 60], [24, 61], [25, 61]].map(([x, y]) => pointCoverage(x, y, { values: { temperature: [1] } })));
    expect(words(shownPart(readout({ hovered: { cell: 2, under: 1 } }, missing)))).toContain('No point here in the response');
  });

  it('says how many cells share the pixel', () => {
    expect(words(shownPart(readout({ hovered: { cell: 0, under: 9 } })))).toContain('one of 9 under this pixel');
    expect(words(shownPart(readout({ hovered: { cell: 0, under: 1 } })))).not.toContain('under this pixel');
  });

  it('offers the actions only on what’s pinned, since moving to them would lose a hover', () => {
    const hovering = words(shownPart(readout({ hovered: { cell: 0, under: 1 } })));
    expect(hovering).not.toContain('Pinned');
    expect(hovering).not.toContain('Unpin');
    const pinned = words(shownPart(readout({ choices: { pin: 0 } })));
    for (const word of ['Pinned', 'Unpin', 'Copy path', 'Open in Raw', 'Check with position']) expect(pinned).toContain(word);
    expect(words(shownPart(readout({ choices: { pin: 0 }, hovered: { cell: 1, under: 1 } })))).not.toContain('Unpin');
  });

  it('offers no position check for what wasn’t an area', () => {
    expect(words(shownPart(readout({ choices: { pin: 0 }, url: 'https://x/collections/c/position?coords=a' })))).not.toContain('Check with position');
  });

  it('reads a flipped picture’s value from the cell it came from, at the place drawn', () => {
    const shown = words(shownPart(readout({ choices: { pin: 0, flip: 'ns' } })));
    expect(shown).toContain('-1e+34 K');
    expect(shown).toContain('[y 1, x 0] x 24, y 61');
    expect(shown).toContain('/ranges/temperature/values/2');
  });

  it('copes with a hover left over from a bigger response', () => {
    expect(words(shownPart(readout({ hovered: { cell: 999, under: 1 } })))).toContain('Point at a cell');
  });

  describe('its height', () => {
    const big = grid({ x: [24, 25.12345678901234], y: [61, 60], t: DAY, values: counting(12) });
    const states: Situation[] = [
      {},
      { hovered: { cell: 0, under: 1 } },
      { hovered: { cell: 3, under: 12 } },
      { choices: { pin: 1 } },
      { choices: { pin: 1 }, hovered: { cell: 2, under: 1 } },
    ];

    it('keeps the same room whatever it’s showing, so that it doesn’t jump', () => {
      const rooms = states.map(situation => keptRoom(within(big, <CellReadout />, situation)));
      expect(new Set(rooms).size).toBe(1);
    });

    it('keeps room for the longest value, place and path, and the actions', () => {
      const room = words(keptRoom(within(big, <CellReadout />)));
      expect(room).toContain('-1.7976931348623157e+308 K');
      expect(room).toContain('one of 999 under this pixel');
      expect(room).toContain('Pinned');
      expect(room).toContain('[t 2, y 1, x 1] x 25.12345678901234, y 61');
      expect(room).toContain('/ranges/temperature/values/11');
      for (const word of ['Unpin', 'Copy path', 'Open in Raw', 'Check with position']) expect(room).toContain(word);
    });

    it('stacks the two in one place, with the room out of sight and out of the reading order', () => {
      const html = within(big, <CellReadout />, { hovered: { cell: 0, under: 1 } });
      expect(html.indexOf('aria-hidden="true"')).toBeLessThan(html.indexOf('aria-live="polite"'));
      const styles = html.match(/<style[^>]*>.*?<\/style>/g)?.join('') ?? '';
      // Each of the two, or the room would sit above what it's for
      expect(styles.match(/grid-area:1\/1/g)).toHaveLength(2);
      expect(styles).toContain('visibility:hidden');
    });

    it('cuts nothing off', () => {
      const styles = within(big, <CellReadout />, { hovered: { cell: 0, under: 1 } }).match(/<style[^>]*>.*?<\/style>/g)?.join('') ?? '';
      expect(styles).not.toContain('text-overflow');
      expect(styles).not.toContain('overflow:hidden');
    });
  });
});

describe('ValueLegend', () => {
  // Without the room kept for the longest it says
  const shownSay = (html: string) => html.replace(/<div[^>]*aria-hidden="true"[^>]*>Heights[^<]*<\/div>/, '');
  const field = counting(200).map(i => 290 + i * 0.01);

  it('has the ends of the range, with the unit on the last', () => {
    const shown = words(within(grid({ x: counting(200), y: [60], values: field }), <ValueLegend />));
    expect(shown).toContain('290');
    expect(shown).toContain('292 K');
    expect(shown).toContain('Heights are on a log scale. Point at a bar to find its cells');
  });

  it('gives what’s set apart its own bar, with its value, share and count', () => {
    const shown = words(within(grid({ x: counting(202), y: [60], values: [...field, -1e34, -1e34] }), <ValueLegend />));
    expect(shown).toContain('0.99% -1e+34 2');
  });

  it('labels what’s outside numbers set by the numbers', () => {
    const shown = words(within(grid({ x: counting(200), y: [60], values: field }), <ValueLegend />, { choices: { range: 'set', setLo: 290.5, setHi: 291 } }));
    expect(shown).toContain('< 290.5');
    expect(shown).toContain('> 291');
  });

  it('labels by the numbers set even where something’s also far off', () => {
    const shown = words(within(grid({ x: counting(201), y: [60], values: [...field, -1e34] }), <ValueLegend />, { choices: { range: 'set', setLo: 290.5, setHi: 291 } }));
    expect(shown).toContain('< 290.5');
    expect(shown).not.toContain('-1e+34');
  });

  it('labels around 0 by the numbers too', () => {
    const shown = words(within(grid({ x: counting(201), y: [60], values: [...field, -1e34] }), <ValueLegend />, { choices: { ramp: 'diverging' } }));
    expect(shown).not.toContain('-1e+34');
  });

  it('prints no share on a spike among a few values', () => {
    expect(words(within(grid({ x: counting(5), y: [60], values: [1, 1, 1, 2, 3] }), <ValueLegend />))).not.toContain('60%');
  });

  it('gives nulls their own bar', () => {
    const shown = words(within(grid({ x: counting(4), y: [60], values: [1, 2, 3, null] }), <ValueLegend />));
    expect(shown).toContain('25% null 1');
  });

  it('has only the null bar for all null, and no hint', () => {
    const shown = words(shownSay(within(grid({ x: counting(2), y: [60], values: [null, null] }), <ValueLegend />)));
    expect(shown).toBe('100% null 2');
  });

  it('says one value instead of a histogram', () => {
    expect(words(within(grid({ x: counting(2), y: [60], values: [5, 5] }), <ValueLegend />))).toContain('One value: 5 K');
  });

  it('prints the share on the bar most cells share, which a log scale would flatten', () => {
    const values = [...new Array(640).fill(-32), ...counting(360).map(i => -31.5 + i * 0.2)];
    expect(words(within(grid({ x: counting(1000), y: [60], values, unit: 'dBZ' }), <ValueLegend />))).toContain('64%');
  });

  it('says when only some cells are lit', () => {
    const shown = words(within(grid({ x: counting(200), y: [60], values: field }), <ValueLegend />, { choices: { litPinned: { kind: 'bin', from: 0, to: 3, bin: 0 } } }));
    expect(shown).toContain('Only those cells are lit. Click again to light them all');
  });
});

describe('StepBars', () => {
  it('has a bar per axis with more than one step, saying where it is', () => {
    const html = within(grid({ t: DAY, z: [1000, 500] }), <StepBars />, { choices: { steps: { t: 1, z: 0 } } });
    expect(words(html)).toContain('Nov 7 07:00 (2/3)');
    expect(words(html)).toContain('1000 (1/2)');
    expect(html).toContain('aria-valuetext="Nov 7 07:00"');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('aria-valuemax="2"');
  });

  it('has nothing to step through without steps', () => {
    expect(within(grid(), <StepBars />)).toBe('');
  });

  it('can’t go past either end', () => {
    const first = within(grid({ t: DAY }), <StepBars />);
    expect(first).toMatch(/aria-label="Previous t"[^>]*disabled|disabled[^>]*aria-label="Previous t"/);
    expect(first).not.toMatch(/aria-label="Next t"[^>]*disabled|disabled[^>]*aria-label="Next t"/);
    expect(within(grid({ t: DAY }), <StepBars />, { choices: { steps: { t: 2 } } })).toMatch(/aria-label="Next t"[^>]*disabled|disabled[^>]*aria-label="Next t"/);
  });

  it('keeps room for its longest caption, so that the bar keeps its width', () => {
    const styles = within(grid({ t: DAY }), <StepBars />).match(/<style[^>]*>.*?<\/style>/g)?.join('') ?? '';
    expect(styles).toContain(`min-width:${'Nov 7 06:00 (1/3)'.length}ch`);
  });
});

describe('ParameterPicker', () => {
  const two = () => {
    const json = grid({ x: [1, 2], y: [60], values: [1, 2], id: 'a' }) as { ranges: Record<string, unknown> };
    json.ranges.b = { type: 'NdArray', axisNames: ['y', 'x'], shape: [1, 2], values: [3, 4] };
    return json;
  };

  it('just names the one parameter there is', () => {
    const html = within(grid(), <ParameterPicker />);
    expect(words(html)).toBe('temperature K');
    expect(html).not.toContain('<button');
  });

  it('offers the others, and says which it’s on', () => {
    const html = within(two(), <ParameterPicker />, { choices: { parameterId: 'b' } });
    expect(words(html)).toContain('b 2 of 2');
    expect(html).toContain('aria-haspopup="listbox"');
  });
});

describe('CellsView', () => {
  const view = (json: unknown, situation?: Situation) => within(json, <CellsView />, situation);

  it('has the picture, with what’s needed to step, read and colour it', () => {
    const html = view(grid({ t: DAY }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="t"');
    for (const word of ['Auto', 'All values', 'Set', 'All steps', 'This time', 'Sequential', 'Around 0', 'As sent', 'Flipped N–S', 'Flipped E–W']) expect(words(html)).toContain(word);
  });

  it('calls the second scale This level where there are levels', () => {
    expect(words(view(grid({ z: [1000, 500] })))).toContain('This level');
  });

  it('asks nothing about scale with only one step', () => {
    expect(words(view(grid()))).not.toContain('All steps');
  });

  it('offers no range for all null or one value, and no flip for what isn’t a grid', () => {
    expect(words(view(grid({ x: [1, 2], y: [60], values: [null, null] })))).not.toContain('Sequential');
    expect(words(view(grid({ x: [1, 2], y: [60], values: [5, 5] })))).not.toContain('Sequential');
    expect(words(view(triangles([1, 2])))).not.toContain('Flipped');
    expect(words(view(grid({ x: [1], y: [60], values: [1] })))).not.toContain('Flipped');
  });

  it('says plainly when the picture is flipped', () => {
    expect(words(view(grid()))).not.toContain('Drawn flipped');
    expect(words(view(grid(), { choices: { flip: 'ns' } }))).toContain('Drawn flipped north to south, on the map too. This is not what the response says');
    expect(words(view(grid(), { choices: { flip: 'ew' } }))).toContain('Drawn flipped east to west');
  });

  it('says All null over a picture of nothing', () => {
    expect(words(view(grid({ x: [1, 2], y: [60], values: [null, null] })))).toContain('All null');
    expect(words(view(grid()))).not.toContain('All null');
  });

  it('gives this step’s figures, and all steps’ too', () => {
    const shown = words(view(grid({ x: [1, 2], y: [60], t: DAY, values: [1, 2, 3, null, 5, 6] }), { choices: { steps: { t: 1 } } }));
    expect(shown).toContain('3 K, mean 3');
    expect(shown).toContain('All 3 steps: 1 to 6 K, 1 null');
    expect(shown).toContain('2 cells, 1 null');
  });

  it('doesn’t go on about all steps when there’s only one', () => {
    expect(words(view(grid()))).not.toMatch(/All \d+ steps/);
  });

  it('gives the figures without what’s far off, since a fill value makes the plain mean useless', () => {
    const values = [...counting(200).map(i => 290 + i * 0.01), -1e34];
    const shown = words(view(grid({ x: counting(201), y: [60], values })));
    expect(shown).toContain("Without what's far off: 290 to 291.99 K, mean 290.995");
  });

  it('counts points as points, and what isn’t a number', () => {
    const points = pointCollection(counting(9).map(i => pointCoverage(20 + i, 50 + (i * 7) % 9, { values: { temperature: [i === 0 ? 'x' : i] } })));
    expect(words(view(points))).toContain('9 points, 1 null, 1 not a number');
  });

  it('lists the notes', () => {
    expect(words(view(pointLattice([1, 2], [60, 61])))).toContain('Sent as 4 Point coverages, which line up as a 2 × 2 grid');
  });

  describe('the map', () => {
    it('offers the switch with the map open', () => {
      panes.isOpen.map = true;
      expect(words(view(grid()))).toContain('On the map');
    });

    it('offers to show the map when it’s closed', () => {
      panes.isOpen.map = false;
      const shown = words(view(grid()));
      expect(shown).toContain('Show the map');
      expect(shown).not.toContain('On the map');
      panes.isOpen.map = true;
    });

    it('always has the switch on a phone, where the map is another pane', () => {
      panes.isMobile = true;
      panes.isOpen.map = false;
      expect(words(view(grid()))).toContain('On the map');
      panes.isMobile = false;
      panes.isOpen.map = true;
    });

    it('says when it can’t go there', () => {
      const projected = grid({ x: [4000000, 4001000], y: [3000000, 2999000], values: [1, 2, 3, 4], referencing: null });
      expect(words(view(projected))).toContain("Can't go on the map");
    });
  });
});

describe('CellsFigures', () => {
  const list = (json: unknown) => words(within(json, <CellsFigures onOpen={() => {}} />));

  it('lists each parameter with its figures', () => {
    expect(list(grid({ x: [1, 2], y: [60], values: [1, 3] }))).toBe('temperature 2 values, 0 null 1 to 3 K, mean 2');
  });

  it('says all null in place of figures', () => {
    expect(list(grid({ x: [1, 2], y: [60], values: [null, null] }))).toBe('temperature All null');
  });

  it('says there’s no unit', () => {
    expect(list(grid({ x: [1, 2], y: [60], values: [1, 3], unit: '' }))).toContain('(no unit)');
  });

  it('lists what couldn’t be read, and why', () => {
    const json = grid({ x: [1, 2], y: [60], values: [1, 3] }) as { ranges: Record<string, unknown> };
    json.ranges.broken = 'https://example.org/r';
    expect(list(json)).toContain('broken broken: its values are at a link, not in this response');
  });
});

describe('ResponseCellsBar', () => {
  const bar = (json: unknown, props: { shows?: boolean; outOfView?: boolean } = {}, situation?: Situation) => within(json, <ResponseCellsBar shows={props.shows ?? true} outOfView={props.outOfView ?? false} onGoToData={() => {}} />, situation);

  it('isn’t there unless the layer is', () => {
    expect(bar(grid(), { shows: false })).toBe('');
    expect(bar({})).toBe('');
  });

  it('has the key, read-only, with the range', () => {
    const shown = words(bar(grid({ x: [1, 2], y: [60], values: [1, 3] })));
    expect(shown).toContain('temperature K');
    expect(shown).toContain('1 3');
    expect(shown).toContain('Opacity');
  });

  it('has a stepper per axis, so that it works with the pane closed', () => {
    const html = bar(grid({ t: DAY }), {}, { choices: { steps: { t: 1 } } });
    expect(words(html)).toContain('Nov 7 07:00');
    expect(html).toContain('aria-label="Previous t on the map"');
    expect(html).toContain('aria-label="Next t on the map"');
  });

  it('says only the outline is drawn for all null', () => {
    expect(words(bar(grid({ x: [1, 2], y: [60], values: [null, null] })))).toContain('All null: only the outline is drawn');
  });

  it('offers to go to the data only when it’s out of view', () => {
    expect(words(bar(grid()))).not.toContain('Go to the data');
    expect(words(bar(grid(), { outOfView: true }))).toContain('Go to the data');
  });
});

describe('CoverageData, with cells', () => {
  const data = (json: unknown, view: 'cells' | 'chart' | 'table' | null = null) => within(json, <CoverageData summary={summarizeCoverage(json)!} view={view} onViewChange={() => {}} />);
  const toggle = (html: string) => [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)/g)].map(([, pressed, label]) => `${label}${pressed === 'true' ? '*' : ''}`).join(' ');

  it('opens a grid as a picture, named for what’s drawn, beside Figures and Table', () => {
    const html = data(grid());
    expect(toggle(html)).toContain('Grid* Figures Table');
    expect(html).toContain('role="img"');
  });

  it('names it Points or Cells where that’s what’s drawn', () => {
    const scattered = pointCollection(counting(9).map(i => pointCoverage(20 + i, 50 + (i * 7) % 9, { values: { temperature: [i] } })));
    expect(toggle(data(scattered))).toContain('Points* Figures Table');
    expect(toggle(data(triangles([1, 2])))).toContain('Cells* Figures Table');
  });

  it('leaves a few time series on the chart, with the picture to choose', () => {
    const t = ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z'];
    const few = pointCollection([pointCoverage(20, 50, { t, values: { temperature: [1, 2] } }), pointCoverage(21, 53, { t, values: { temperature: [3, 4] } })]);
    expect(toggle(data(few))).toContain('Points Chart* Table');
  });

  it('leaves one place as it was', () => {
    const html = data(fmiSeries);
    expect(toggle(html)).toContain('Chart* Table');
    expect(toggle(html)).not.toContain('Grid');
    expect(html).not.toContain('role="img"');
  });

  it('keeps what was chosen, if this response has it', () => {
    expect(toggle(data(grid(), 'chart'))).toContain('Grid Figures* Table');
    expect(toggle(data(grid(), 'table'))).toContain('Grid Figures Table*');
    expect(toggle(data(fmiSeries, 'cells'))).toContain('Chart* Table');
  });

  it('says where values[0] is, since north first or south first is the first thing to check', () => {
    expect(words(data(grid()))).toContain('values[0] is at the top left');
    expect(words(data(grid({ x: [3, 2, 1], y: [59, 60, 61], values: new Array(9).fill(1) })))).toContain('values[0] is at the bottom right');
  });

  it('says x and y have no CRS', () => {
    expect(words(data(grid({ referencing: null })))).toContain('x and y have no CRS');
    expect(words(data(grid()))).not.toContain('have no CRS');
  });

  it('says why it can’t draw, in numbers, and offers the figures', () => {
    const json = grid({ x: [1, 2], y: [60], values: [1, 2] }) as { ranges: { temperature: { shape: number[] } } };
    json.ranges.temperature.shape = [2, 1];
    const shown = words(data(json));
    expect(shown).toContain("Can't draw this as a grid");
    expect(shown).toContain('temperature: shape says y has 2 values, and the axis has 1');
    expect(shown).toContain('2 values, 0 null');
  });

  // 5 million values to summarise, which a busy machine or a CI runner takes longer over
  it('asks before drawing what’s above the limit', () => {
    const count = MOST_VALUES_DRAWN + 1;
    const shown = words(data(grid({ x: counting(count), y: [60], values: new Array(count).fill(null) })));
    expect(shown).toContain(`${count.toLocaleString('en-US')} values is more than this draws by itself`);
    expect(shown).toContain('Draw it anyway');
    expect(shown).not.toContain("Can't draw this as a grid");
  }, 30_000);

  it('lists a grid’s parameters with thumbnails in Figures', () => {
    expect(data(grid(), 'chart')).toContain('<canvas');
  });

  it('says nothing about drawing what’s not for drawing', () => {
    expect(words(data(fmiSeries))).not.toContain("Can't draw");
  });
});
