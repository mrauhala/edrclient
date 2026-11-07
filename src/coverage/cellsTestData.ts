// CoverageJSON as real APIs send it, built small for tests. The shapes come from the responses saved while designing this
// view: MeteoCore's t × z × y × x grid, DMI's start/stop/num, FMI's Point collections, DWD's triangles.

type Json = Record<string, unknown>;

export const CRS84 = [{ coordinates: ['x', 'y'], system: { type: 'GeographicCRS', id: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' } }];

export const counting = (n: number, from = 0) => Array.from({ length: n }, (_, i) => from + i);

interface GridOptions {
  x?: unknown;
  y?: unknown;
  t?: string[];
  z?: number[];
  values?: unknown[];
  id?: string;
  unit?: string;
  domainType?: string;
  referencing?: unknown;
}

const axisOf = (axis: unknown) => (Array.isArray(axis) ? { values: axis } : axis);
const lengthOf = (axis: unknown) => (Array.isArray(axis) ? axis.length : (axis as { num?: number; values?: unknown[] })?.num ?? (axis as { values?: unknown[] })?.values?.length ?? 0);

// A Grid with its axes in the order [t, z, y, x], whose values are 0, 1, 2... unless it's given others. y runs north first
export function grid({
  x = [24, 25, 26, 27], y = [61, 60, 59], t, z, values, id = 'temperature', unit = 'K', domainType = 'Grid', referencing = CRS84,
}: GridOptions = {}): Json {
  const names = [...(t ? ['t'] : []), ...(z ? ['z'] : []), 'y', 'x'];
  const shape = [...(t ? [t.length] : []), ...(z ? [z.length] : []), lengthOf(y), lengthOf(x)];
  return {
    type: 'Coverage',
    domain: {
      type: 'Domain',
      domainType,
      axes: { x: axisOf(x), y: axisOf(y), ...(t ? { t: { values: t } } : {}), ...(z ? { z: { values: z } } : {}) },
      referencing,
    },
    parameters: { [id]: { type: 'Parameter', unit: { symbol: unit } } },
    ranges: { [id]: { type: 'NdArray', dataType: 'float', axisNames: names, shape, values: values ?? counting(shape.reduce((a, b) => a * b, 1)) } },
  };
}

interface PointOptions {
  t?: string[];
  z?: number[];
  values: Record<string, unknown[]>;
  // On the coverage, not the collection
  ownDomainType?: boolean;
}

export const pointCoverage = (x: number, y: number, { t, z, values, ownDomainType }: PointOptions): Json => ({
  type: 'Coverage',
  domain: {
    type: 'Domain',
    ...(ownDomainType ? { domainType: t && t.length > 1 ? 'PointSeries' : 'Point' } : {}),
    axes: { x: { values: [x] }, y: { values: [y] }, ...(t ? { t: { values: t } } : {}), ...(z ? { z: { values: z } } : {}) },
  },
  ranges: Object.fromEntries(Object.entries(values).map(([id, list]) => [id, { type: 'NdArray', values: list, shape: [list.length], axisNames: ['t'] }])),
});

export const pointCollection = (coverages: Json[], parameters: Json = { temperature: { type: 'Parameter', unit: { symbol: 'K' } } }): Json => ({
  type: 'CoverageCollection',
  domainType: 'Point',
  referencing: CRS84,
  parameters,
  coverages,
});

// A complete lattice sent the long way round, south first as FMI's are, and its values are its place: 100 × y + x
export const pointLattice = (xs: number[], ys: number[]) => pointCollection(
  ys.flatMap(y => xs.map(x => pointCoverage(x, y, { values: { temperature: [100 * y + x] } }))),
);

export const triangles = (values: unknown[], t?: string[]): Json => ({
  type: 'CoverageCollection',
  coverages: [{
    type: 'Coverage',
    domain: {
      type: 'Domain',
      domainType: 'MultiPolygonSeries',
      axes: {
        composite: {
          dataType: 'polygon',
          coordinates: ['x', 'y'],
          values: [
            [[[10, 50], [11, 50], [10.5, 51], [10, 50]]],
            [[[11, 50], [12, 50], [11.5, 51], [11, 50]]],
          ],
        },
        ...(t ? { t: { values: t } } : {}),
      },
      referencing: CRS84,
    },
    parameters: { CAPE: { type: 'Parameter', unit: { symbol: 'J/kg' } } },
    ranges: { CAPE: { type: 'NdArray', axisNames: [...(t ? ['t'] : []), 'composite'], shape: [...(t ? [t.length] : []), 2], values } },
  }],
});
