import type { Vertical } from '../../types/api';

// Utility function to normalize vertical extent to a standard format
export function normalizeVertical(vertical: Vertical | null | undefined): {
  intervals: [number | null, number | null][];
  values: number[];
  vrs: string;
} | null {
  // Handle missing vertical
  if (!vertical) {
    console.log('No vertical extent provided');
    return null;
  }

  try {
    const result = {
      intervals: [] as [number | null, number | null][],
      values: [] as number[],
      vrs: vertical.vrs || 'Unknown'
    };

    // Process intervals if they exist
    if (vertical.interval && Array.isArray(vertical.interval)) {
      for (const interval of vertical.interval) {
        if (Array.isArray(interval) && interval.length >= 2) {
          // Convert string values to numbers, handle both number and string inputs
          const min = interval[0] === null ? null : (typeof interval[0] === 'string' ? parseFloat(interval[0]) : interval[0]);
          const max = interval[1] === null ? null : (typeof interval[1] === 'string' ? parseFloat(interval[1]) : interval[1]);

          // Only add if conversion was successful
          if (min !== null && isNaN(min)) {
            console.warn('Invalid vertical interval min value:', interval[0]);
            continue;
          }
          if (max !== null && isNaN(max)) {
            console.warn('Invalid vertical interval max value:', interval[1]);
            continue;
          }

          result.intervals.push([min, max]);
        } else {
          console.warn('Invalid vertical interval format:', interval);
        }
      }
    }

    // Process values if they exist - handle both string and number values
    if (vertical.values && Array.isArray(vertical.values)) {
      for (const value of vertical.values) {
        let numValue: number;
        if (typeof value === 'string') {
          numValue = parseFloat(value);
        } else if (typeof value === 'number') {
          numValue = value;
        } else {
          console.warn('Invalid vertical value type:', typeof value, value);
          continue;
        }

        if (!isNaN(numValue) && isFinite(numValue)) {
          result.values.push(numValue);
        } else {
          console.warn('Invalid vertical value:', value);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error normalizing vertical extent:', error, 'Input:', vertical);
    return null;
  }
}

// Utility function to expand vertical extent into individual level values for selection
export function expandVerticalValues(vertical: Vertical | null | undefined, maxValues: number = 500): string[] {
  const values: string[] = [];

  if (!vertical) {
    return values;
  }

  try {
    // PRIORITIZE vertical.values if it exists
    if (vertical.values && Array.isArray(vertical.values) && vertical.values.length > 0) {
      vertical.values.forEach(value => {
        const strValue = String(value);
        if (!values.includes(strValue)) {
          values.push(strValue);
        }
      });
    }
    // FALLBACK to vertical.interval ONLY if vertical.values is not available
    else if (vertical.interval && Array.isArray(vertical.interval)) {
      for (const interval of vertical.interval) {
        if (!Array.isArray(interval) || interval.length < 2) {
          continue;
        }

        const [minVal, maxVal] = interval;

        // Skip open-ended intervals (we can't expand them)
        if (minVal === null || maxVal === null) {
          continue;
        }

        try {
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
        } catch (error) {
          console.warn('Error processing vertical interval:', interval, error);
        }
      }
    }

    // Sort values numerically
    values.sort((a, b) => parseFloat(a) - parseFloat(b));

  } catch (error) {
    console.error('Error expanding vertical values:', error);
  }

  return values;
}

// Utility function to format vertical intervals for display
export function formatVerticalInterval(min: number | null, max: number | null, unit?: string): string {
  const unitSuffix = unit ? ` ${unit}` : '';

  if (min === null && max === null) {
    return 'All levels';
  } else if (min === null) {
    return `Up to ${formatVerticalValue(max)}${unitSuffix}`;
  } else if (max === null) {
    return `From ${formatVerticalValue(min)}${unitSuffix}`;
  } else {
    return `${formatVerticalValue(min)} to ${formatVerticalValue(max)}${unitSuffix}`;
  }
}

// Utility function to format vertical values for display
export function formatVerticalValue(value: number | null): string {
  if (value === null) return 'Open';

  // Format numbers with appropriate precision
  if (Number.isInteger(value)) {
    return value.toString();
  } else {
    return value.toFixed(2);
  }
}

// Utility function to get the overall vertical extent that encompasses all intervals
export function getOverallVerticalExtent(intervals: [number | null, number | null][]): [number | null, number | null] | null {
  if (!intervals || intervals.length === 0) {
    return null;
  }

  let overallMin: number | null = null;
  let overallMax: number | null = null;

  for (const [min, max] of intervals) {
    // Handle minimum values
    if (min !== null) {
      if (overallMin === null || min < overallMin) {
        overallMin = min;
      }
    } else {
      overallMin = null; // If any interval is open at the minimum, overall is open
    }

    // Handle maximum values
    if (max !== null) {
      if (overallMax === null || max > overallMax) {
        overallMax = max;
      }
    } else {
      overallMax = null; // If any interval is open at the maximum, overall is open
    }
  }

  return [overallMin, overallMax];
}

// Utility function to extract unit information from VRS string
export function getVerticalUnit(vrs: string): string {
  if (!vrs) return '';

  // Extract unit from common VRS patterns
  if (vrs.includes('metre') || vrs.includes('meter')) return 'm';
  if (vrs.includes('foot') || vrs.includes('feet')) return 'ft';
  if (vrs.includes('hPa') || vrs.includes('hectopascal')) return 'hPa';
  if (vrs.includes('Pa') || vrs.includes('pascal')) return 'Pa';
  if (vrs.includes('mbar') || vrs.includes('millibar')) return 'mbar';
  if (vrs.includes('level')) return 'level';

  // Default return empty string if no unit found
  return '';
}
