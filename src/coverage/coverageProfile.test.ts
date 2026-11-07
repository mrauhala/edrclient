import { describe, expect, it } from 'vitest';
import { coverageToProfile, MOST_LOCATIONS, type CoverageProfile, type ProfileContext } from './coverageProfile';
import extents from './__fixtures__/profiles/vertical-extents.json';
import mcIfs1tAll from './__fixtures__/profiles/mc-ifs-1t-all.json';
import fmiEcmwf1tAll from './__fixtures__/profiles/fmi-ecmwf-1t-all.json';
import fmiHybrid1tAll from './__fixtures__/profiles/fmi-hybrid-1t-all.json';
import mcGfs1tAll from './__fixtures__/profiles/mc-gfs-1t-all.json';
import mcIfsZunsorted from './__fixtures__/profiles/mc-ifs-zunsorted.json';
import mcIfsAsked777 from './__fixtures__/profiles/mc-ifs-asked777.json';
import mcIfsZrange from './__fixtures__/profiles/mc-ifs-zrange.json';
import fmiEcmwfMultipoint from './__fixtures__/profiles/fmi-ecmwf-multipoint.json';
import mcIfsCube1pix from './__fixtures__/profiles/mc-ifs-cube-1pix.json';
import fmiTrajectoryOnePlace from './__fixtures__/profiles/fmi-trajectory-one-place.json';
import mcIfs85t from './__fixtures__/profiles/mc-ifs-85t-2p.json';
import mcRadarNldhl from './__fixtures__/profiles/mc-radar-nldhl-point2.json';
import mcRadarDkrom from './__fixtures__/profiles/mc-radar-dkrom-allnull.json';
import mcRadarSection from './__fixtures__/profiles/mc-radar-section.json';
import mcIfs1t1z from './__fixtures__/profiles/mc-ifs-1t-1z.json';
import fmiEcmwf1t1z from './__fixtures__/profiles/fmi-ecmwf-1t-1z.json';
import mcIfsZnotalevel from './__fixtures__/profiles/mc-ifs-znotalevel.json';
import mcIfs5t1z from './__fixtures__/profiles/mc-ifs-5t-1z.json';
import fmiEcmwf40t1z from './__fixtures__/profiles/fmi-ecmwf-40t-1z.json';
import fmiEcmwfZnotalevel from './__fixtures__/profiles/fmi-ecmwf-znotalevel.json';
import dmiPl1t3p from './__fixtures__/profiles/dmi-pl-1t-3p.json';
import dmiPlZ from './__fixtures__/profiles/dmi-pl-z.json';
import fmiEcmwfZrange from './__fixtures__/profiles/fmi-ecmwf-zrange.json';
import fmiEcmwfZunsorted from './__fixtures__/profiles/fmi-ecmwf-zunsorted.json';
import knmiPl from './__fixtures__/profiles/knmi-pl-position.json';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Each saved response, as the request that got it: its URL is in its comment
const copy = (json: unknown): Json => JSON.parse(JSON.stringify(json));
const urlOf = (json: Json) => /^GET (\S+),/.exec(json._comment)?.[1];
const read = (json: unknown, vertical?: ProfileContext['vertical'], url = urlOf(json as Json)) => coverageToProfile(copy(json), { url, vertical });
function profileOf(json: unknown, vertical?: ProfileContext['vertical'], url?: string): CoverageProfile {
  const result = read(json, vertical, url ?? urlOf(json as Json));
  if (!result.profile) throw new Error(`no profile: ${result.message}`);
  return result.profile;
}
const messages = (profile: CoverageProfile) => profile.notes.map(note => note.message);
const MC = extents['ecmwf-ifs-pressure'];
const FMI = extents.ecmwf_painepinta;

