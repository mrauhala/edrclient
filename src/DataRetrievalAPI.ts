import axios from 'axios';
import SchemaValidator from './SchemaValidator';

export interface AuthCredentials {
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyParam?: string;
    bearerToken?: string;
}

// Helper function to create axios config with basic auth if credentials are provided
function getAxiosConfig(auth?: AuthCredentials) {
  const config: any = {};
  
  if (auth) {
    // Bearer token authentication (takes precedence)
    if (auth.bearerToken) {
      config.headers = {
        'Authorization': `Bearer ${auth.bearerToken}`
      };
    }
    // Basic authentication
    else if (auth.username) {
      config.auth = {
        username: auth.username,
        password: auth.password || ''
      };
    }
  }
  
  return config;
}

// Helper function to add API key to URL if provided
function addApiKeyToUrl(url: string, auth?: AuthCredentials): string {
  if (auth && auth.apiKey) {
    const urlObj = new URL(url);
    const paramName = auth.apiKeyParam || 'api-key';
    urlObj.searchParams.set(paramName, auth.apiKey);
    return urlObj.toString();
  }
  return url;
}

export interface DataQuery {
    link: Link;
}

export interface DataQueries {
    [key: string]: DataQuery;
}

export interface QueryVariables {
    default_output_format?: string;
    output_formats?: string[];
    [key: string]: any; // Allow other query-specific variables
}

export interface Link {
    title?: string;
    href: string;
    rel: string;
    type: string;
    variables?: QueryVariables;
}

export interface Spatial {
    bbox?: number[][] | number[]; // EDR standard: array of bbox arrays, or legacy flat array - now optional
    crs?: string; // Also optional since some extents might be empty
} 

export interface Temporal {
    interval?: (string | null)[][]; // Array of ISO 8601 date interval arrays, null values indicate open intervals
    values?: string[]; // Array of ISO 8601 datestrings for specific time points/intervals
    trs?: string; // Temporal reference system, defaults to Gregorian
}

export interface Vertical {
    interval?: (number | string | null)[][]; // Array of level value arrays, can be strings or numbers for min/max vertical levels
    values?: (number | string)[]; // Array of height values supported by the collection, can be strings or numbers
    vrs?: string; // Vertical reference system, follows Well Known Text standard
}

export interface CustomDimension {
    id: string; // Dimension name/identifier
    interval?: (number | string | null)[]; // Min/max values for the dimension
    reference?: string; // Reference/unit for the dimension (e.g., "minutes")
    values?: (number | string)[]; // Specific values supported by the dimension
}

export interface Extent {
    spatial?: Spatial; // Made optional to handle empty extent objects
    temporal?: Temporal; // Made optional to handle missing temporal extent
    vertical?: Vertical; // Made optional to handle missing vertical extent
    custom?: CustomDimension[]; // Custom dimensions array
} 

export interface parameterNames {
    id: string;
    type: string;
    label?: string;
    description?: string;
    observedProperty: any;
}

// Aviation Weather specific parameter structure
export interface ParameterDefinition {
    id?: string;
    type?: string;
    description?: string;
    unit?: any;
    observedProperty?: any;
}

export interface Collection {
  id: string;
  title?: string;
  description?: string;
  keywords?: string[];
  links: Link[];
  data_queries: DataQueries;
  extent?: Extent; // Made optional to handle missing or empty extent
  crs: string[];
  output_formats: string[] | null; // Can be null in non-conforming APIs
  parameter_names?: parameterNames[] | { [key: string]: ParameterDefinition }; // Support both formats
  itemType?: string; // Optional item type field
}

export interface ValidationError {
  message: string;
  type?: 'cors' | 'network' | 'schema' | 'unknown';
  path?: string;
  keyword?: string;
  allowedValues?: any;
  schema?: any;
  data?: any;
  collectionId?: string;
  section?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[] | null;
  schemaCount?: number;
  schemaUrls?: string[];
  collectionErrors?: { [collectionId: string]: ValidationError[] };
  landingPageValidation?: {
    isValid: boolean;
    errors: ValidationError[] | null;
  };
  collectionsValidation?: {
    isValid: boolean;
    errors: ValidationError[] | null;
  };
  conformanceValidation?: {
    isValid: boolean;
    errors: ValidationError[] | null;
  };
}

interface CollectionsResponse {
  collections: Collection[];
}

export interface LandingPage {
  title?: string;
  description?: string;
  links: Link[];
}

