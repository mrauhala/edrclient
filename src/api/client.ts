import axios from 'axios';
import SchemaValidator from '../SchemaValidator';
import type { AuthCredentials, Collection, CollectionsResponse, GetCollectionsResult, LandingPage, Link, ValidationError, ValidationResult } from '../types/api';
import { normalizeHref } from '../utils/href';
import { sanitizeUrl } from '../utils/sanitizeUrl';
import { getAxiosConfig, addApiKeyToUrl } from './auth';

export async function getCollections(apiUrl: string, auth?: AuthCredentials): Promise<GetCollectionsResult> {
  // Initialize the schema validator outside the try block so it's accessible in the catch block
  const validator = SchemaValidator.getInstance();
  // Hoisted so these are available in the catch block for partial error returns
  let landingPageData: LandingPage | undefined;
  let serviceDescUrl: string | null = null;
  let conformanceError: ValidationError | null = null;
  let dataLinkError: ValidationError | null = null;

  try {
    console.log('=== Starting getCollections for:', sanitizeUrl(apiUrl), '===');

    // Check if this is DMI service (to avoid f=json bug)
    const isDMI = apiUrl.includes('api.meteogate.eu/dk/edr');

    // Step 1: Fetch and validate the landing page
    console.log('Step 1: Fetching landing page from:', sanitizeUrl(apiUrl));

    // Add f=json format parameter if not already present
    // Skip for DMI service as it incorrectly includes f=json in the href paths
    const landingPageUrl = new URL(apiUrl);
    if (!landingPageUrl.searchParams.has('f') && !isDMI) {
      landingPageUrl.searchParams.set('f', 'json');
    }

    // Add API key if provided
    const finalLandingPageUrl = addApiKeyToUrl(landingPageUrl.toString(), auth);

    const landingPageResponse = await axios.get<LandingPage>(finalLandingPageUrl, getAxiosConfig(auth));
    landingPageData = landingPageResponse.data;

    // Step 2: Extract the collections URL and conformance URL from landing page links
    let collectionsUrl: string | null = null;
    let collectionsUrlCandidates: string[] = [];
    let conformanceUrl: string | null = null;

    if (landingPageData && landingPageData.links && Array.isArray(landingPageData.links)) {
      // Collect ALL data links to detect missing / ambiguous cases
      const dataLinks = landingPageData.links.filter(
        (link: Link) => link.rel === 'data' ||
                       link.rel === 'http://www.opengis.net/def/rel/ogc/1.0/data'
      );

      if (dataLinks.length === 0) {
        dataLinkError = {
          title: 'Collections Link Missing',
          message: 'No data/collections link (rel="data") found in landing page. Using fallback URL.',
          type: 'unknown',
          section: 'data link'
        };
        console.warn('No data link (rel="data") found in landing page. Available links:',
          landingPageData.links.map((l: Link) => ({ rel: l.rel, href: l.href })));
        collectionsUrl = `${apiUrl}/collections`;
        collectionsUrlCandidates = [collectionsUrl];
      } else {
        collectionsUrlCandidates = dataLinks
          .map((l: Link) => normalizeHref(l.href))
          .filter(Boolean) as string[];

        if (dataLinks.length > 1) {
          dataLinkError = {
            title: 'Multiple Data Links',
            message: `${dataLinks.length} data links (rel="data") found in landing page. Trying each in order: ${collectionsUrlCandidates.join(', ')}`,
            type: 'unknown',
            section: 'data link'
          };
          console.warn('Multiple data links found:', collectionsUrlCandidates);
        }
        collectionsUrl = collectionsUrlCandidates[0];
        console.log('Found collections URL from landing page:', collectionsUrl ? sanitizeUrl(collectionsUrl) : collectionsUrl);
      }

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

      if (serviceDescLink) {
        const normalizedHref = normalizeHref(serviceDescLink.href);
        if (normalizedHref) {
          serviceDescUrl = normalizedHref;
          console.log('Found service description URL from landing page:', sanitizeUrl(serviceDescUrl));
        }
      }

      if (conformanceLink) {
        const normalizedHref = normalizeHref(conformanceLink.href);
        if (normalizedHref) {
          conformanceUrl = normalizedHref;
          console.log('Found conformance URL from landing page:', sanitizeUrl(conformanceUrl));
        }
      }
    } else {
      console.warn('Landing page has no links array. Using fallback.');
      collectionsUrl = `${apiUrl}/collections`;
      collectionsUrlCandidates = [collectionsUrl];
      dataLinkError = {
        title: 'Collections Link Missing',
        message: 'Landing page has no links array. No data/collections link could be found.',
        type: 'unknown',
        section: 'data link'
      };
    }

    // Step 3: Fetch conformance classes to determine which schema to use
    let conformsTo: string[] | undefined = undefined;
    if (conformanceUrl) {
      try {
        console.log('Step 2: Fetching conformance to determine schema type:', sanitizeUrl(conformanceUrl));
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
        let errorTitle = 'Conformance Endpoint Error';
        let errorMessage = 'Failed to fetch conformance information';
        let errorType: 'cors' | 'network' | 'unknown' = 'unknown';

        if (error instanceof Error) {
          if (error.message.includes('CORS') ||
              error.message.includes('Access-Control-Allow-Origin') ||
              error.message.includes('cross-origin')) {
            errorTitle = 'Conformance CORS Error';
            errorType = 'cors';
            errorMessage = `Conformance endpoint (${conformanceUrl}) does not allow cross-origin requests.`;
          } else if (error.message.includes('Network Error') ||
                     error.message.includes('ERR_NETWORK') ||
                     error.message.includes('Failed to fetch')) {
            errorTitle = 'Conformance Unreachable';
            errorType = 'network';
            errorMessage = `Unable to connect to conformance endpoint (${conformanceUrl}).`;
          } else if (error.message.includes('404')) {
            errorTitle = 'Conformance Not Found';
            errorType = 'network';
            errorMessage = `Conformance endpoint (${conformanceUrl}) returned 404.`;
          } else {
            errorMessage = `Failed to fetch conformance endpoint (${conformanceUrl}): ${error.message}`;
          }
        }

        // Fallback for cases where error.message didn't match above (e.g. non-standard axios builds).
        // ERR_NETWORK covers both CORS blocks and real network failures (DNS, unreachable host),
        // so only use it as a fallback and don't assume CORS specifically.
        if (error && typeof error === 'object' && 'code' in error) {
          if (error.code === 'ERR_NETWORK' && !conformanceError) {
            errorTitle = 'Conformance Unreachable';
            errorType = 'network';
            errorMessage = `Unable to connect to conformance endpoint (${conformanceUrl}). The service may be unreachable or blocking cross-origin requests.`;
            conformanceError = { title: errorTitle, message: errorMessage, type: errorType, section: 'conformance' };
          }
        }

        conformanceError = {
          title: errorTitle,
          message: errorMessage,
          type: errorType,
          section: 'conformance'
        };

        console.warn('Error fetching conformance, will use default schema:', errorMessage);
        // Don't fail - we'll use the default schema and continue processing
      }
    }

    // If no conformance link was found in the landing page at all, report it as an error.
    if (!conformanceUrl && !conformanceError) {
      conformanceError = {
        title: 'Conformance Link Missing',
        message: 'Conformance link (rel="conformance") not found in landing page.',
        type: 'unknown',
        section: 'conformance'
      };
    }

    // Step 4: Load the appropriate schema based on conformance classes
    // Always call this to ensure we have the right schema type
    try {
      await validator.loadSchemaBasedOnConformance(conformsTo);
    } catch (error) {
      console.warn('Error loading schema, continuing with default:', error);
      // Continue even if schema loading fails
    }

    // Step 5: Validate landing page with the loaded schema
    let landingPageValidation: {
      valid: boolean;
      errors: any[] | null;
      schemaResults?: Array<{ schema: string; isValid: boolean }>;
    } = { valid: true, errors: null };
    try {
      landingPageValidation = await validator.validateLandingPage(landingPageData);
      console.log(`Landing page validation result: ${landingPageValidation.valid ? 'Valid' : 'Invalid'}`);
    } catch (error) {
      console.warn('Error validating landing page, continuing:', error);
      // Continue even if validation fails
    }

    // Step 6: Fetch collections — try each candidate URL in order until one succeeds
    if (collectionsUrlCandidates.length === 0) {
      console.error('ERROR: Collections URL could not be determined!');
      throw new Error('Collections URL could not be determined');
    }

    console.log('Step 6: Fetching collections. Candidates:', collectionsUrlCandidates.map(sanitizeUrl));
    let response: Awaited<ReturnType<typeof axios.get<CollectionsResponse>>> | null = null;
    let lastFetchError: unknown = null;

    for (const candidate of collectionsUrlCandidates) {
      try {
        console.log('Trying collections URL:', sanitizeUrl(candidate));
        const urlWithFormat = new URL(candidate);
        if (!urlWithFormat.searchParams.has('f') && !isDMI) {
          urlWithFormat.searchParams.set('f', 'json');
        }
        const finalUrl = addApiKeyToUrl(urlWithFormat.toString(), auth);
        response = await axios.get<CollectionsResponse>(finalUrl, getAxiosConfig(auth));
        collectionsUrl = candidate; // record which URL actually worked
        lastFetchError = null;
        console.log('Collections fetch succeeded from:', sanitizeUrl(candidate), 'status:', response.status);
        break;
      } catch (err) {
        lastFetchError = err;
        console.warn('Collections fetch failed for:', sanitizeUrl(candidate), err);
      }
    }

    if (!response) {
      // All candidates failed — re-throw the last error for the outer catch to handle
      throw lastFetchError;
    }

    const data = response.data;

    let collections: Collection[] = [];
    let collectionsLinks: Link[] | undefined;

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
      // Capture top-level links from the /collections response (may include license, etc.)
      if (!Array.isArray(data) && Array.isArray(data.links)) {
        collectionsLinks = data.links;
      }
    }

    // Step 7: Validate collections
    let collectionsValidation: {
      valid: boolean;
      errors: any[] | null;
      collectionErrors?: { [collectionId: string]: ValidationError[] };
      schemaResults?: Array<{ schema: string; isValid: boolean }>;
    } = { valid: true, errors: null };
    try {
      collectionsValidation = await validator.validateCollections(data);
      console.log(`Collections validation result: ${collectionsValidation.valid ? 'Valid' : 'Invalid'}`);
      console.log(`Loaded schema count: ${validator.getLoadedSchemaCount()}`);
    } catch (error) {
      console.warn('Error validating collections, continuing:', error);
      // Continue even if validation fails
    }

    // Step 8: Validate conformance response if we fetched it
    let conformanceValidation: {
      valid: boolean;
      errors: any[] | null;
      schemaResults?: Array<{ schema: string; isValid: boolean }>;
    } = { valid: true, errors: null };
    if (conformanceUrl && conformsTo) {
      try {
        // Validate conformance response we already fetched
        conformanceValidation = await validator.validateConformance({ conformsTo });
        console.log(`Conformance validation result: ${conformanceValidation.valid ? 'Valid' : 'Invalid'}`);
      } catch (error) {
        console.warn('Error validating conformance, continuing:', error);
        // Continue even if validation fails
      }
    } else if (conformanceError) {
      // If we failed to fetch conformance, include that error in validation
      conformanceValidation = { valid: false, errors: [conformanceError] };
    }

    // Combine all validation results
    const combinedValidation: ValidationResult = {
      isValid: landingPageValidation.valid && collectionsValidation.valid && conformanceValidation.valid,
      errors: [
        ...(landingPageValidation.errors || []),
        ...(collectionsValidation.errors || []),
        ...(conformanceValidation.errors || []),
        ...(dataLinkError ? [dataLinkError] : [])
      ],
      schemaCount: validator.getLoadedSchemaCount(),
      schemaUrls: validator.getLoadedSchemaUrls(),
      collectionErrors: collectionsValidation.collectionErrors,
      landingPageValidation: {
        isValid: landingPageValidation.valid,
        errors: landingPageValidation.errors,
        schemaResults: landingPageValidation.schemaResults
      },
      collectionsValidation: {
        isValid: collectionsValidation.valid,
        errors: collectionsValidation.errors,
        schemaResults: collectionsValidation.schemaResults
      },
      conformanceValidation: {
        isValid: conformanceValidation.valid,
        errors: conformanceValidation.errors,
        schemaResults: conformanceValidation.schemaResults
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
      collectionsUrl: collectionsUrl || undefined,
      conformanceUrl: conformanceUrl || undefined,
      landingPageTitle: landingPageData?.title,
      landingPageDescription: landingPageData?.description,
      serviceDescUrl: serviceDescUrl || undefined,
      conformsTo: conformsTo,
      landingPageLinks: landingPageData?.links,
      landingPageKeywords: landingPageData?.keywords,
      collectionsLinks,
      rawResponses: {
        landingPage: landingPageData,
        collections: data,
        conformance: conformsTo ? { conformsTo } : undefined,
      },
    };
  } catch (error) {
    console.error('Error fetching collections:', error);

    // Check if this is a CORS error
    let errorMessage = 'Unknown error fetching API data';
    let errorType: 'cors' | 'network' | 'unknown' = 'unknown';
    let errorSection = 'unknown endpoint';
    let failedUrl = apiUrl;

    // Try to get the URL from axios error config
    if (error && typeof error === 'object' && 'config' in error) {
      const axiosError = error as any;
      if (axiosError.config && axiosError.config.url) {
        failedUrl = axiosError.config.url;

        // Determine which endpoint failed.
        // Use whether landingPageData was already fetched as the primary indicator:
        // if the landing page succeeded, the failure must be in the collections fetch.
        // URL-pattern matching alone is unreliable — some services use the same URL
        // path segment (e.g. /conformance) for both their data link and conformance link.
        if (landingPageData !== undefined) {
          errorSection = 'collections endpoint';
        } else {
          errorSection = 'landing page';
        }
      }
    }

    const isCollections = errorSection === 'collections endpoint';
    let errorTitle = isCollections ? 'Collections Error' : 'Error';
    if (error instanceof Error) {
      errorMessage = error.message;

      // Common CORS error indicators
      if (error.message.includes('CORS') ||
          error.message.includes('Access-Control-Allow-Origin') ||
          error.message.includes('cross-origin')) {
        errorTitle = isCollections ? 'Collections CORS Error' : 'CORS Error';
        errorType = 'cors';
        errorMessage = `${errorSection} does not allow cross-origin requests from web browsers. URL: ${failedUrl}`;
      } else if (error.message.includes('Network Error') ||
                 error.message.includes('ERR_NETWORK') ||
                 error.message.includes('Failed to fetch')) {
        errorTitle = isCollections ? 'Collections Unreachable' : 'Connection Failed';
        errorType = 'network';
        errorMessage = `Unable to connect to ${errorSection}. This may be due to CORS restrictions or the service being unavailable. URL: ${failedUrl}`;
      } else if (error.message.includes('404')) {
        errorTitle = isCollections ? 'Collections Not Found' : 'Not Found';
        errorType = 'network';
        errorMessage = `${errorSection} returned 404. URL: ${failedUrl}`;
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorTitle = isCollections ? 'Collections Authentication Error' : 'Authentication Error';
        errorType = 'network';
        errorMessage = `${errorSection} requires authentication or returned access denied. URL: ${failedUrl}`;
      } else {
        errorTitle = isCollections ? 'Collections Error' : 'Error';
        errorMessage = `Failed to fetch ${errorSection}: ${error.message}. URL: ${failedUrl}`;
      }
    }

    // Fallback for cases where error.message didn't match above (e.g. non-standard axios builds).
    // ERR_NETWORK covers both CORS blocks and real network failures (DNS, unreachable host),
    // so only use it as a fallback when nothing was already classified, and don't assume CORS.
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ERR_NETWORK' && errorTitle === (isCollections ? 'Collections Error' : 'Error')) {
        errorTitle = isCollections ? 'Collections Unreachable' : 'Connection Failed';
        errorType = 'network';
        errorMessage = `Unable to connect to ${errorSection}. The service may be unreachable or blocking cross-origin requests. URL: ${failedUrl}`;
      }
    }

    // If there's an error with the request, return empty collections and the error.
    // Include any landing page data that was already fetched before the failure so
    // the UI can still display service info (title, description, links) even when
    // the collections or conformance endpoint failed.
    return {
      collections: [],
      validation: {
        isValid: false,
        errors: [
          { title: errorTitle, message: errorMessage, type: errorType, section: errorSection },
          // Include any non-fatal errors already computed before the fatal error
          ...(conformanceError ? [conformanceError] : []),
          ...(dataLinkError ? [dataLinkError] : [])
        ],
        schemaCount: validator.isLoaded() ? validator.getLoadedSchemaCount() : 0,
        schemaUrls: validator.isLoaded() ? validator.getLoadedSchemaUrls() : []
      },
      landingPageUrl: apiUrl,
      landingPageTitle: landingPageData?.title,
      landingPageDescription: landingPageData?.description,
      landingPageLinks: landingPageData?.links,
      landingPageKeywords: landingPageData?.keywords,
      serviceDescUrl: serviceDescUrl || undefined,
    };
  }
}
