import { describe, expect, it } from 'vitest';
import {
  askedLevels, declaredFits, declaredInterval, declaredLevels, defaultScale, expectedLevels, isEvenlySpaced, readVerticalAxis, readVrs, textOf, vrsAbout, withUnit,
} from './verticalAxis';

// A coverage whose z has this reference system
const withSystem = (system: unknown) => ({ domain: { axes: { z: { values: [1, 2] } }, referencing: [{ coordinates: ['z'], system }] } });
const axisOf = (system: unknown) => readVerticalAxis({}, withSystem(system));
const described = (en: string) => axisOf({ type: 'VerticalCRS', description: { en } });
const csAxis = (axis: Record<string, unknown>) => axisOf({ type: 'VerticalCRS', cs: { csAxes: [axis] } });

describe('readVerticalAxis', () => {
  it('reads name, unit and direction from the response’s csAxes', () => {
    expect(csAxis({ name: { en: 'Pressure' }, direction: 'down', unit: { symbol: 'hPa' } })).toEqual({
      kind: 'pressure', name: 'Pressure', unit: 'hPa', unitSource: 'response', direction: 'down', directionSource: 'response', usualWords: 'pressure', againstUsual: false, flatCrs: null,
    });
  });

  it('finds z’s system on the collection when the coverage has none', () => {
    const json = { referencing: [{ coordinates: ['z'], system: { type: 'VerticalCRS', cs: { csAxes: [{ name: { en: 'Depth' }, direction: 'down', unit: { symbol: 'm' } }] } } }] };
    expect(readVerticalAxis(json, { domain: { axes: {} } })).toMatchObject({ kind: 'depth', unit: 'm', directionSource: 'response' });
    expect(readVerticalAxis({ domain: json }, { domain: { axes: {} } })).toMatchObject({ kind: 'depth' });
  });

  it('takes a unit from a sentence only as a final “in hPa”', () => {
    expect(described('Pressure level in hPa').unit).toBe('hPa');
    expect(described('Pressure level in hPa.').unit).toBe('hPa');
    expect(described('Height 2 m above something')).toMatchObject({ unit: '', unitSource: 'none' });
  });

  it('writes a unit the usual way, and keeps one it doesn’t know as sent', () => {
    expect(csAxis({ unit: { symbol: 'hectopascal' } }).unit).toBe('hPa');
    expect(csAxis({ unit: { symbol: 'Degrees' } }).unit).toBe('°');
    expect(csAxis({ unit: { symbol: { value: 'm', type: 'http://www.opengis.net/def/uom/UCUM/' } } }).unit).toBe('m');
    expect(csAxis({ unit: { label: { en: 'metre' } } }).unit).toBe('m');
    expect(csAxis({ unit: { symbol: 'constructor' } }).unit).toBe('constructor');
    expect(csAxis({ unit: { symbol: '1' } })).toMatchObject({ unit: '', unitSource: 'response' });
  });

  it('tells model levels before pressure, since FMI’s hybrid datum has “pressure” in its name', () => {
    expect(described('Hybrid sigma-pressure model levels')).toMatchObject({ kind: 'modelLevel', name: 'Model level', direction: 'down', directionSource: 'usual' });
    expect(described('Hybrid model level number').kind).toBe('modelLevel');
  });

  it('knows each kind, and its usual direction when none is stated', () => {
    expect(described('Elevation angle in deg')).toMatchObject({ kind: 'angle', unit: '°', direction: 'up', usualWords: 'an elevation angle' });
    expect(described('Isobaric surface')).toMatchObject({ kind: 'pressure', direction: 'down' });
    expect(described('Depth below sea surface in m')).toMatchObject({ kind: 'depth', direction: 'down', unit: 'm' });
    expect(described('Altitude in ft')).toMatchObject({ kind: 'height', direction: 'up', unit: 'ft' });
  });

  it('knows each kind by any of its words, whatever their case', () => {
    expect(described('Hybrid sigma-pressure').kind).toBe('modelLevel');
    expect(described('Level number').kind).toBe('modelLevel');
    expect(described('Terrain-following sigma').kind).toBe('modelLevel');
    expect(csAxis({ name: { en: 'Elevation angle' }, direction: 'up' })).toMatchObject({ kind: 'angle', direction: 'up', usualWords: 'an elevation angle' });
    expect(described('Antenna tilt').kind).toBe('angle');
    expect(described('Altitude').kind).toBe('height');
    expect(described('PRESSURE').kind).toBe('pressure');
  });

  it('knows a kind by a unit in the reference system’s axis, though nothing else names it', () => {
    expect(csAxis({ unit: { symbol: 'hPa' } })).toMatchObject({ kind: 'pressure', name: 'Pressure', unit: 'hPa', unitSource: 'response', direction: 'down' });
  });

  it('takes a unit from a sentence only at its end, and says it was a sentence', () => {
    expect(described('Pressure in hPa of the model')).toMatchObject({ unit: '', unitSource: 'none' });
    expect(described('Pressure level in hPa')).toMatchObject({ unit: 'hPa', unitSource: 'description' });
    expect(axisOf({ type: 'VerticalCRS', description: { en: 'Pressure level in hPa' }, cs: { csAxes: [{ unit: { symbol: 'Pa' } }] } })).toMatchObject({ unit: 'Pa', unitSource: 'response' });
  });

  it('knows an angle or a height by its unit alone', () => {
    expect(csAxis({ unit: { symbol: 'deg' } })).toMatchObject({ kind: 'angle', name: 'Elevation angle', direction: 'up', directionSource: 'usual' });
    expect(csAxis({ unit: { symbol: 'km' } })).toMatchObject({ kind: 'height', name: 'Height', direction: 'up', usualWords: 'height' });
  });

  it('assumes up for what nothing names, and says nothing is known', () => {
    expect(readVerticalAxis({}, { domain: { axes: {} } })).toEqual({
      kind: 'unknown', name: 'z', unit: '', unitSource: 'none', direction: 'up', directionSource: 'none', usualWords: null, againstUsual: false, flatCrs: null,
    });
  });

  it('obeys a stated direction against the usual, and marks it', () => {
    expect(csAxis({ name: { en: 'Pressure' }, direction: 'up' })).toMatchObject({ direction: 'up', directionSource: 'response', againstUsual: true });
    expect(csAxis({ name: { en: 'Pressure' }, direction: 'sideways' })).toMatchObject({ direction: 'down', directionSource: 'usual', againstUsual: false });
    expect(csAxis({ direction: 'down' })).toMatchObject({ kind: 'unknown', direction: 'down', directionSource: 'response', againstUsual: false });
  });

  it('names a CRS with no vertical axis that z is referenced to, as KNMI references z to CRS84', () => {
    expect(axisOf({ type: 'GeographicCRS', id: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' })).toMatchObject({ kind: 'unknown', flatCrs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' });
    expect(axisOf({ type: 'GeographicCRS', id: 'http://www.opengis.net/def/crs/EPSG/0/4326' }).flatCrs).toBe('http://www.opengis.net/def/crs/EPSG/0/4326');
    expect(axisOf({ type: 'GeographicCRS', id: 'http://www.opengis.net/def/crs/OGC/0/CRS84h' }).flatCrs).toBeNull();
    expect(axisOf({ type: 'GeographicCRS', id: 'http://www.opengis.net/def/crs/EPSG/0/4979' }).flatCrs).toBeNull();
    expect(axisOf({ type: 'VerticalCRS' }).flatCrs).toBeNull();
  });

  it('reads Pa only as a word, and only as it’s written', () => {
    expect(described('Spatial reference').kind).toBe('unknown');
    expect(described('Level in Pa').kind).toBe('pressure');
    expect(described('Station code pa').kind).toBe('unknown');
  });
});

describe('defaultScale', () => {
  it('is log for pressure, unless a level at or below 0 rules it out', () => {
    expect(defaultScale('pressure', [10, 500, 1000])).toEqual({ scale: 'log', canLog: true });
    expect(defaultScale('pressure', [0, 10, 100])).toEqual({ scale: 'linear', canLog: false });
    expect(defaultScale('height', [-5, 10, 100])).toEqual({ scale: 'linear', canLog: false });
    expect(defaultScale('height', [])).toEqual({ scale: 'linear', canLog: false });
  });

  it('is linear for model levels, for evenly spaced levels and for two', () => {
    expect(defaultScale('modelLevel', [1, 2, 3, 30, 65]).scale).toBe('linear');
    expect(defaultScale('height', Array.from({ length: 100 }, (_, i) => (i + 1) * 250)).scale).toBe('linear');
    expect(defaultScale('height', [1, 1000]).scale).toBe('linear');
  });

  it('is log where a linear axis would run two levels together, by 1/60 of the span', () => {
    expect(defaultScale('angle', [0.3, 0.8, 1.2, 2, 2.8, 4.5, 6, 8, 10, 12, 15, 20, 25, 90]).scale).toBe('log');
    expect(defaultScale('height', [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]).scale).toBe('log');
    // A gap of exactly 1/60 is enough to tell two apart
    expect(defaultScale('height', [0.6, 1.6, 30, 60.6]).scale).toBe('linear');
    expect(defaultScale('height', [0.6, 1.5, 30, 60.6]).scale).toBe('log');
  });
});

describe('isEvenlySpaced', () => {
  it('allows for rounding, in any order', () => {
    expect(isEvenlySpaced([0.3, 0.1, 0.2])).toBe(true);
    expect(isEvenlySpaced([1, 2, 4])).toBe(false);
  });
});

describe('askedLevels', () => {
  it('reads a list, a range either way round, and anything else', () => {
    expect(askedLevels('https://x/position?coords=POINT(1 2)&z=1000,850,500')).toEqual({ kind: 'list', values: [1000, 850, 500] });
    expect(askedLevels('x?z=1000/500')).toEqual({ kind: 'range', lo: 500, hi: 1000 });
    expect(askedLevels('x?z=-10/-200')).toEqual({ kind: 'range', lo: -200, hi: -10 });
    expect(askedLevels('x?z=R5/100/50')).toEqual({ kind: 'other' });
    expect(askedLevels('x?z=1000,,500')).toEqual({ kind: 'other' });
    expect(askedLevels('x?z=1.2.3/5')).toEqual({ kind: 'other' });
  });

  it('decodes the query, and doesn’t trip on a bad escape', () => {
    expect(askedLevels('x?a=1&z=1000%2C850#top')).toEqual({ kind: 'list', values: [1000, 850] });
    expect(askedLevels('x?z=10%2F20')).toEqual({ kind: 'range', lo: 10, hi: 20 });
    expect(askedLevels('x?z=%E0%A4%A')).toEqual({ kind: 'other' });
  });

  it('finds nothing asked without z, or with only something like it', () => {
    expect(askedLevels(undefined)).toBeNull();
    expect(askedLevels('x?coords=POINT(1 2)')).toBeNull();
    expect(askedLevels('x?zone=5')).toBeNull();
    expect(askedLevels('x?quiz=5')).toBeNull();
  });
});

describe('levels that should be there', () => {
  const declared = [1000, 925, 850, 700, 500];

  it('reads what a collection’s vrs says of its axis', () => {
    expect(readVrs('VERTCRS["P",VDATUM["A"],CS[vertical,1],AXIS["Pressure (hPa)",down],UNIT["hPa",100]]')).toEqual({ direction: 'down', unit: 'hPa' });
    expect(readVrs('VERTCRS["H",VDATUM["A"],CS[vertical,1],AXIS["gravity-related height",up],LENGTHUNIT["metre",1]]')).toEqual({ direction: 'up', unit: 'm' });
    expect(readVrs('PARAMETRICCRS["L",PDATUM["Hybrid"],CS[parametric,1],AXIS["model level number (n)",down]]')).toEqual({ direction: 'down', unit: '' });
    expect(readVrs('VERTCRS["P",AXIS["Pressure",sideways]]')).toEqual({ direction: undefined, unit: undefined });
    expect(readVrs('')).toBeNull();
    expect(readVrs(undefined)).toBeNull();
  });

  it('checks against the vrs only where the levels sent are its own', () => {
    const vrs = 'VERTCRS["P",CS[vertical,1],AXIS["Pressure (hPa)",down]]';
    expect(vrsAbout({ vrs, values: ['1000', '850'] }, [1000, 850])).toEqual({ direction: 'down', unit: 'hPa' });
    expect(vrsAbout({ vrs, values: ['1000', '850'] }, [1000, 4.8])).toBeNull();
    expect(vrsAbout({ vrs, interval: [['50', '1000']] }, [500, 1000])).not.toBeNull();
    expect(vrsAbout({ vrs, interval: [['50', '1000']] }, [5, 1000])).toBeNull();
    expect(vrsAbout({ vrs }, [500])).toBeNull();
    expect(vrsAbout({ values: ['500'] }, [500])).toBeNull();
    expect(vrsAbout({ vrs, values: ['500'] }, [])).toBeNull();
  });

  it('takes the declared levels as numbers, and the interval lowest first', () => {
    expect(declaredLevels({ values: ['1000', 925, 'all', '850'] })).toEqual([1000, 925, 850]);
    expect(declaredLevels(undefined)).toEqual([]);
    expect(declaredInterval({ interval: [['1000', '10']] })).toEqual([10, 1000]);
    expect(declaredInterval({ interval: [[null, '10']] })).toBeNull();
    expect(declaredInterval({ interval: [] })).toBeNull();
    expect(declaredInterval(undefined)).toBeNull();
  });

  it('counts asked levels only if at least one came back', () => {
    expect(expectedLevels({ kind: 'list', values: [1000, 777] }, declared, [1000])).toEqual([1000, 777]);
    expect(expectedLevels({ kind: 'list', values: [0.5, 1.5] }, declared, [0, 217])).toEqual([]);
  });

  it('counts the declared levels inside a range, or all of them with nothing asked, if they fit what came back', () => {
    expect(expectedLevels({ kind: 'range', lo: 800, hi: 1000 }, declared, [1000, 850])).toEqual([1000, 925, 850]);
    expect(expectedLevels({ kind: 'range', lo: 850, hi: 925 }, declared, [925, 850])).toEqual([925, 850]);
    expect(expectedLevels(null, declared, [1000, 850])).toEqual(declared);
    expect(expectedLevels(null, declared, [0, 217, 434])).toEqual([]);
    expect(expectedLevels({ kind: 'other' }, declared, [1000, 850])).toEqual([]);
  });

  it('takes declared levels as fitting when at least half of what came back is among them', () => {
    expect(declaredFits(declared, [1000, 4.8])).toBe(true);
    expect(declaredFits(declared, [1000, 4.8, 8.4])).toBe(false);
    expect(declaredFits([], [1000])).toBe(false);
    expect(declaredFits([1000], [])).toBe(true);
  });
});

describe('words', () => {
  it('writes a unit after a value, with nothing before a degree sign', () => {
    expect(withUnit(500, 'hPa')).toBe('500 hPa');
    expect(withUnit(0.5, '°')).toBe('0.5°');
    expect(withUnit(3, '')).toBe('3');
  });

  it('reads text, or an i18n object’s English or first language', () => {
    expect(textOf('a')).toBe('a');
    expect(textOf({ fi: 'paine', en: 'pressure' })).toBe('pressure');
    expect(textOf({ fi: 'paine' })).toBe('paine');
    expect(textOf({ fi: 3 })).toBeUndefined();
    expect(textOf(null)).toBeUndefined();
  });
});