export interface GetCollectionsResult {
  collections: Collection[];
  validation: ValidationResult;
  landingPageUrl?: string;
  collectionsUrl?: string;
  conformanceUrl?: string;
  landingPageTitle?: string;
  landingPageDescription?: string;
  serviceDescUrl?: string;
  conformsTo?: string[]; // OGC API conformance classes
  landingPageLinks?: Link[]; // Links from the landing page
}

export interface LocationQueryResult {
  type: string;
  features: any[];
}

// Function to get all supported data query types for a collection
export function getSupportedDataQueries(collection: Collection): string[] {
  try {
    if (!collection || !collection.data_queries || typeof collection.data_queries !== 'object') {
      return [];
    }
    
    const supportedQueries: string[] = [];
    const queryTypes = Object.keys(collection.data_queries);
    
    for (const queryType of queryTypes) {
      const query = collection.data_queries[queryType];
      // Check if the query has a valid link
      if (query && query.link && query.link.href) {
        supportedQueries.push(queryType);
      }
    }
    
    return supportedQueries.sort(); // Sort alphabetically for consistent display
  } catch (error) {
    console.warn('Error getting supported data queries:', error);
    return [];
  }
}

// Function to check if a collection supports location queries
export function hasLocationQuery(collection: Collection): boolean {
  try {
    if (!collection || !collection.data_queries || typeof collection.data_queries !== 'object') {
      return false;
    }
    
    // Check if there's a 'locations' key in data_queries
    const locationsQuery = collection.data_queries['locations'];
    return !!locationsQuery && 
           !!locationsQuery.link &&
           !!locationsQuery.link.href;
  } catch (error) {
    console.warn('Error checking for location query:', error);
    return false;
  }
}

// Function to get the location query URL for a collection
export function getLocationQueryUrl(collection: Collection): string | null {
  try {
    if (!collection || !collection.data_queries || typeof collection.data_queries !== 'object') {
      return null;
    }
    
    const locationsQuery = collection.data_queries['locations'];
    return locationsQuery && locationsQuery.link ? locationsQuery.link.href : null;
  } catch (error) {
    console.warn('Error getting location query URL:', error);
    return null;
  }
}

// Function to execute a location query
export async function executeLocationQuery(queryUrl: string, auth?: AuthCredentials): Promise<LocationQueryResult | null> {
  try {
    console.log('Executing location query:', queryUrl);
    
    // Add f=json format parameter if not already present
    const url = new URL(queryUrl);
    if (!url.searchParams.has('f')) {
      url.searchParams.set('f', 'json');
    }
    
    // Add API key if provided
    const finalUrl = addApiKeyToUrl(url.toString(), auth);
    
    const response = await axios.get(finalUrl, getAxiosConfig(auth));
    const data = response.data;
    
    // Validate that we got GeoJSON
    if (data && typeof data === 'object' && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      console.log(`Location query returned ${data.features.length} features`);
      return data;
    } else if (data && typeof data === 'object' && data.type === 'Feature') {
      // Single feature response
      console.log('Location query returned a single feature');
      return {
        type: 'FeatureCollection',
        features: [data]
      };
    } else {
      console.warn('Location query did not return valid GeoJSON:', data);
      return null;
    }
  } catch (error) {
    console.error('Error executing location query:', error);
    return null;
  }
}

// Function to format OGC API conformance classes for display
export function formatConformanceClass(url: string): string | null {
  try {
    // Only process OGC API conformance URLs
    if (!url.includes('ogcapi-')) {
      return null;
    }
    
    // Extract the relevant parts after ogcapi-
    // Pattern: http://www.opengis.net/spec/ogcapi-{standard}-{partNum}/{version}/conf/{confName}
    // or: http://www.opengis.net/spec/ogcapi-{standard}/{version}/conf/{confName}
    const match = url.match(/ogcapi-([^/]+)\/([^/]+)\/conf\/(.+)/);
    if (!match) {
      // Fallback to simple pattern without conf path
      const simpleMatch = url.match(/ogcapi-([^/]+)\/([^/]+)/);
      if (!simpleMatch) {
        return null;
      }
      
      const [, standardWithPart, version] = simpleMatch;
      
      // Check if standard has a part number (e.g., "edr-1")
      const partMatch = standardWithPart.match(/^(.+)-(\d+)$/);
      if (partMatch) {
        const [, standardName, partNum] = partMatch;
        const formattedStandard = standardName.toUpperCase();
        return `OGC API - ${formattedStandard} - Part ${partNum} (v${version})`;
      }
      
      const formattedStandard = standardWithPart
        .split('-')
        .map(word => word.toUpperCase())
        .join(' ');
      
      return `OGC API - ${formattedStandard} (v${version})`;
    }
    
    const [, standardWithPart, version, confPath] = match;
    
    // Check if standard has a part number suffix (e.g., "edr-1", "common-1")
    let standardName = standardWithPart;
    let partNum = '1'; // Default to part 1
    
    const standardPartMatch = standardWithPart.match(/^(.+)-(\d+)$/);
    if (standardPartMatch) {
      standardName = standardPartMatch[1];
      partNum = standardPartMatch[2];
    }
    
    // Format the standard name - convert to uppercase
    const formattedStandard = standardName.toUpperCase();
    
    // Format the conf path name (capitalize first letter)
    const formattedConfName = confPath
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return `OGC API - ${formattedStandard} - Part ${partNum}: ${formattedConfName} (v${version})`;
  } catch (error) {
    console.warn('Error formatting conformance class:', error);
    return null;
  }
}