describe('coverageToProfile: the vertical axis, from the response', () => {
  it('takes MeteoCore’s direction and unit from the response itself', () => {
    const { axis } = profileOf(mcIfs1tAll, MC);
    expect(axis).toMatchObject({ kind: 'pressure', unit: 'hPa', direction: 'down', directionSource: 'response', unitSource: 'response' });
  });

  it('says nothing of the order of levels that run one way, up or down', () => {
    expect(messages(profileOf(mcIfs1tAll, MC)).some(message => /in order/.test(message))).toBe(false);
    expect(messages(profileOf(fmiHybrid1tAll)).some(message => /in order/.test(message))).toBe(false);
  });

  it('takes FMI’s unit from its sentence, and assumes its direction, saying so', () => {
    const profile = profileOf(fmiEcmwf1tAll, FMI);
    expect(profile.axis).toMatchObject({ kind: 'pressure', unit: 'hPa', unitSource: 'description', direction: 'down', directionSource: 'usual' });
    expect(messages(profile)).toContain("z's direction isn't in the response: assumed down, as usual for pressure");
  });

  it('reads a hybrid datum with “pressure” in its name as model levels, down and linear, which need no unit', () => {
    const profile = profileOf(fmiHybrid1tAll, extents.harmonie_scandinavia_hybrid);
    expect(profile.axis).toMatchObject({ kind: 'modelLevel', direction: 'down', directionSource: 'usual' });
    expect(profile.scale).toBe('linear');
    expect(messages(profile)).toContain("z's direction isn't in the response: assumed down, as usual for model levels");
    expect(messages(profile).some(message => /no unit/.test(message))).toBe(false);
  });

  it('reads a radar’s elevation angle: up, in degrees, and log, since its low scans would run together', () => {
    const { axis, scale } = profileOf(mcRadarNldhl, extents['radar-nl-volume-nldhl']);
    expect(axis).toMatchObject({ kind: 'angle', unit: '°', direction: 'up' });
    expect(scale).toBe('log');
  });

  it('keeps pressure that says it runs up as it says, with a note', () => {
    const json = copy(mcIfs1tAll);
    json.coverages[0].domain.referencing.find((entry: Json) => entry.coordinates.includes('z')).system.cs.csAxes[0].direction = 'up';
    const profile = profileOf(json);
    expect(profile.axis.direction).toBe('up');
    expect(messages(profile)).toContain('z is pressure and says it runs up, against the usual');
  });

  it('keeps a real radar section in metres as height, whatever its collection declares', () => {
    const json = copy(mcRadarSection);
    const coverage = json.coverages?.[0] ?? json;
    // One position of it, at every height: a profile
    coverage.domain.axes.composite.values = coverage.domain.axes.composite.values.slice(0, 1);
    for (const range of Object.values(coverage.ranges) as Json[]) {
      range.shape = [1, range.shape[1]];
      range.values = range.values.slice(0, range.shape[1]);
    }
    for (const vertical of [undefined, extents['fi-radar-pvol-fikan']]) {
      const { axis } = profileOf(json, vertical, 'x');
      expect(axis).toMatchObject({ kind: 'height', unit: 'm', direction: 'up', name: 'Height above antenna' });
    }
  });
});

describe('coverageToProfile: levels', () => {
  it('reads values in level order, and counts a null in the middle (GFS TCDC)', () => {
    const profile = profileOf(mcGfs1tAll, extents['noaa-gfs-pressure']);
    const cloud = profile.parameters.find(parameter => parameter.id === 'TCDC')!;
    expect(cloud.nulls).toBe(11);
    // Rows ascend: ten nulls from 1 to 40 hPa, a lone number at 50, a null at 70, then numbers
    const line = cloud.values[0][0];
    expect(line.slice(0, 10).every(value => value === null)).toBe(true);
    expect(profile.rows[10]).toBe(50);
    expect(typeof line[10]).toBe('number');
    expect(line[11]).toBeNull();
    expect(messages(profile)).toContain('11 nulls in TCDC, first at 1 hPa');
  });

  it('takes the union of levels that change from time to time, and names those not declared (DK radar)', () => {
    const profile = profileOf(mcRadarDkrom, extents['dk-radar-volume-dkrom']);
    expect(profile.levels).toHaveLength(12);
    expect(profile.mostLevels).toBe(10);
    expect(profile.undeclared).toEqual([4.8, 8.4]);
    expect(profile.missing).toEqual([]);
    expect(profile.shape).toBe('1 point, 12 levels in all, 10 at a time, 4 times, 1 parameter');
    expect(messages(profile)).toContain('The levels change from time to time: 12 in all, at most 10 at a time');
    expect(messages(profile)).toContain("z 4.8, 8.4 aren't among the levels in the collection's extent");
    expect(messages(profile)).toContain('All 40 values of DBZH are null');
  });

  it('sorts levels sent out of order, and says so (MeteoCore z=500,1000,850)', () => {
    const profile = profileOf(mcIfsZunsorted, MC);
    expect(profile.rows).toEqual([500, 850, 1000]);
    expect(profile.parameters[0].values[0][0][0]).toBe(-23.299797);
    expect(profile.parameters[0].values[0][0][2]).toBe(5.3022532);
    expect(messages(profile)).toContain("Levels aren't in order: 500, 1000, 850");
    expect(profile.cellOf('t', 0, 0, 0)).toEqual({ raw: -23.299797, path: '/coverages/0/ranges/t/values/0', axisIndex: 0 });
  });

  it('gives a level that was asked for and dropped a row of its own (MeteoCore z=1000,777,850,500)', () => {
    const profile = profileOf(mcIfsAsked777, MC);
    expect(profile.missing).toEqual([777]);
    expect(profile.rows).toEqual([500, 777, 850, 1000]);
    expect(profile.parameters[0].values[0][0][1]).toBeUndefined();
    expect(messages(profile)).toContain("z=777 was asked for, and isn't in the response");
  });

  it('asks a range only for the declared levels inside it', () => {
    expect(profileOf(mcIfsZrange, MC).missing).toEqual([]);
  });

  it('names declared levels that aren’t in the response, when nothing was asked', () => {
    const profile = profileOf(mcIfsZunsorted, { values: ['1000', '925', '850', '500'] }, 'x?f=CoverageJSON');
    expect(profile.missing).toEqual([925]);
    expect(messages(profile)).toContain("Level 925 hPa is in the collection's extent, and isn't in the response");
  });

  it('counts an asked level that never came, though no vrs is read (FMI, z=1000,850,500,333)', () => {
    const profile = profileOf(fmiEcmwfZunsorted, FMI, 'x?z=1000,850,500,333');
    expect(profile.missing).toEqual([333]);
    expect(profile.rows).toEqual([333, 500, 850, 1000]);
  });

  it('adds no rows for angles asked of an axis in metres, since none of them came back', () => {
    const profile = profileOf(metresSection(), extents['fi-radar-pvol-fikan'], 'x?z=0.5,1.5,3,8');
    expect(profile.missing).toEqual([]);
    expect(profile.rows).toEqual([0, 217, 434, 651, 868]);
  });

  it('adds no rows for declared angles either, and makes no claims about undeclared levels', () => {
    const profile = profileOf(metresSection(), extents['fi-radar-pvol-fikan'], 'x');
    expect(profile.missing).toEqual([]);
    expect(profile.undeclared).toEqual([]);
  });

  it('adds no rows for a z in Pa against declared hPa, and says it is outside the extent', () => {
    const json = copy(mcIfs1tAll);
    const z = json.coverages[0].domain.axes.z;
    z.values = z.values.map((value: number) => value * 100);
    const profile = profileOf(json, MC, 'x');
    expect(profile.missing).toEqual([]);
    // 10 hPa is 1000 Pa, which happens to be inside
    expect(messages(profile)).toContain("z 5000, 10000, 15000, 20000, 25000 and 8 more are outside the collection's extent, 10 to 1000");
  });

  it('says levels below the extent are outside it too', () => {
    const json = copy(mcIfs1tAll);
    json.coverages[0].domain.axes.z.values = json.coverages[0].domain.axes.z.values.map((value: number) => value / 1000);
    expect(messages(profileOf(json, MC, 'x'))).toContain("z 0.01, 0.05, 0.1, 0.15, 0.2 and 9 more are outside the collection's extent, 10 to 1000");
  });

  it('reads z given as start, stop and num', () => {
    const json = { type: 'Coverage', domain: { domainType: 'VerticalProfile', axes: { x: { values: [1] }, y: { values: [2] }, z: { start: 0, stop: 300, num: 4 } } }, ranges: { a: { axisNames: ['z'], shape: [4], values: [1, 2, 3, 4] } } };
    expect(profileOf(json).rows).toEqual([0, 100, 200, 300]);
  });
});

