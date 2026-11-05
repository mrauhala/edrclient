import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTheme } from '@mui/material/styles';
import CoverageData, { cursorText, lineColours, timeFraction } from './CoverageData';
import { summarizeCoverage } from './coverage/coverageSummary';
import fmiPosition from './utils/__fixtures__/fmi-position-pointseries.json';
import fmiSeries from './utils/__fixtures__/fmi-location-pointseries-5d.json';
import dmiPosition from './utils/__fixtures__/dmi-position-grid.json';
import dwdArea from './utils/__fixtures__/dwd-area-multipolygonseries.json';
import hidrografico from './utils/__fixtures__/hidrografico-collection-parameters.json';

const render = (json: unknown, props: Partial<ComponentProps<typeof CoverageData>> = {}) => renderToStaticMarkup(
  <CoverageData summary={summarizeCoverage(json)!} view="chart" onViewChange={() => {}} {...props} />,
);

const times = (count: number) => Array.from({ length: count }, (_, i) => new Date(Date.UTC(2026, 10, 5, i)).toISOString());
const range = (values: unknown[]) => ({ type: 'NdArray', values });
const places = (count: number) => ({
  type: 'CoverageCollection',
  coverages: Array.from({ length: count }, (_, c) => ({
    type: 'Coverage',
    domain: { domainType: 'PointSeries', axes: { x: { values: [c] }, y: { values: [c + 50] }, t: { values: times(3) } } },
    ranges: { a: range([1, 2, 3]) },
  })),
});

describe('CoverageData', () => {
  describe('a time series', () => {
    const html = render(fmiSeries);

    it('says what it holds', () => {
      expect(html).toContain('PointSeries');
      expect(html).toContain(': 1 point, 40 times, 1 parameter. 3-hourly, Oct 5 12:00 to Oct 10 09:00.');
    });

    it("gives a parameter's name, range, mean and count", () => {
      expect(html).toContain('>humidity<');
      expect(html).toContain('40.7315 to 94.4284');
      expect(html).toContain('mean 69.6944');
      expect(html).toContain('40 values, 0 null');
    });

    it('has a chart of it, and the shared axis', () => {
      expect(html).toContain('<svg');
      expect(html).toContain('>UTC<');
    });

    it('offers Chart and Table, with Chart chosen', () => {
      expect(html).toMatch(/aria-pressed="true"[^>]*>Chart/);
      expect(html).toMatch(/aria-pressed="false"[^>]*>Table/);
    });

    it('has no legend for one line', () => {
      expect(html).not.toContain('14.4208, 50.088');
    });
  });

  it("names a series by what's readable, and never a link (DMI)", () => {
    const html = render(dmiPosition);
    expect(html).toContain('2 metre dewpoint temperature');
    expect(html).not.toContain('codes.ecmwf.int');
  });

  it('takes the parameters from the collection (Instituto Hidrográfico)', () => {
    expect(render(hidrografico)).toContain('Water surface height above reference datum');
  });

  it('shows the table when asked', () => {
    // The grid itself only draws in a browser
    const html = render(fmiSeries, { view: 'table' });
    expect(html).toMatch(/aria-pressed="true"[^>]*>Table/);
    expect(html).not.toContain('>UTC<');
  });

  describe('several locations', () => {
    it('has a legend of them', () => {
      const html = render(places(3));
      expect(html).toContain('>0, 50<');
      expect(html).toContain('>2, 52<');
      expect(html).toContain('3 points, 3 times');
      expect(html).not.toContain('in the Table');
    });

    it('sends those beyond what can be told apart to the table', () => {
      const html = render(places(10));
      expect(html).toContain('>7, 57<');
      expect(html).not.toContain('>8, 58<');
      expect(html).toContain('and 2 more in the Table');
    });

    it('needs no legend in the table, which has a column', () => {
      expect(render(places(3), { view: 'table' })).not.toContain('>0, 50<');
    });
  });

  describe('what cannot be drawn', () => {
    it('says so of all nulls', () => {
      const html = render({ type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [1] }, t: { values: times(2) } } }, ranges: { a: range([null, null]) } });
      expect(html).toContain('All null');
      expect(html).toContain('2 values, 2 null');
    });

    it('says so of text', () => {
      const html = render({ type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [1] }, t: { values: times(2) } } }, ranges: { a: range(['rain', 'snow']) } });
      expect(html).toContain('Not numbers');
      expect(html).toContain('2 values, 0 null, 2 not a number');
    });
  });

  describe('a single time', () => {
    const html = render(fmiPosition);

    it('gives the values, with nothing to choose between', () => {
      expect(html).toContain('At Oct 5 07:00.');
      expect(html).toContain('>temperature<');
      expect(html).toContain('12.0776');
      expect(html).not.toContain('Table');
      expect(html).not.toContain('<svg');
    });

    it('offers a table when it has several places to compare', () => {
      const one = places(2);
      one.coverages.forEach(coverage => {
        coverage.domain.axes.t.values = times(1);
        coverage.ranges.a = range([1]);
      });
      const result = render(one);
      expect(result).toContain('Figures');
      expect(result).toContain('Table');
      expect(result).not.toContain('<svg');
    });
  });

  describe('not a time series', () => {
    const html = render(dwdArea);

    it('gives figures, with no chart or table', () => {
      expect(html).toContain('MultiPolygonSeries');
      expect(html).toContain('31 positions, 3 times, 1 parameter');
      expect(html).toContain('282.698 to 290.523 kelvin, mean 287.167');
      expect(html).toContain('93 values, 0 null');
      expect(html).not.toContain('<svg');
      expect(html).not.toContain('Table');
    });

    it('ignores a wish for the table', () => {
      expect(render(dwdArea, { view: 'table' })).toContain('282.698 to 290.523 kelvin');
    });

    it('says where a grid is', () => {
      const grid = render({ type: 'Coverage', domain: { domainType: 'Grid', axes: { x: { values: [1, 2] }, y: { values: [3, 4] } } }, ranges: { a: range([1, 2, 3, 4]) } });
      expect(grid).toContain('x 1 to 2');
      expect(grid).toContain('y 3 to 4');
    });
  });
});

describe('timeFraction', () => {
  it('finds a time across the axis', () => {
    expect(timeFraction([10, 20, 30], 10)).toBe(0);
    expect(timeFraction([10, 20, 30], 20)).toBe(0.5);
    expect(timeFraction([10, 20, 30], 30)).toBe(1);
  });

  it('copes with one time', () => {
    expect(timeFraction([10], 10)).toBe(0);
  });
});

describe('cursorText', () => {
  it('says what a value is', () => {
    expect(cursorText(268.7255147799975, 'K')).toBe('268.726 K');
    expect(cursorText(0, 'K')).toBe('0 K');
    expect(cursorText(1.5, '')).toBe('1.5');
  });

  it('says null for a gap', () => {
    expect(cursorText(null, 'K')).toBe('null');
  });
});

describe('lineColours', () => {
  it("uses the theme's own for one line", () => {
    const theme = createTheme({ palette: { mode: 'dark' } });
    expect(lineColours(1, theme)).toEqual([theme.palette.primary.main]);
  });

  it('has enough for each line, chosen for the theme', () => {
    const light = lineColours(8, createTheme({ palette: { mode: 'light' } }));
    const dark = lineColours(8, createTheme({ palette: { mode: 'dark' } }));
    expect(new Set(light).size).toBe(8);
    expect(new Set(dark).size).toBe(8);
    expect(dark).not.toEqual(light);
  });
});
