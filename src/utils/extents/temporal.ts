import type { Temporal } from '../../types/api';

// Utility function to normalize temporal extent to a standard format
export function normalizeTemporal(temporal: Temporal | null | undefined): {
  intervals: [string | null, string | null][];
  values: string[];
  trs: string;
} | null {
  // Handle missing temporal
  if (!temporal) {
    console.log('No temporal extent provided');
    return null;
  }

  try {
    const result = {
      intervals: [] as [string | null, string | null][],
      values: [] as string[],
      trs: temporal.trs || 'Gregorian'
    };

    // Process intervals if they exist
    if (temporal.interval && Array.isArray(temporal.interval)) {
      for (const interval of temporal.interval) {
        if (Array.isArray(interval) && interval.length >= 2) {
          const [start, end] = interval;
          result.intervals.push([start, end]);
        } else if (typeof interval === 'string') {
          // Some APIs incorrectly put individual datetime values in the interval array
          // Treat these as values instead
          result.values.push(interval);
        } else {
          console.warn('Invalid temporal interval format:', interval);
        }
      }
    }

    // Process values if they exist
    if (temporal.values && Array.isArray(temporal.values)) {
      result.values = temporal.values.filter(value => typeof value === 'string');
    }

    return result;
  } catch (error) {
    console.error('Error normalizing temporal extent:', error, 'Input:', temporal);
    return null;
  }
}

// Utility function to format temporal intervals for display
export function formatTemporalInterval(start: string | null, end: string | null): string {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr || dateStr === '..') return 'open';
    try {
      const date = new Date(dateStr);
      // Format: "Nov 1, 2025 06:00" or just date if time is 00:00
      const timeStr = date.toISOString().split('T')[1];
      const hasTime = timeStr && !timeStr.startsWith('00:00:00');

      if (hasTime) {
        const formatted = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC'
        });
        const time = date.toISOString().split('T')[1].substring(0, 5);
        return `${formatted} ${time}`;
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC'
        });
      }
    } catch {
      return dateStr;
    }
  };

  const formattedStart = formatDate(start);
  const formattedEnd = formatDate(end);

  return `${formattedStart} – ${formattedEnd}`;
}

