import axios from 'axios';
import SchemaValidator from './SchemaValidator';

export interface DataQuery {
    link: Link;
}

export interface DataQueries {
    [key: string]: DataQuery;
}

export interface Link {
    title?: string;
    href: string;
    rel: string;
    type: string;
    variables: any;
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

export interface Extent {
    spatial?: Spatial; // Made optional to handle empty extent objects
    temporal?: Temporal; // Made optional to handle missing temporal extent
    vertical?: Vertical; // Made optional to handle missing vertical extent
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
  output_formats: string[];
  parameter_names?: parameterNames[] | { [key: string]: ParameterDefinition }; // Support both formats
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    message: string;
    type?: 'cors' | 'network' | 'schema' | 'unknown';
  }> | null;
  schemaCount?: number;
  schemaUrls?: string[];
}

interface CollectionsResponse {
  collections: Collection[];
}

export interface GetCollectionsResult {
  collections: Collection[];
  validation: ValidationResult;
}

export interface LocationQueryResult {
  type: string;
  features: any[];
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
export async function executeLocationQuery(queryUrl: string): Promise<LocationQueryResult | null> {
  try {
    console.log('Executing location query:', queryUrl);
    
    // Add f=json format parameter if not already present
    const url = new URL(queryUrl);
    if (!url.searchParams.has('f')) {
      url.searchParams.set('f', 'json');
    }
    
    const response = await axios.get(url.toString());
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
      console.log('Processing bbox as array of bbox arrays (EDR standard):', bboxArrays);
      
      const validBboxes: [number, number, number, number][] = [];
      
      for (const singleBbox of bboxArrays) {
        if (Array.isArray(singleBbox) && singleBbox.length >= 4) {
          const [west, south, east, north] = singleBbox;
          
          // Validate that all coordinates are valid numbers
          if (typeof west === 'number' && typeof south === 'number' && 
              typeof east === 'number' && typeof north === 'number' &&
              isFinite(west) && isFinite(south) && isFinite(east) && isFinite(north)) {
            validBboxes.push([west, south, east, north]);
            console.log(`Valid bbox found: west=${west}, south=${south}, east=${east}, north=${north}`);
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
      console.log('Processing bbox as flat array (legacy format):', flatBbox);
      
      if (flatBbox.length >= 4) {
        const [west, south, east, north] = flatBbox;
        
        // Validate that all coordinates are valid numbers
        if (typeof west === 'number' && typeof south === 'number' && 
            typeof east === 'number' && typeof north === 'number' &&
            isFinite(west) && isFinite(south) && isFinite(east) && isFinite(north)) {
          console.log(`Extracted coordinates: west=${west}, south=${south}, east=${east}, north=${north}`);
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
      console.log('Processing temporal intervals:', temporal.interval);
      
      for (const interval of temporal.interval) {
        if (Array.isArray(interval) && interval.length >= 2) {
          const [start, end] = interval;
          result.intervals.push([start, end]);
          console.log(`Valid temporal interval: ${start} to ${end}`);
        } else {
          console.warn('Invalid temporal interval format:', interval);
        }
      }
    }

    // Process values if they exist
    if (temporal.values && Array.isArray(temporal.values)) {
      console.log('Processing temporal values:', temporal.values.length, 'values');
      result.values = temporal.values.filter(value => typeof value === 'string');
    }

    console.log(`Normalized temporal extent: ${result.intervals.length} intervals, ${result.values.length} values`);
    return result;
  } catch (error) {
    console.error('Error normalizing temporal extent:', error, 'Input:', temporal);
    return null;
  }
}

// Utility function to format temporal intervals for display
export function formatTemporalInterval(start: string | null, end: string | null): string {
  if (start === null && end === null) {
    return 'All time';
  } else if (start === null) {
    return `Until ${formatDateString(end)}`;
  } else if (end === null) {
    return `From ${formatDateString(start)}`;
  } else {
    return `${formatDateString(start)} to ${formatDateString(end)}`;
  }
}

// Utility function to format ISO 8601 date strings for human-readable display
export function formatDateString(dateString: string | null): string {
  if (!dateString) return 'Open';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original if parsing fails
    }
    
    // Format as locale-specific date and time
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
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
      console.log('Processing vertical intervals:', vertical.interval);
      
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
          console.log(`Valid vertical interval: ${min} to ${max}`);
        } else {
          console.warn('Invalid vertical interval format:', interval);
        }
      }
    }

    // Process values if they exist - handle both string and number values
    if (vertical.values && Array.isArray(vertical.values)) {
      console.log('Processing vertical values:', vertical.values.length, 'values');
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

    console.log(`Normalized vertical extent: ${result.intervals.length} intervals, ${result.values.length} values`);
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

export async function getCollections(apiUrl: string): Promise<GetCollectionsResult> {
  // Initialize the schema validator outside the try block so it's accessible in the catch block
  const validator = SchemaValidator.getInstance();
  
  try {
    // Load the schema if not already loaded
    if (!validator.isLoaded()) {
      await validator.loadSchema();
    }

    // Fetch data from API
    console.log('Fetching collections from:', apiUrl);
    const response = await axios.get<CollectionsResponse>(apiUrl);
    const data = response.data;
    console.log('Raw API response:', data);

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

    // Perform validation with the enhanced async method
    const validationResult = await validator.validateCollections(data);

    // Log validation details
    console.log(`Schema validation result: ${validationResult.valid ? 'Valid' : 'Invalid'}`);
    console.log(`Loaded schema count: ${validator.getLoadedSchemaCount()}`);
    
    // Even if validation fails, still return any collections we found
    return {
      collections: collections,
      validation: {
        isValid: validationResult.valid,
        errors: validationResult.errors,
        schemaCount: validator.getLoadedSchemaCount(),
        schemaUrls: validator.getLoadedSchemaUrls()
      }
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
      }
    };
  }
}