import type { CustomDimension, Extent } from '../../types/api';

// OGC API – Maps models additional dimensions (the "UAD" extent) as top-level keys on `extent`
// (e.g. `extent.pressure = { crs, interval, grid: { coordinates: [...] } }`), unlike EDR which
// uses an `extent.custom[]` array. This normalizes those top-level dimension keys into the same
// CustomDimension shape so the existing selectors + query serialization work unchanged.
// EDR collections (no such top-level keys) are unaffected — the result is just `extent.custom`.
const RESERVED_EXTENT_KEYS = new Set(['spatial', 'temporal', 'vertical', 'custom']);

export function getEffectiveCustomDimensions(extent: Extent | undefined | null): CustomDimension[] {
  if (!extent) return [];
  const out: CustomDimension[] = [...(extent.custom ?? [])];
  const seen = new Set(out.map(d => d.id));

  const raw = extent as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (RESERVED_EXTENT_KEYS.has(key) || seen.has(key)) continue;
    const dim = raw[key];
    if (!dim || typeof dim !== 'object') continue;
    const d = dim as { interval?: unknown; values?: unknown; grid?: { coordinates?: unknown }; crs?: string; uom?: string };
    const gridCoords = Array.isArray(d.grid?.coordinates) ? (d.grid!.coordinates as (number | string)[]) : undefined;
    const values = Array.isArray(d.values) ? (d.values as (number | string)[]) : gridCoords;
    const interval = Array.isArray(d.interval) ? (d.interval as (number | string | null)[]) : undefined;
    // Only treat it as a dimension if it actually carries selectable values or an interval.
    if (!values && !interval) continue;
    out.push({ id: key, values, interval, reference: d.crs ?? d.uom });
    seen.add(key);
  }
  return out;
}

// Utility function to expand custom dimension values for selection
export function expandCustomDimensionValues(dimension: CustomDimension | null | undefined, maxValues: number = 500): string[] {
  const values: string[] = [];

  if (!dimension) {
    return values;
  }

  try {
    // PRIORITIZE dimension.values if it exists
    if (dimension.values && Array.isArray(dimension.values) && dimension.values.length > 0) {
      dimension.values.forEach(value => {
        const strValue = String(value);
        if (!values.includes(strValue)) {
          values.push(strValue);
        }
      });
    }
    // FALLBACK to dimension.interval ONLY if dimension.values is not available
    else if (dimension.interval && Array.isArray(dimension.interval)) {
      for (const interval of dimension.interval) {
        if (!Array.isArray(interval) || interval.length < 2) {
          continue;
        }

        const [minVal, maxVal] = interval;

        // Skip open-ended intervals (we can't expand them)
        if (minVal === null || maxVal === null) {
          continue;
        }

        try {
          // Check if values are numeric
          const isNumeric = typeof minVal === 'number' || !isNaN(parseFloat(String(minVal)));

          if (isNumeric) {
            const min = typeof minVal === 'string' ? parseFloat(minVal) : minVal;
            const max = typeof maxVal === 'string' ? parseFloat(maxVal) : maxVal;

            // Skip invalid values
            if (isNaN(min) || isNaN(max)) {
              continue;
            }

            // Calculate appropriate step size based on range
            const range = Math.abs(max - min);
            let step: number;

            if (range <= 10) {
              step = 0.5;  // Fine granularity for small ranges
            } else if (range <= 100) {
              step = 5;    // Medium granularity
            } else if (range <= 1000) {
              step = 50;   // Coarse granularity
            } else {
              step = 100;  // Very coarse for large ranges
            }

            // Generate values
            let currentValue = min;
            let count = 0;

            while (currentValue <= max && count < maxValues) {
              const strValue = currentValue.toString();
              if (!values.includes(strValue)) {
                values.push(strValue);
              }
              currentValue += step;
              count++;
            }

            // Always include the max value if we haven't reached the limit
            if (count < maxValues) {
              const maxStrValue = max.toString();
              if (!values.includes(maxStrValue)) {
                values.push(maxStrValue);
              }
            }
          } else {
            // For non-numeric values, just include the min and max
            if (!values.includes(String(minVal))) {
              values.push(String(minVal));
            }
            if (!values.includes(String(maxVal))) {
              values.push(String(maxVal));
            }
          }
        } catch (error) {
          console.warn('Error processing custom dimension interval:', interval, error);
        }
      }
    }

    // Try to sort values - numerically if possible, otherwise alphabetically
    try {
      const isAllNumeric = values.every(v => !isNaN(parseFloat(v)));
      if (isAllNumeric) {
        values.sort((a, b) => parseFloat(a) - parseFloat(b));
      } else {
        values.sort();
      }
    } catch (error) {
      console.warn('Error sorting custom dimension values:', error);
    }

  } catch (error) {
    console.error('Error expanding custom dimension values:', error);
  }

  return values;
}
