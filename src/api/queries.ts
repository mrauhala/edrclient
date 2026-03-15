import axios from 'axios';
import type { AuthCredentials, Collection, LocationQueryResult } from '../types/api';
import { normalizeHref } from '../utils/href';
import { getAxiosConfig, addApiKeyToUrl } from './auth';

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
    const href = locationsQuery?.link?.href;
    return normalizeHref(href);
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