// Utility function to format ISO 8601 date strings for human-readable display
export function formatDateString(dateString: string | null): string {
  if (!dateString || dateString === '..') return 'open';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original if parsing fails
    }

    // Format: "Nov 1, 2025 06:00" or just date if time is 00:00 in UTC
    const timeStr = date.toISOString().split('T')[1];
    const hasTime = timeStr && !timeStr.startsWith('00:00:00');

    if (hasTime) {
      const formatted = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
      });
      const time = date.toISOString().split('T')[1].substring(0, 5);
      return `${formatted} ${time}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
      });
    }
  } catch (error) {
    console.warn('Error formatting date string:', dateString, error);
    return dateString;
  }
}

// Utility function to get the overall temporal extent that encompasses all intervals
export function getOverallTemporalExtent(intervals: [string | null, string | null][]): [string | null, string | null] | null {
  if (!intervals || intervals.length === 0) {
    return null;
  }

  let overallStart: string | null = null;
  let overallEnd: string | null = null;

  for (const [start, end] of intervals) {
    // Handle start times
    if (start !== null) {
      if (overallStart === null || start < overallStart) {
        overallStart = start;
      }
    } else {
      overallStart = null; // If any interval is open at the start, overall is open
    }

    // Handle end times
    if (end !== null) {
      if (overallEnd === null || end > overallEnd) {
        overallEnd = end;
      }
    } else {
      overallEnd = null; // If any interval is open at the end, overall is open
    }
  }

  return [overallStart, overallEnd];
}

// Helper function to parse ISO 8601 duration strings (e.g., PT1M, PT1H, P1D)
function parseDuration(durationStr: string): number | null {
  try {
    // ISO 8601 duration format: P[n]Y[n]M[n]DT[n]H[n]M[n]S
    // Examples: PT1M (1 minute), PT1H (1 hour), P1D (1 day), PT30S (30 seconds)

    const match = durationStr.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);

    if (!match) {
      return null;
    }

    const [, years, months, days, hours, minutes, seconds] = match;

    let milliseconds = 0;

    // Note: Year and month durations are approximate since they vary
    if (years) milliseconds += parseInt(years, 10) * 365 * 24 * 60 * 60 * 1000;
    if (months) milliseconds += parseInt(months, 10) * 30 * 24 * 60 * 60 * 1000;
    if (days) milliseconds += parseInt(days, 10) * 24 * 60 * 60 * 1000;
    if (hours) milliseconds += parseInt(hours, 10) * 60 * 60 * 1000;
    if (minutes) milliseconds += parseInt(minutes, 10) * 60 * 1000;
    if (seconds) milliseconds += parseFloat(seconds) * 1000;

    return milliseconds;
  } catch (error) {
    console.warn('Error parsing duration:', durationStr, error);
    return null;
  }
}

// Utility function to expand temporal extent into individual datetime values for selection
// Prioritizes temporal.values if available, falls back to temporal.interval
export function expandTemporalValues(temporal: Temporal | null | undefined, maxValues: number = 1000): string[] {
  const values: string[] = [];

  if (!temporal) {
    return values;
  }

  // Helper function to expand an interval string (e.g., "2024-01-01T00:00Z/2024-01-02T00:00Z")
  const expandIntervalString = (intervalStr: string): string[] => {
    const expanded: string[] = [];

    // Check for ISO 8601 repeating interval format: R{n}/{start}/{duration}
    // Example: "R1440/2025-11-02T15:26:00Z/PT1M" means 1440 repetitions, starting at 2025-11-02T15:26:00Z, every 1 minute
    const repeatingMatch = intervalStr.match(/^R(\d+)\/([^/]+)\/(.+)$/);
    if (repeatingMatch) {
      const [, repetitionsStr, startStr, durationStr] = repeatingMatch;
      const repetitions = parseInt(repetitionsStr, 10);

      try {
        const startDate = new Date(startStr);
        if (isNaN(startDate.getTime())) {
          console.warn('Invalid start date in repeating interval:', startStr);
          return [];
        }

        // Parse ISO 8601 duration (PT1M, PT1H, P1D, etc.)
        const durationMs = parseDuration(durationStr);
        if (durationMs === null) {
          console.warn('Invalid duration in repeating interval:', durationStr);
          return [];
        }

        // Generate the repeated values
        let currentTime = startDate.getTime();
        for (let i = 0; i < Math.min(repetitions, maxValues); i++) {
          const isoString = new Date(currentTime).toISOString().replace(/\.\d{3}Z$/, 'Z');
          expanded.push(isoString);
          currentTime += durationMs;
        }

        return expanded;
      } catch (error) {
        console.warn('Error processing repeating interval:', intervalStr, error);
        return [];
      }
    }

    // Check if it's a simple interval format (contains "/")
    if (!intervalStr.includes('/')) {
      // Single datetime value
      return [intervalStr];
    }

    const parts = intervalStr.split('/');
    if (parts.length !== 2) {
      console.warn('Invalid interval format:', intervalStr);
      return [];
    }

    const [start, end] = parts;

    try {
      const startDate = new Date(start);
      const endDate = new Date(end);

      // Skip invalid dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.warn('Invalid dates in interval:', intervalStr);
        return [];
      }

      // Calculate time difference
      const timeDiff = endDate.getTime() - startDate.getTime();

      // Determine appropriate step size based on interval length
      let stepMs: number;

      if (timeDiff <= 24 * 60 * 60 * 1000) {
        // Less than 1 day: use hourly steps
        stepMs = 60 * 60 * 1000;
      } else if (timeDiff <= 7 * 24 * 60 * 60 * 1000) {
        // Less than 1 week: use 3-hour steps
        stepMs = 3 * 60 * 60 * 1000;
      } else if (timeDiff <= 31 * 24 * 60 * 60 * 1000) {
        // Less than 1 month: use 6-hour steps
        stepMs = 6 * 60 * 60 * 1000;
      } else if (timeDiff <= 365 * 24 * 60 * 60 * 1000) {
        // Less than 1 year: use daily steps
        stepMs = 24 * 60 * 60 * 1000;
      } else {
        // More than 1 year: use weekly steps
        stepMs = 7 * 24 * 60 * 60 * 1000;
      }

      // Generate time values
      let currentTime = startDate.getTime();
      let count = 0;

      while (currentTime <= endDate.getTime() && count < maxValues) {
        const isoString = new Date(currentTime).toISOString().replace(/\.\d{3}Z$/, 'Z');
        expanded.push(isoString);
        currentTime += stepMs;
        count++;
      }

      // Always include the end time if we haven't reached the limit
      if (count < maxValues) {
        const endIsoString = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
        if (!expanded.includes(endIsoString)) {
          expanded.push(endIsoString);
        }
      }
    } catch (error) {
      console.warn('Error processing interval string:', intervalStr, error);
    }

    return expanded;
  };

  try {
    // PRIORITIZE temporal.values if it exists
    if (temporal.values && Array.isArray(temporal.values) && temporal.values.length > 0) {
      temporal.values.forEach(value => {
        if (value && typeof value === 'string') {
          // Check if value is an interval format (e.g., "2024-01-01T00:00Z/2024-01-02T00:00Z")
          if (value.includes('/')) {
            const expandedValues = expandIntervalString(value);
            expandedValues.forEach(v => {
              if (!values.includes(v)) {
                values.push(v);
              }
            });
          } else {
            // Single datetime value
            if (!values.includes(value)) {
              values.push(value);
            }
          }
        }
      });
    }
    // FALLBACK to temporal.interval ONLY if temporal.values is not available
    else if (temporal.interval && Array.isArray(temporal.interval)) {
      for (const interval of temporal.interval) {
        if (!Array.isArray(interval) || interval.length < 2) {
          continue;
        }

        const [start, end] = interval;

        // Skip open-ended intervals (we can't expand them)
        if (start === null || end === null) {
          continue;
        }

        try {
          const startDate = new Date(start);
          const endDate = new Date(end);

          // Skip invalid dates
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            continue;
          }

          // Calculate time difference
          const timeDiff = endDate.getTime() - startDate.getTime();

          // Determine appropriate step size based on interval length
          let stepMs: number;

          if (timeDiff <= 24 * 60 * 60 * 1000) {
            // Less than 1 day: use hourly steps
            stepMs = 60 * 60 * 1000;
          } else if (timeDiff <= 7 * 24 * 60 * 60 * 1000) {
            // Less than 1 week: use 3-hour steps
            stepMs = 3 * 60 * 60 * 1000;
          } else if (timeDiff <= 31 * 24 * 60 * 60 * 1000) {
            // Less than 1 month: use 6-hour steps
            stepMs = 6 * 60 * 60 * 1000;
          } else if (timeDiff <= 365 * 24 * 60 * 60 * 1000) {
            // Less than 1 year: use daily steps
            stepMs = 24 * 60 * 60 * 1000;
          } else {
            // More than 1 year: use weekly steps
            stepMs = 7 * 24 * 60 * 60 * 1000;
          }

          // Generate time values
          let currentTime = startDate.getTime();
          let count = 0;

          while (currentTime <= endDate.getTime() && count < maxValues) {
            const isoString = new Date(currentTime).toISOString().replace(/\.\d{3}Z$/, 'Z');
            if (!values.includes(isoString)) {
              values.push(isoString);
            }
            currentTime += stepMs;
            count++;
          }

          // Always include the end time if we haven't reached the limit
          if (count < maxValues) {
            const endIsoString = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
            if (!values.includes(endIsoString)) {
              values.push(endIsoString);
            }
          }
        } catch (error) {
          console.warn('Error processing temporal interval:', interval, error);
        }
      }
    }

    // Sort values chronologically and remove duplicates
    const uniqueValues = Array.from(new Set(values)).sort();

    // Limit to maxValues
    return uniqueValues.slice(0, maxValues);
  } catch (error) {
    console.error('Error expanding temporal values:', error);
    return [];
  }
}
