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
    bbox: number[][] | number[]; // EDR standard: array of bbox arrays, or legacy flat array
    crs: string;
} 

export interface Extent {
    spatial: Spatial;
    temporal: any;
} 

export interface parameterNames {
    id: string;
    type: string;
    label?: string;
    description?: string;
    observedProperty: any;
}

export interface Collection {
  id: string;
  title?: string;
  description?: string;
  keywords?: string[];
  links: Link[];
  data_queries: DataQueries;
  extent: Extent;
  crs: string[];
  output_formats: string[];
  parameter_names: parameterNames[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: any[] | null;
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
export function normalizeBbox(bbox: number[][] | number[]): [number, number, number, number][] | null {
  if (!bbox || !Array.isArray(bbox)) {
    console.warn('Invalid bbox: not an array', bbox);
    return null;
  }

  // Handle EDR standard format: array of bbox arrays
  if (Array.isArray(bbox[0])) {
    const bboxArrays = bbox as number[][];
    console.log('Processing bbox as array of bbox arrays (EDR standard):', bboxArrays);
    
    const validBboxes: [number, number, number, number][] = [];
    
    for (const singleBbox of bboxArrays) {
      if (Array.isArray(singleBbox) && singleBbox.length >= 4) {
        const [west, south, east, north] = singleBbox;
        validBboxes.push([west, south, east, north]);
        console.log(`Valid bbox found: west=${west}, south=${south}, east=${east}, north=${north}`);
      } else {
        console.warn('Invalid bbox in array:', singleBbox);
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
      console.log(`Extracted coordinates: west=${west}, south=${south}, east=${east}, north=${north}`);
      return [[west, south, east, north]];
    } else {
      console.warn('Invalid flat bbox format: insufficient coordinates', flatBbox);
    }
  }

  console.warn('Unable to normalize bbox format:', bbox);
  return null;
}

// Utility function to get the overall extent that encompasses all bboxes
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
    const response = await axios.get<CollectionsResponse>(apiUrl);
    const data = response.data;

    let collections: Collection[] = [];
    
    // Extract collections from the response safely
    if (data && typeof data === 'object') {
      if (Array.isArray(data.collections)) {
        collections = data.collections;
      } else if (Array.isArray(data)) {
        // Some APIs might return collections directly as an array
        collections = data;
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
    // If there's an error with the request, return empty collections and the error
    console.error('Error fetching collections:', error);
    return {
      collections: [],
      validation: {
        isValid: false,
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error fetching collections' }],
        schemaCount: validator.isLoaded() ? validator.getLoadedSchemaCount() : 0,
        schemaUrls: validator.isLoaded() ? validator.getLoadedSchemaUrls() : []
      }
    };
  }
}