describe('coverageToProfile: whatever shape it comes in', () => {
  it('merges FMI’s one-value coverages into profiles by place (MULTIPOINT)', () => {
    const profile = profileOf(fmiEcmwfMultipoint, FMI);
    expect(profile.locations.map(location => location.label)).toHaveLength(2);
    expect(profile.rows).toEqual([500, 850, 1000]);
    expect(profile.coverageCount).toBe(6);
    expect(profile.shape).toBe('2 points, 3 levels, 1 time, 2 parameters');
    const temperature = profile.parameters.find(parameter => parameter.id === 'temperature')!;
    expect(temperature.values[0][0]).toEqual([-23.3537, -1.49691, 5.31473]);
    expect(temperature.values[1][0]).toEqual([-23.4091, -1.25854, 6.95583]);
  });

  it('reads a flat array through its axisNames, not by position (MeteoCore Grid t,z,y,x)', () => {
    const profile = profileOf(mcIfsCube1pix, MC);
    expect(profile.locations).toHaveLength(2);
    expect(profile.parameters[0].values[0][0][2]).toBe(5.4722533);
    expect(profile.parameters[0].values[1][0][2]).toBe(5.2222533);
  });

  it('reads one coverage with t and z, in either order of axisNames (ProfileSeries, which no server here sends)', () => {
    const axes = { x: { values: [1] }, y: { values: [2] }, t: { values: ['2026-11-07T00:00:00Z', '2026-11-07T06:00:00Z'] }, z: { values: [10, 20, 30] } };
    const series = (range: Json) => ({ type: 'Coverage', domain: { domainType: 'ProfileSeries', axes }, ranges: { v: range } });
    expect(profileOf(series({ axisNames: ['t', 'z'], shape: [2, 3], values: [1, 2, 3, 4, 5, 6] })).parameters[0].values[0]).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(profileOf(series({ axisNames: ['z', 't'], shape: [3, 2], values: [1, 4, 2, 5, 3, 6] })).parameters[0].values[0]).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it('merges one-tuple coverages at one place into a profile (FMI’s trajectory with both vertices the same)', () => {
    const profile = profileOf(fmiTrajectoryOnePlace, FMI);
    expect(profile.locations).toHaveLength(1);
    expect(profile.rows).toEqual([500, 850, 1000]);
    expect(profile.parameters[0].values[0][0]).toEqual([-23.3537, -1.49691, 5.31473]);
    expect(profile.cellOf('temperature', 0, 0, 0)?.path).toBe('/coverages/0/ranges/temperature/values/0');
  });

  it('reads a section with one position and a z axis as a profile, in either order of axisNames', () => {
    const section = (axisNames: string[], values: unknown[]) => ({
      type: 'Coverage',
      domain: { domainType: 'Section', axes: { composite: { coordinates: ['t', 'x', 'y'], values: [['2026-11-07T12:00:00Z', 1, 2]] }, z: { values: [0, 200, 400] } } },
      ranges: { a: { axisNames, shape: axisNames.map(name => (name === 'z' ? 3 : 1)), values } },
    });
    expect(profileOf(section(['composite', 'z'], [5, null, 7])).parameters[0].values[0][0]).toEqual([5, null, 7]);
    expect(profileOf(section(['z', 'composite'], [5, null, 7])).parameters[0].values[0][0]).toEqual([5, null, 7]);
  });

  it('reads tuples at one place at each of their times, on a z axis, in either order of axisNames', () => {
    const tuples = [['2026-11-07T00:00:00Z', 1, 2], ['2026-11-07T06:00:00Z', 1, 2]];
    const section = (axisNames: string[], values: number[]) => ({
      type: 'Coverage',
      domain: { domainType: 'Section', axes: { composite: { coordinates: ['t', 'x', 'y'], values: tuples }, z: { values: [0, 200] } } },
      ranges: { a: { axisNames, shape: [2, 2], values } },
    });
    // Tuple first: t0 at 0 and 200, then t1. z first: both times at 0, then both at 200
    expect(profileOf(section(['composite', 'z'], [1, 2, 3, 4])).parameters[0].values[0]).toEqual([[1, 2], [3, 4]]);
    expect(profileOf(section(['z', 'composite'], [1, 3, 2, 4])).parameters[0].values[0]).toEqual([[1, 2], [3, 4]]);
    expect(profileOf(section(['composite', 'z'], [1, 2, 3, 4])).times.map(time => time.raw)).toEqual(['2026-11-07T00:00:00Z', '2026-11-07T06:00:00Z']);
  });

  it('reads none of a composite’s values that leave its z axis out of axisNames', () => {
    const json = {
      type: 'Coverage',
      domain: { domainType: 'Section', axes: { composite: { coordinates: ['t', 'x', 'y'], values: [['2026-11-07T12:00:00Z', 1, 2]] }, z: { values: [0, 200, 400] } } },
      ranges: { a: { axisNames: ['composite'], shape: [3], values: [5, 6, 7] } },
    };
    expect(profileOf(json).parameters[0].misfit).toEqual({ count: 3, expected: 3, path: '/ranges/a/values' });
  });

  it('reads none of a range whose shape has the axes the wrong way round, though they multiply out', () => {
    const json = { type: 'Coverage', domain: { axes: { x: { values: [1, 2] }, y: { values: [5] }, z: { values: [10, 20, 30] } } }, ranges: { a: { axisNames: ['x', 'z'], shape: [3, 2], values: [1, 2, 3, 4, 5, 6] } } };
    expect(profileOf(json).parameters[0]).toMatchObject({ misfit: { count: 6, expected: 6, path: '/ranges/a/values' }, numbers: 0 });
  });

  it('calls a collection of different domain types mixed', () => {
    const one = (domainType: string, x: number) => ({ type: 'Coverage', domain: { domainType, axes: { x: { values: [x] }, y: { values: [2] }, z: { values: [1, 2] } } }, ranges: { a: { axisNames: ['z'], shape: [2], values: [1, 2] } } });
    expect(profileOf({ type: 'CoverageCollection', coverages: [one('VerticalProfile', 1), one('Grid', 3)] }).domainType).toBe('Mixed');
    expect(profileOf({ type: 'CoverageCollection', domainType: 'VerticalProfile', coverages: [one('VerticalProfile', 1)] }).domainType).toBe('VerticalProfile');
  });

  it('has a profile per time, in time order, for 85 coverages', () => {
    const profile = profileOf(mcIfs85t, MC);
    expect(profile.times).toHaveLength(85);
    expect(profile.times.every((time, i) => i === 0 || time.at > profile.times[i - 1].at)).toBe(true);
    expect(profile.shape).toBe('1 point, 14 levels, 85 times, 1 parameter');
  });

  it('puts profiles in time order, whatever order the coverages come in, and names a null’s time', () => {
    const at = (time: string, values: unknown[]) => ({ type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [2] }, t: { values: [time] }, z: { values: [10, 20] } } }, ranges: { a: { axisNames: ['t', 'z'], shape: [1, 2], values } } });
    const profile = profileOf({ type: 'CoverageCollection', coverages: [at('2026-11-07T06:00:00Z', [3, null]), at('2026-11-07T00:00:00Z', [1, 2])] });
    expect(profile.times.map(time => time.raw)).toEqual(['2026-11-07T00:00:00Z', '2026-11-07T06:00:00Z']);
    expect(profile.parameters[0].values[0]).toEqual([[1, 2], [3, null]]);
    expect(messages(profile)).toContain('1 null in a, at 20, Nov 7 06:00');
  });

  it('works out each parameter’s figures from what was sent, and nothing else', () => {
    const json = { type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [2] }, z: { values: [1, 2, 3, 4, 5] } } }, parameters: { a: { observedProperty: { label: { en: 'Air' } }, unit: { symbol: 'K' } } }, ranges: { a: { axisNames: ['z'], shape: [5], values: [4, null, 'x', -2, 7] } } };
    const [parameter] = profileOf(json, undefined, 'x?z=1,2,3,4,5,6').parameters;
    expect(parameter).toMatchObject({ id: 'a', label: 'Air', unit: 'K', count: 5, nulls: 1, others: 1, numbers: 3, min: -2, max: 7, mean: 3, notIncluded: false, misfit: null });
    expect(parameter.values[0][0]).toEqual([4, null, 'x', -2, 7, undefined]);
    const unnamed = { ...json, parameters: {} };
    expect(profileOf(unnamed).parameters[0]).toMatchObject({ id: 'a', label: null, unit: '' });
  });

  it('has no cell where there’s no place, time or level', () => {
    const profile = profileOf(mcIfsZunsorted, MC);
    expect(profile.cellOf('t', 1, 0, 0)).toBeNull();
    expect(profile.cellOf('t', 0, 1, 0)).toBeNull();
    expect(profile.cellOf('t', 0, 0, 3)).toBeNull();
    expect(profile.cellOf('nothing', 0, 0, 0)).toBeNull();
  });

  it('leaves out the times when the response has none', () => {
    const json = { type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [2] }, z: { values: [1, 2] } } }, ranges: { a: { axisNames: ['z'], shape: [2], values: [1, 2] } } };
    const profile = profileOf(json);
    expect(profile.shape).toBe('1 point, 2 levels, 1 parameter');
    expect(profile.domainType).toBe('Coverage');
  });

  it('escapes a parameter id in its pointers', () => {
    const json = { type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [2] }, z: { values: [1, 2] } } }, ranges: { 'a/b~c': { axisNames: ['z'], shape: [2], values: [1, null] } } };
    expect(profileOf(json).cellOf('a/b~c', 0, 0, 1)?.path).toBe('/ranges/a~1b~0c/values/1');
  });
});

