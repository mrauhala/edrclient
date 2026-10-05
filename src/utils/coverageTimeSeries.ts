// A CoverageJSON coverage can be charted as a time series when its domain has a t axis and
// every other axis (x, y, z, composite, ...) holds exactly one value. Each range's flattened
// values then line up 1:1 with the t axis, whatever the domainType: PointSeries, a single-point
// Grid, or e.g. DWD's MultiPolygonSeries whose composite axis holds the one grid cell polygon.

interface CoverageAxis {
  values?: unknown[];
  num?: number;
}

function axisLength(axis: CoverageAxis | undefined): number | undefined {
  if (Array.isArray(axis?.values)) return axis.values.length;
  if (typeof axis?.num === 'number') return axis.num;
  return undefined;
}

// Returns why the coverage can't be charted as a time series, or null when it can.
export function getTimeSeriesError(coverage: unknown): string | null {
  const axes = (coverage as { domain?: { axes?: Record<string, CoverageAxis> } } | null)?.domain?.axes;
  if (!axes || typeof axes !== 'object') {
    return 'No domain axes found in the coverage data';
  }

  if (!Array.isArray(axes.t?.values) || axes.t.values.length === 0) {
    return 'No time axis found in the coverage data';
  }

  const multiValued = Object.keys(axes).filter(name => name !== 't' && axisLength(axes[name]) !== 1);
  if (multiValued.length > 0) {
    return `Only time series at a single location can be charted (axes with more than one value: ${multiValued.join(', ')})`;
  }

  return null;
}

export function isTimeSeriesCoverage(coverage: unknown): boolean {
  return getTimeSeriesError(coverage) === null;
}
