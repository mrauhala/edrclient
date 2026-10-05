// Length units servers list for within (radius) and corridor width, as written in their metadata
const METERS: Record<string, number> = {
  m: 1,
  km: 1000,
  mi: 1609.344,
  mile: 1609.344,
  miles: 1609.344,
  nm: 1852,
  nmi: 1852,
  ft: 0.3048,
};

export function unitToMeters(unit: string): number | null {
  return METERS[unit.trim().toLowerCase()] ?? null;
}

// Slider range for a radius in a unit: about 10 m to 500 km whatever the unit
export interface LengthRange {
  min: number;
  max: number;
  step: number;
}

const RANGES: Record<string, LengthRange> = {
  m: { min: 10, max: 50000, step: 10 },
  km: { min: 1, max: 500, step: 1 },
  mi: { min: 1, max: 300, step: 1 },
  nm: { min: 1, max: 270, step: 1 },
  ft: { min: 50, max: 150000, step: 50 },
};

export function rangeFor(unit: string): LengthRange {
  const meters = unitToMeters(unit);
  const key = Object.keys(RANGES).find(candidate => unitToMeters(candidate) === meters);
  return (key && RANGES[key]) || RANGES.km;
}

// A length in another unit, rounded to the target unit's slider step; unchanged if either unit is unknown
export function convertLength(value: number, from: string, to: string): number {
  const fromMeters = unitToMeters(from);
  const toMeters = unitToMeters(to);
  if (!fromMeters || !toMeters || from === to) return value;
  const { step, min } = rangeFor(to);
  return Math.max(min, Math.round((value * fromMeters) / toMeters / step) * step);
}

// The unit to use from those a query offers: the current one if offered, else km, else the first.
// With nothing offered the current unit stays.
export function pickUnit(offered: string[], current: string): string {
  if (offered.length === 0 || offered.includes(current)) return current;
  return offered.find(unit => unit.toLowerCase() === 'km') ?? offered[0];
}