describe('coverageToProfile: what doesn’t fit is said, and not read wrong', () => {
  it('reads none of a parameter whose values don’t fit its axes, and says how many', () => {
    const json = copy(mcIfs1tAll);
    json.coverages[0].ranges.t.values.pop();
    const profile = profileOf(json);
    const temperature = profile.parameters.find(parameter => parameter.id === 't')!;
    expect(temperature.misfit).toEqual({ count: 13, expected: 14, path: '/coverages/0/ranges/t/values' });
    expect(temperature.numbers).toBe(0);
    expect(messages(profile)).toContain('t: shape and axes make 14 values, and values has 13, so none are read');
    expect(profile.parameters.find(parameter => parameter.id === 'r')!.numbers).toBe(14);
  });

  it('reads none of a parameter whose axisNames leave out an axis', () => {
    const json = { type: 'Coverage', domain: { axes: { x: { values: [1, 2] }, y: { values: [5] }, z: { values: [1, 2] } } }, ranges: { a: { axisNames: ['z'], shape: [2], values: [1, 2, 3, 4] } } };
    expect(profileOf(json).parameters[0].misfit).toEqual({ count: 4, expected: 4, path: '/ranges/a/values' });
  });

  it('uses the first of two values for the same level, and says so', () => {
    const one = (value: number) => ({ type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [2] }, z: { values: [1, 2] } } }, ranges: { a: { axisNames: ['z'], shape: [2], values: [value, value] } } });
    const profile = profileOf({ type: 'CoverageCollection', coverages: [one(1), one(2)] });
    expect(profile.parameters[0].values[0][0]).toEqual([1, 1]);
    expect(messages(profile)).toContain('2 values sent again for a level already sent. The first is used');
  });

  it('says what z lacks: no unit, and no direction to go on', () => {
    const json = { type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [2] }, z: { values: [10, 100, 1000] } } }, ranges: { v: { axisNames: ['z'], shape: [3], values: [1, 2, 3] } } };
    const profile = profileOf(json);
    expect(profile.axis).toMatchObject({ kind: 'unknown', name: 'z', direction: 'up', directionSource: 'none' });
    expect(messages(profile)).toEqual(expect.arrayContaining(['z has no unit in the response', "z's direction isn't in the response, and nothing says what z is: assumed up"]));
  });
});