// Utility function to normalize bbox to array of [west, south, east, north] format
export function normalizeBbox(bbox: number[][] | number[] | null | undefined): [number, number, number, number][] | null {
  // Validate input exists and is an array
  if (!bbox || !Array.isArray(bbox) || bbox.length === 0) {
    console.warn('Invalid bbox: not an array or empty', bbox);
    return null;
  }

  try {
    // Handle EDR standard format: array of bbox arrays
    if (Array.isArray(bbox[0])) {
      const bboxArrays = bbox as number[][];
      
      const validBboxes: [number, number, number, number][] = [];
      
      for (const singleBbox of bboxArrays) {
        if (Array.isArray(singleBbox) && singleBbox.length >= 4) {
          const [west, south, east, north] = singleBbox;
          
          // Validate that all coordinates are valid numbers
          if (typeof west === 'number' && typeof south === 'number' && 
              typeof east === 'number' && typeof north === 'number' &&
              isFinite(west) && isFinite(south) && isFinite(east) && isFinite(north)) {
            validBboxes.push([west, south, east, north]);
          } else {
            console.warn('Invalid bbox coordinates (not finite numbers):', singleBbox);
          }
        } else {
          console.warn('Invalid bbox in array (not array or insufficient length):', singleBbox);
        }
      }
      
      if (validBboxes.length > 0) {
        return validBboxes;
      }
    }
    
    // Handle legacy flat array format (non-standard but common)
    if (typeof bbox[0] === 'number') {
      const flatBbox = bbox as number[];
      
      if (flatBbox.length >= 4) {
        const [west, south, east, north] = flatBbox;
        
        // Validate that all coordinates are valid numbers
        if (typeof west === 'number' && typeof south === 'number' && 
            typeof east === 'number' && typeof north === 'number' &&
            isFinite(west) && isFinite(south) && isFinite(east) && isFinite(north)) {
          return [[west, south, east, north]];
        } else {
          console.warn('Invalid flat bbox coordinates (not finite numbers):', flatBbox);
        }
      } else {
        console.warn('Invalid flat bbox format: insufficient coordinates', flatBbox);
      }
    }

    console.warn('Unable to normalize bbox format:', bbox);
    return null;
  } catch (error) {
    console.error('Error in normalizeBbox:', error, 'Input:', bbox);
    return null;
  }
}

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
export function getOverallExtent(bboxes: [number, number, number, number][]): [number, number, number, number] | null {
  if (!bboxes || bboxes.length === 0) {
    return null;
  }
  
  let minWest = Number.POSITIVE_INFINITY;
  let minSouth = Number.POSITIVE_INFINITY;
  let maxEast = Number.NEGATIVE_INFINITY;
  let maxNorth = Number.NEGATIVE_INFINITY;
  
  for (const [west, south, east, north] of bboxes) {
    minWest = Math.min(minWest, west);
    minSouth = Math.min(minSouth, south);
    maxEast = Math.max(maxEast, east);
    maxNorth = Math.max(maxNorth, north);
  }
  
  return [minWest, minSouth, maxEast, maxNorth];
}

