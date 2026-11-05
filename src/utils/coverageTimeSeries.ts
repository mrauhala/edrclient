// A CoverageJSON coverage can be charted as a time series when its domain has a t axis and
// every other axis (x, y, z, composite, ...) holds exactly one value. Each range's flattened
// values then line up 1:1 with the t axis, whatever the domainType: PointSeries, a single-point
// Grid, or e.g. DWD's MultiPolygonSeries whose composite axis holds the one grid cell polygon.

interface CoverageAxis {
  values?: unknown[];
  num?: number;
}

export function axisLength(axis: CoverageAxis | undefined): number | undefined {
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

// The parameters describing a coverage's ranges. A CoverageCollection may define them once for all
// its coverages (Instituto Hidrográfico does); a coverage's own definitions take precedence.
export function coverageParameters<P>(
  coverage: { parameters?: Record<string, P> },
  collectionParameters?: Record<string, P>,
): Record<string, P> | undefined {
  if (!coverage.parameters && !collectionParameters) return undefined;
  return { ...collectionParameters, ...coverage.parameters };
}

type I18nText = { en?: string; fi?: string };

// A parameter's unit as text, or '' if it has none. A symbol may be text or { value, type }, and
// UCUM's "1" means no unit at all, which beside a value only reads as a mistake.
export function parameterUnit(parameter?: { unit?: { symbol?: string | { value?: string }; label?: I18nText } }): string {
  const symbol = parameter?.unit?.symbol;
  const unit = (typeof symbol === 'string' ? symbol : symbol?.value) ?? parameter?.unit?.label?.en ?? parameter?.unit?.label?.fi ?? '';
  return unit === '1' ? '' : unit;
}

// A series' name: the observed property's label, else the parameter's description, else its id.
// Labels that are links are skipped: DMI labels each observed property with an ECMWF parameter
// database URL, which says nothing in a legend.
export function parameterLabel(
  id: string,
  parameter?: { observedProperty?: { label?: I18nText }; description?: I18nText },
): string {
  const candidates = [
    parameter?.observedProperty?.label?.en,
    parameter?.observedProperty?.label?.fi,
    parameter?.description?.en,
    parameter?.description?.fi,
  ];
  return candidates.find(label => label?.trim() && !/^https?:\/\//i.test(label.trim())) ?? id;
}