describe('coverageToProfile: what kind of finding each is', () => {
  const kinds = (profile: CoverageProfile) => Object.fromEntries(profile.notes.map(note => [note.message, note.severity]));

  it('passes what MeteoCore says of z, and what its collection says too', () => {
    expect(kinds(profileOf(mcIfs1tAll, MC))).toEqual({
      "z's direction is in the response: down": 'pass',
      "The collection's vrs gives z's direction: down": 'pass',
      "z's unit is in the response: hPa": 'pass',
      "The collection's vrs gives z's unit: hPa": 'pass',
      'Every level asked for is in the response: 1000, 925, 850, 700, 600 and 9 more': 'pass',
      "Every level in the response is among those in the collection's extent": 'pass',
      "Every level is inside the collection's extent, 10 to 1000": 'pass',
      "Every parameter's values fit its shape and axes": 'pass',
    });
  });

  it('makes an issue of what FMI leaves out of the response, and passes what its collection says', () => {
    expect(kinds(profileOf(fmiEcmwf1tAll, FMI))).toEqual({
      "z's direction isn't in the response: assumed down, as usual for pressure": 'warning',
      "The collection's vrs gives z's direction: down": 'pass',
      "z's unit, hPa, is only in a description, and not in its reference system's axis": 'warning',
      "The collection's vrs gives z's unit: hPa": 'pass',
      'Every level asked for is in the response: 1000, 925, 850, 700, 500 and 4 more': 'pass',
      "Every level in the response is among those in the collection's extent": 'pass',
      "Every level is inside the collection's extent, 50 to 1000": 'pass',
      '2 nulls in windspeedms, first at 50 hPa': 'info',
      "Every parameter's values fit its shape and axes": 'pass',
    });
  });

  it('notes what’s there to see, and leaves the vrs out where the levels aren’t its own (DK radar)', () => {
    expect(kinds(profileOf(mcRadarDkrom, extents['dk-radar-volume-dkrom']))).toEqual({
      "z's direction is in the response: up": 'pass',
      "z's unit is in the response: °": 'pass',
      "Every level in the collection's extent is in the response": 'pass',
      "z 4.8, 8.4 aren't among the levels in the collection's extent": 'warning',
      "Every level is inside the collection's extent, 0.5 to 15": 'pass',
      'The levels change from time to time: 12 in all, at most 10 at a time': 'info',
      'All 40 values of DBZH are null': 'info',
      "Every parameter's values fit its shape and axes": 'pass',
    });
  });

  it('says which findings rest on the collection, and links only those the response is part of', () => {
    const notes = profileOf(fmiEcmwf1tAll, FMI).notes;
    const of = (message: string) => notes.find(note => note.message === message);
    expect(of("The collection's vrs gives z's direction: down")).toEqual({ message: "The collection's vrs gives z's direction: down", severity: 'pass', source: 'collection' });
    expect(of("The collection's vrs gives z's unit: hPa")).not.toHaveProperty('path');
    expect(of("Every level in the response is among those in the collection's extent")).toMatchObject({ source: 'collection', path: '/coverages/0/domain/axes/z/values' });
    expect(of("z's direction isn't in the response: assumed down, as usual for pressure")).not.toHaveProperty('source');
    // Asked for is the request's, not the collection's
    expect(of('Every level asked for is in the response: 1000, 925, 850, 700, 500 and 4 more')).not.toHaveProperty('source');
    const missing = profileOf(mcIfsZunsorted, { values: ['1000', '925', '850', '500'] }, 'x').notes.find(note => /925 hPa is in the collection's extent/.test(note.message));
    expect(missing).toMatchObject({ severity: 'warning', source: 'collection', path: '/coverages/0/domain/axes/z/values' });
  });

  it('makes an issue of a level asked for and not sent, and notes levels out of order', () => {
    expect(kinds(profileOf(mcIfsAsked777, MC))["z=777 was asked for, and isn't in the response"]).toBe('warning');
    expect(messages(profileOf(mcIfsAsked777, MC)).some(message => /^Every level asked for/.test(message))).toBe(false);
    expect(kinds(profileOf(mcIfsZunsorted, MC))["Levels aren't in order: 500, 1000, 850"]).toBe('info');
  });

  it('makes an issue of z with nothing to go on, of a direction against the usual, and of a value sent twice', () => {
    const plain = { type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [2] }, z: { values: [10, 100] } } }, ranges: { v: { axisNames: ['z'], shape: [2], values: [1, 2] } } };
    expect(kinds(profileOf(plain))).toEqual({
      "z's direction isn't in the response, and nothing says what z is: assumed up": 'warning',
      'z has no unit in the response': 'warning',
      "Every parameter's values fit its shape and axes": 'pass',
    });
    const json = copy(mcIfs1tAll);
    json.coverages[0].domain.referencing.find((entry: Json) => entry.coordinates.includes('z')).system.cs.csAxes[0].direction = 'up';
    expect(kinds(profileOf(json))['z is pressure and says it runs up, against the usual']).toBe('warning');
    const twice = { type: 'CoverageCollection', coverages: [plain, plain] };
    expect(kinds(profileOf(twice))['2 values sent again for a level already sent. The first is used']).toBe('warning');
  });

  it('makes an issue of the response and the collection’s vrs disagreeing', () => {
    const json = copy(mcIfs1tAll);
    const z = json.coverages[0].domain.referencing.find((entry: Json) => entry.coordinates.includes('z')).system.cs.csAxes[0];
    z.unit = { symbol: 'Pa' };
    const up = { ...MC, vrs: MC.vrs.replace(',down]', ',up]') };
    const found = kinds(profileOf(json, up));
    expect(found["The response says z runs down, and the collection's vrs says up"]).toBe('warning');
    expect(found["z's unit is Pa in the response, and hPa in the collection's vrs"]).toBe('warning');
    expect(Object.keys(found).some(message => /vrs gives/.test(message))).toBe(false);
  });

  it('makes an issue of a vrs against the direction assumed for a silent response', () => {
    const json = copy(fmiEcmwf1tAll);
    const up = { ...FMI, vrs: FMI.vrs.replace(',down]', ',up]') };
    expect(kinds(profileOf(json, up))["The collection's vrs says z runs up, and down is assumed for the response"]).toBe('warning');
  });

  it('checks against a vrs with an interval and no levels listed, if the levels are inside it', () => {
    const inside = kinds(profileOf(mcIfs1tAll, { vrs: MC.vrs, interval: [['1', '1000']] }));
    expect(inside["The collection's vrs gives z's direction: down"]).toBe('pass');
    const outside = kinds(profileOf(mcIfs1tAll, { vrs: MC.vrs, interval: [['100', '1000']] }));
    expect(Object.keys(outside).some(message => /vrs/.test(message))).toBe(false);
  });

  it('passes every declared level being there when nothing was asked, and not when one is missing', () => {
    const declared = { values: ['1000', '850', '500'] };
    expect(kinds(profileOf(mcIfsZunsorted, declared, 'x'))["Every level in the collection's extent is in the response"]).toBe('pass');
    expect(kinds(profileOf(mcIfsZunsorted, { values: ['1000', '925', '850', '500'] }, 'x'))["Every level in the collection's extent is in the response"]).toBeUndefined();
  });

  it('makes an error of values that don’t fit, which then don’t all fit', () => {
    const json = copy(mcIfs1tAll);
    json.coverages[0].domain.axes.z.values = json.coverages[0].domain.axes.z.values.map((value: number) => value * 100);
    json.coverages[0].ranges.t.values.pop();
    const found = kinds(profileOf(json, MC, 'x'));
    expect(found["z 5000, 10000, 15000, 20000, 25000 and 8 more are outside the collection's extent, 10 to 1000"]).toBe('warning');
    expect(found['t: shape and axes make 14 values, and values has 13, so none are read']).toBe('error');
    expect(found["Every parameter's values fit its shape and axes"]).toBeUndefined();
  });
});