export async function getCollections(apiUrl: string, auth?: AuthCredentials): Promise<GetCollectionsResult> {
  // Initialize the schema validator outside the try block so it's accessible in the catch block
  const validator = SchemaValidator.getInstance();
  
  try {
    // Check if this is DMI service (to avoid f=json bug)
    const isDMI = apiUrl.includes('api.meteogate.eu/dk/edr');

    // Step 1: Fetch and validate the landing page
    console.log('Step 1: Fetching landing page from:', apiUrl);
    
    // Add f=json format parameter if not already present
    // Skip for DMI service as it incorrectly includes f=json in the href paths
    const landingPageUrl = new URL(apiUrl);
    if (!landingPageUrl.searchParams.has('f') && !isDMI) {
      landingPageUrl.searchParams.set('f', 'json');
    }
    
    // Add API key if provided
    const finalLandingPageUrl = addApiKeyToUrl(landingPageUrl.toString(), auth);
    
    const landingPageResponse = await axios.get<LandingPage>(finalLandingPageUrl, getAxiosConfig(auth));
    const landingPageData = landingPageResponse.data;

    // Step 2: Extract the collections URL and conformance URL from landing page links
    let collectionsUrl: string | null = null;
    let serviceDescUrl: string | null = null;
    let conformanceUrl: string | null = null;
    
    if (landingPageData && landingPageData.links && Array.isArray(landingPageData.links)) {
      // Look for a link with rel='data' or rel='http://www.opengis.net/def/rel/ogc/1.0/data'
      const dataLink = landingPageData.links.find(
        (link: Link) => link.rel === 'data' || 
                       link.rel === 'http://www.opengis.net/def/rel/ogc/1.0/data'
      );
      
      // Look for a link with rel='service-desc' for OpenAPI/Swagger documentation
      const serviceDescLink = landingPageData.links.find(
        (link: Link) => link.rel === 'service-desc' || 
                       link.rel === 'http://www.opengis.net/def/rel/ogc/1.0/service-desc'
      );
      
      // Look for conformance link
      const conformanceLink = landingPageData.links.find(
        (link: Link) => link.rel === 'conformance' || 
                       link.rel === 'http://www.opengis.net/def/rel/ogc/1.0/conformance'
      );
      
      if (dataLink && dataLink.href) {
        collectionsUrl = dataLink.href;
        console.log('Found collections URL from landing page:', collectionsUrl);
      } else {
        console.warn('No data link found in landing page. Available links:', 
          landingPageData.links.map((l: Link) => ({ rel: l.rel, href: l.href })));
        
        // Fallback: try appending /collections to the base URL
        collectionsUrl = `${apiUrl}/collections`;
        console.log('Using fallback collections URL:', collectionsUrl);
      }
      
      if (serviceDescLink && serviceDescLink.href) {
        serviceDescUrl = serviceDescLink.href;
        console.log('Found service description URL from landing page:', serviceDescUrl);
      }
      
      if (conformanceLink && conformanceLink.href) {
        conformanceUrl = conformanceLink.href;
        console.log('Found conformance URL from landing page:', conformanceUrl);
      }
    } else {
      console.warn('Landing page has no links array. Using fallback.');
      collectionsUrl = `${apiUrl}/collections`;
    }

    // Step 3: Fetch conformance classes to determine which schema to use
    let conformsTo: string[] | undefined = undefined;
    if (conformanceUrl) {
      try {
        console.log('Step 2: Fetching conformance to determine schema type:', conformanceUrl);
        const conformanceUrlWithFormat = new URL(conformanceUrl);
        if (!conformanceUrlWithFormat.searchParams.has('f')) {
          conformanceUrlWithFormat.searchParams.set('f', 'json');
        }
        
        // Add API key if provided
        const finalConformanceUrl = addApiKeyToUrl(conformanceUrlWithFormat.toString(), auth);
        
        const conformanceResponse = await axios.get<{ conformsTo: string[] }>(finalConformanceUrl, getAxiosConfig(auth));
        
        if (conformanceResponse.data && conformanceResponse.data.conformsTo) {
          conformsTo = conformanceResponse.data.conformsTo;
          console.log(`Found ${conformsTo.length} conformance classes:`, conformsTo);
        }
      } catch (error) {
        console.warn('Error fetching conformance, will use default schema:', error);
        // Don't fail - we'll use the default schema
      }
    }

    // Step 4: Load the appropriate schema based on conformance classes
    // Always call this to ensure we have the right schema type
    await validator.loadSchemaBasedOnConformance(conformsTo);

    // Step 5: Validate landing page with the loaded schema
    const landingPageValidation = await validator.validateLandingPage(landingPageData);
    console.log(`Landing page validation result: ${landingPageValidation.valid ? 'Valid' : 'Invalid'}`);

    // Step 6: Fetch collections from the discovered URL
    console.log('Step 3: Fetching collections from:', collectionsUrl);
    
    // Add f=json format parameter if not already present
    // Skip for DMI service as it incorrectly includes f=json in the href paths
    const collectionsUrlWithFormat = new URL(collectionsUrl);
    if (!collectionsUrlWithFormat.searchParams.has('f') && !isDMI) {
      collectionsUrlWithFormat.searchParams.set('f', 'json');
    }
    
    // Add API key if provided
    const finalCollectionsUrl = addApiKeyToUrl(collectionsUrlWithFormat.toString(), auth);
    
    const response = await axios.get<CollectionsResponse>(finalCollectionsUrl, getAxiosConfig(auth));
    const data = response.data;

    let collections: Collection[] = [];
    
    // Extract collections from the response safely
    if (data && typeof data === 'object') {
      if (data.collections && Array.isArray(data.collections)) {
        collections = data.collections;
        console.log(`Found ${collections.length} collections in response.collections`);
      } else if (Array.isArray(data)) {
        // Some APIs might return collections directly as an array
        collections = data;
        console.log(`Found ${collections.length} collections as direct array`);
      } else {
        console.warn('No collections found in response structure:', Object.keys(data));
      }
    }

    // Step 7: Validate collections
    const collectionsValidation = await validator.validateCollections(data);
    console.log(`Collections validation result: ${collectionsValidation.valid ? 'Valid' : 'Invalid'}`);
    console.log(`Loaded schema count: ${validator.getLoadedSchemaCount()}`);
    
    // Step 8: Validate conformance response if we fetched it
    let conformanceValidation: { valid: boolean; errors: any[] | null } = { valid: true, errors: null };
    if (conformanceUrl && conformsTo) {
      // Validate conformance response we already fetched
      conformanceValidation = await validator.validateConformance({ conformsTo });
      console.log(`Conformance validation result: ${conformanceValidation.valid ? 'Valid' : 'Invalid'}`);
    }
    
    // Combine all validation results
    const combinedValidation: ValidationResult = {
      isValid: landingPageValidation.valid && collectionsValidation.valid && conformanceValidation.valid,
      errors: [
        ...(landingPageValidation.errors || []),
        ...(collectionsValidation.errors || []),
        ...(conformanceValidation.errors || [])
      ],
      schemaCount: validator.getLoadedSchemaCount(),
      schemaUrls: validator.getLoadedSchemaUrls(),
      collectionErrors: collectionsValidation.collectionErrors,
      landingPageValidation: {
        isValid: landingPageValidation.valid,
        errors: landingPageValidation.errors
      },
      collectionsValidation: {
        isValid: collectionsValidation.valid,
        errors: collectionsValidation.errors
      },
      conformanceValidation: {
        isValid: conformanceValidation.valid,
        errors: conformanceValidation.errors
      }
    };

    // If no errors, set errors to null
    if (combinedValidation.errors && combinedValidation.errors.length === 0) {
      combinedValidation.errors = null;
    }
    
    // Even if validation fails, still return any collections we found
    return {
      collections: collections,
      validation: combinedValidation,
      landingPageUrl: apiUrl,
      collectionsUrl: collectionsUrl,
      conformanceUrl: conformanceUrl || undefined,
      landingPageTitle: landingPageData?.title,
      landingPageDescription: landingPageData?.description,
      serviceDescUrl: serviceDescUrl || undefined,
      conformsTo: conformsTo,
      landingPageLinks: landingPageData?.links
    };
  } catch (error) {
    console.error('Error fetching collections:', error);
    
    // Check if this is a CORS error
    let errorMessage = 'Unknown error fetching collections';
    let errorType: 'cors' | 'network' | 'unknown' = 'unknown';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      // Common CORS error indicators
      if (error.message.includes('CORS') || 
          error.message.includes('Access-Control-Allow-Origin') ||
          error.message.includes('cross-origin')) {
        errorType = 'cors';
        errorMessage = `CORS Error: This endpoint (${apiUrl}) does not allow cross-origin requests from web browsers. The service may not have proper CORS headers configured.`;
      } else if (error.message.includes('Network Error') ||
                 error.message.includes('ERR_NETWORK') ||
                 error.message.includes('Failed to fetch')) {
        errorType = 'network';
        errorMessage = `Network Error: Unable to connect to ${apiUrl}. This may be due to CORS restrictions or the service being unavailable.`;
      }
    }
    
    // Check for axios-specific error properties
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ERR_NETWORK') {
        errorType = 'cors';
        errorMessage = `CORS Error: ${apiUrl} does not allow cross-origin requests. The server needs to include proper CORS headers.`;
      }
    }
    
    // If there's an error with the request, return empty collections and the error
    return {
      collections: [],
      validation: {
        isValid: false,
        errors: [{ 
          message: errorMessage,
          type: errorType
        }],
        schemaCount: validator.isLoaded() ? validator.getLoadedSchemaCount() : 0,
        schemaUrls: validator.isLoaded() ? validator.getLoadedSchemaUrls() : []
      },
      landingPageUrl: apiUrl
    };
  }
}