describe('coverageToProfile: what isn’t claimed', () => {
  const messagesOf = (json: unknown, vertical?: ProfileContext['vertical'], url?: string) => messages(profileOf(json, vertical, url));

  it('passes the collection’s unit for a response without one, and makes no mismatch of it', () => {
    const json = copy(mcIfs1tAll);
    delete json.coverages[0].domain.referencing.find((entry: Json) => entry.coordinates.includes('z')).system.cs.csAxes[0].unit;
    const found = messagesOf(json, MC);
    expect(found).toEqual(expect.arrayContaining(['z has no unit in the response', "The collection's vrs gives z's unit: hPa"]));
    expect(found.some(message => /in the collection's vrs$/.test(message))).toBe(false);
  });

  it('passes no unit for a z whose unit is 1', () => {
    const json = { type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [2] }, z: { values: [1, 2] } }, referencing: [{ coordinates: ['z'], system: { type: 'VerticalCRS', cs: { csAxes: [{ name: { en: 'Level' }, direction: 'up', unit: { symbol: '1' } }] } } }] }, ranges: { a: { axisNames: ['z'], shape: [2], values: [1, 2] } } };
    expect(messagesOf(json).some(message => /unit/.test(message))).toBe(false);
  });

  it('passes no asked levels when none of them came back, and no declared ones when a range was asked', () => {
    expect(messagesOf(metresSection(), extents['fi-radar-pvol-fikan'], 'x?z=0.5,1.5,3,8').some(message => /^Every level asked for/.test(message))).toBe(false);
    expect(messagesOf(mcIfsZrange, MC).some(message => /^Every level in the collection's extent is in/.test(message))).toBe(false);
  });

  it('says nothing of the levels a parameter has when none of its values are read', () => {
    const json = copy(mcIfs1tAll);
    json.coverages[0].ranges.t.values.pop();
    expect(messagesOf(json, MC, 'x?z=1000,925').some(message => /^t (isn't at|has \d+ of)/.test(message))).toBe(false);
  });

  it('passes no fit without parameters, or with one whose values aren’t in the response', () => {
    const axes = { x: { values: [1] }, y: { values: [2] }, z: { values: [1, 2] } };
    expect(messagesOf({ type: 'Coverage', domain: { axes } }).some(message => /fit its shape/.test(message))).toBe(false);
    const linked = { type: 'Coverage', domain: { axes }, ranges: { a: { axisNames: ['z'], shape: [2], values: [1, 2] }, b: 'https://example.org/b.json' } };
    expect(messagesOf(linked).some(message => /fit its shape/.test(message))).toBe(false);
  });

  it('points at the collection’s referencing when that’s where z is put under CRS84', () => {
    const json = copy(knmiPl);
    json.referencing = json.coverages[0].domain.referencing;
    for (const coverage of json.coverages) delete coverage.domain.referencing;
    expect(profileOf(json).notes.find(note => /CRS84/.test(note.message))?.path).toBe('/referencing');
  });
});

describe('coverageToProfile: KNMI, a coverage per parameter', () => {
  const KNMI = extents['uwcw_ha43_dini_5p5km.pl'];

  it('merges its coverages into one profile, and keeps what each sent', () => {
    const profile = profileOf(knmiPl, KNMI);
    expect(profile.shape).toBe('1 point, 4 levels, 1 time, 2 parameters');
    expect(profile.parameters.map(parameter => parameter.id)).toEqual(['air_temperature_pl', 'relative_humidity_pl']);
    expect(profile.parameters[1].values[0][0]).toEqual([undefined, undefined, 0.978879, 0.956619]);
    expect(profile.parameters[1]).toMatchObject({ count: 2, nulls: 0 });
  });

  it('makes an issue of levels one parameter was asked for and left out, and of z referenced to CRS84', () => {
    const notes = Object.fromEntries(profileOf(knmiPl, KNMI).notes.map(note => [note.message, note.severity]));
    expect(notes).toMatchObject({
      'relative_humidity_pl isn\'t at z=500, 700, which were asked for': 'warning',
      'z is referenced to http://www.opengis.net/def/crs/OGC/1.3/CRS84, which has no vertical axis': 'warning',
      "z's direction isn't in the response, and nothing says what z is: assumed up": 'warning',
      'Every level asked for is in the response: 500, 700, 850, 925': 'pass',
    });
    expect(Object.keys(notes).some(message => /vrs/.test(message))).toBe(false);
    expect(profileOf(knmiPl, KNMI).notes.find(note => /CRS84/.test(note.message))?.path).toBe('/coverages/0/domain/referencing');
  });

  it('only notes a parameter on fewer levels when nothing was asked, since that can be how it is', () => {
    const notes = Object.fromEntries(profileOf(knmiPl, KNMI, 'x?f=CoverageJSON').notes.map(note => [note.message, note.severity]));
    expect(notes['relative_humidity_pl has 2 of the 4 levels: not 500, 700']).toBe('info');
  });
});

describe('coverageToProfile: no profile, and why', () => {
  const cases: [string, unknown, string, RegExp][] = [
    ['one level', mcIfs1t1z, 'oneLevel', /^One level, 500 hPa: nothing to draw a profile through\.$/],
    ['one level at FMI', fmiEcmwf1t1z, 'oneLevel', /^One level, 500 hPa/],
    ['one real level of two asked', mcIfsZnotalevel, 'oneLevel', /^One level, 850 hPa/],
    ['one level over five times', mcIfs5t1z, 'oneLevel', /^One level/],
    ['one level over 40 times', fmiEcmwf40t1z, 'oneLevel', /^One level/],
    ['no coverages', fmiEcmwfZnotalevel, 'empty', /^The response has no coverages, for z=777,850\.$/],
    ['levels in names', dmiPl1t3p, 'noZ', /^No z axis\. 3 parameters carry a level in the name \(temperature-850hPa, temperature-1000hPa\), which the view doesn't read as levels\.$/],
    ['z asked of DMI', dmiPlZ, 'noZ', /^No z axis\.$/],
    ['an error', fmiEcmwfZrange, 'notCoverage', /^Not a coverage\.$/],
  ];
  it.each(cases)('%s', (_name, json, reason, message) => {
    const result = read(json);
    expect(result.profile).toBeNull();
    expect(result).toMatchObject({ reason });
    expect(result.profile === null && result.message).toMatch(message);
  });

  it('calls tuples that move a path, by how many places', () => {
    const json = { type: 'Coverage', domain: { domainType: 'Trajectory', axes: { composite: { coordinates: ['t', 'x', 'y', 'z'], values: [['2026-11-07T12:00:00Z', 1, 2, 500], ['2026-11-07T12:00:00Z', 3, 4, 500]] } } }, ranges: { a: { axisNames: ['composite'], shape: [2], values: [1, 2] } } };
    expect(read(json)).toEqual({ profile: null, reason: 'composite', message: '2 positions along a path, not one point at many levels.' });
  });

  it('calls a grid a grid from its axes alone, without reading its values', () => {
    // Ten billion places, which listing one by one would never finish
    const json = { type: 'Coverage', domain: { axes: { x: { start: 0, stop: 99999, num: 100000 }, y: { start: 0, stop: 99999, num: 100000 }, z: { values: [1, 2] } } }, ranges: { a: { axisNames: ['z', 'y', 'x'], shape: [2, 100000, 100000], values: [] } } };
    expect(read(json)).toEqual({ profile: null, reason: 'grid', message: '10,000,000,000 locations: a grid, not a profile.' });
  });

  it(`counts the places of a collection: ${MOST_LOCATIONS} are lines, one more is a grid`, () => {
    const point = (x: number) => ({ type: 'Coverage', domain: { axes: { x: { values: [x] }, y: { values: [0] }, z: { values: [1, 2] } } }, ranges: { a: { axisNames: ['z'], shape: [2], values: [1, 2] } } });
    const points = (count: number) => ({ type: 'CoverageCollection', coverages: Array.from({ length: count }, (_, x) => point(x)) });
    expect(profileOf(points(MOST_LOCATIONS)).locations).toHaveLength(MOST_LOCATIONS);
    expect(read(points(MOST_LOCATIONS + 1))).toMatchObject({ reason: 'grid', message: '9 locations: a grid, not a profile.' });
  });

  it('says z that isn’t numbers, and values that aren’t in the response', () => {
    const json = (z: unknown[], range: unknown) => ({ type: 'Coverage', domain: { axes: { x: { values: [1] }, y: { values: [2] }, z: { values: z } } }, ranges: { a: range } });
    expect(read(json(['low', 'high'], { values: [1, 2] }))).toMatchObject({ reason: 'zNotNumbers' });
    expect(read(json([1, 2], 'https://example.org/a.json'))).toMatchObject({ reason: 'notIncluded', message: "The values aren't in this response." });
  });
});

function metresSection() {
  return {
    type: 'Coverage',
    domain: {
      domainType: 'Section',
      axes: { composite: { coordinates: ['t', 'x', 'y'], values: [['2026-11-06T21:30:00Z', 24, 62]] }, z: { values: [0, 217, 434, 651, 868] } },
      referencing: [{ coordinates: ['z'], system: { type: 'VerticalCRS', cs: { csAxes: [{ name: { en: 'Height above antenna' }, direction: 'up', unit: { symbol: 'm' } }] } } }],
    },
    ranges: { a: { axisNames: ['composite', 'z'], shape: [1, 5], values: [1, 2, 3, 4, 5] } },
  };
}
