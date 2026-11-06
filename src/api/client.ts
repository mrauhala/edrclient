import axios from 'axios';
import SchemaValidator from '../SchemaValidator';
import type { AuthCredentials, Collection, CollectionsResponse, GetCollectionsResult, LandingPage, Link, ValidationError, ValidationResult } from '../types/api';
import { normalizeHref, resolveCollectionHrefs, resolveHref } from '../utils/href';
import { sanitizeUrl } from '../utils/sanitizeUrl';
import { addApiKeyToUrl } from './auth';
import { capturedGet, type CapturedLoad, type CapturedResponse } from './capture';
import { makeRoomForWireTiming } from './responseSizes';
import { pickOpenApiLink } from '../validation/openapi/loadServiceDescription';
import { classifyDataLinks, dataLinkUrls, hasCollectionsList } from './landingPageLinks';

export async function getCollections(apiUrl: string, auth?: AuthCredentials, signal?: AbortSignal): Promise<GetCollectionsResult> {
  // Initialize the schema validator outside the try block so it's accessible in the catch block
  const validator = SchemaValidator.getInstance();
  // Hoisted so these are available in the catch block for partial error returns
  let landingPageData: LandingPage | undefined;
  let serviceDescUrl: string | null = null;
  let conformanceError: ValidationError | null = null;
  let conformsTo: string[] | undefined;
  let dataLinkError: ValidationError | null = null;
  // Problems with the landing page's links that the client worked around
  const linkWarnings: ValidationError[] = [];
  const captured: CapturedLoad = {};

  try {
    console.log('=== Starting getCollections for:', sanitizeUrl(apiUrl), '===');

    // Step 1: Fetch and validate the landing page
    console.log('Step 1: Fetching landing page from:', sanitizeUrl(apiUrl));

    // Add f=json format parameter if not already present
    const landingPageUrl = new URL(apiUrl);
    if (!landingPageUrl.searchParams.has('f')) {
      landingPageUrl.searchParams.set('f', 'json');
    }

    makeRoomForWireTiming();
    const landingPageResponse = await capturedGet<LandingPage>(landingPageUrl.toString(), auth, signal, capture => { captured.landingPage = capture; });
    landingPageData = landingPageResponse.data;

    // Step 2: Extract the collections URL and conformance URL from landing page links
    let collectionsUrl: string | null = null;
    let collectionsUrlCandidates: string[] = [];
    let conformanceUrl: string | null = null;
    let conformanceAsData: string | null = null;
    // The URL the collections came from, with f and any API key: some servers append to it
    let collectionsRequestUrl: string | undefined;

    if (landingPageData && landingPageData.links && Array.isArray(landingPageData.links)) {
      // Collect ALL data link URLs to detect missing / ambiguous cases (one URL linked under both
      // the EDR and the Common rel counts once)
      const dataLinks = classifyDataLinks(dataLinkUrls(landingPageData.links, apiUrl));
      conformanceAsData = dataLinks.conformance;

      if (dataLinks.collections.length === 0) {
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
        collectionsUrlCandidates = dataLinks.collections;
        if (collectionsUrlCandidates.length > 1) console.warn('Multiple data links found:', collectionsUrlCandidates);
        collectionsUrl = collectionsUrlCandidates[0];
        console.log('Found collections URL from landing page:', collectionsUrl ? sanitizeUrl(collectionsUrl) : collectionsUrl);
      }

      // The OpenAPI service description (service-desc), chosen by media type: servers may also
      // list e.g. an AsyncAPI description under the same rel
      const serviceDescLink = pickOpenApiLink(landingPageData.links);

      // Look for conformance link
      const conformanceLink = landingPageData.links.find(
        (link: Link) => link.rel === 'conformance' ||
                       link.rel === 'http://www.opengis.net/def/rel/ogc/1.0/conformance'
      );

      if (serviceDescLink) {
        const normalizedHref = normalizeHref(serviceDescLink.href, apiUrl);
        if (normalizedHref) {
          serviceDescUrl = normalizedHref;
          console.log('Found service description URL from landing page:', sanitizeUrl(serviceDescUrl));
        }
      }

      if (conformanceLink) {
        const normalizedHref = normalizeHref(conformanceLink.href, apiUrl);
        if (normalizedHref) {
          conformanceUrl = normalizedHref;
          console.log('Found conformance URL from landing page:', sanitizeUrl(conformanceUrl));
        }
      } else if (conformanceAsData) {
        conformanceUrl = conformanceAsData;
        linkWarnings.push({
          title: 'Conformance Linked as Data',
          message: `The landing page links its conformance declaration (${conformanceAsData}) as rel="data" and has no rel="conformance" link. It was used as the conformance link.`,
          type: 'unknown',
          section: 'conformance',
          severity: 'warning',
        });
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

    // Step 3: Fetch conformance and collections in parallel
    // Both are independent after extracting URLs from the landing page.
    // Schema loading + validation happen after both complete.

    // --- Conformance fetch promise ---
    const conformancePromise = (async () => {
      if (!conformanceUrl) return undefined;
      console.log('Fetching conformance:', sanitizeUrl(conformanceUrl));
      const conformanceUrlWithFormat = new URL(conformanceUrl);
      if (!conformanceUrlWithFormat.searchParams.has('f')) {
        conformanceUrlWithFormat.searchParams.set('f', 'json');
      }
      const conformanceResponse = await capturedGet<{ conformsTo: string[] }>(conformanceUrlWithFormat.toString(), auth, signal, capture => { captured.conformance = capture; });
      return conformanceResponse.data?.conformsTo;
    })();

    // --- Collections fetch promise ---
    if (collectionsUrlCandidates.length === 0) {
      console.error('ERROR: Collections URL could not be determined!');
      throw new Error('Collections URL could not be determined');
    }

    console.log('Fetching collections. Candidates:', collectionsUrlCandidates.map(sanitizeUrl));
    // The first candidate answering with a collections list wins. If none does, the first answer is
    // used anyway, so its validation shows what came back instead.
    const collectionsPromise = (async () => {
      type Answer = { result: Awaited<ReturnType<typeof axios.get<CollectionsResponse>>>; candidate: string; requestUrl: string; capture: CapturedResponse | undefined };
      let firstAnswer: Answer | null = null;
      let lastErr: unknown = null;
      const accept = ({ result, candidate, requestUrl, capture }: Answer) => {
        collectionsUrl = candidate;
        collectionsRequestUrl = requestUrl;
        captured.collections = capture;
        return result;
      };
      for (const candidate of collectionsUrlCandidates) {
        try {
          console.log('Trying collections URL:', sanitizeUrl(candidate));
          const urlWithFormat = new URL(candidate);
          if (!urlWithFormat.searchParams.has('f')) {
            urlWithFormat.searchParams.set('f', 'json');
          }
          let capture: CapturedResponse | undefined;
          const result = await capturedGet<CollectionsResponse>(urlWithFormat.toString(), auth, signal, answer => {
            capture = answer;
            // Until one's accepted, the latest is what there is to show
            captured.collections = answer;
          });
          const answer = { result, candidate, requestUrl: (result.request as XMLHttpRequest | undefined)?.responseURL || addApiKeyToUrl(urlWithFormat.toString(), auth), capture };
          if (hasCollectionsList(result.data)) {
            console.log('Collections fetch succeeded from:', sanitizeUrl(candidate), 'status:', result.status);
            return accept(answer);
          }
          console.warn('No collections list from:', sanitizeUrl(candidate));
          firstAnswer ??= answer;
        } catch (err) {
          lastErr = err;
          console.warn('Collections fetch failed for:', sanitizeUrl(candidate), err);
        }
      }
      if (firstAnswer) return accept(firstAnswer);
      throw lastErr;
    })();

    // --- Await both in parallel ---
    const [conformanceResult, collectionsResult] = await Promise.allSettled([
      conformancePromise,
      collectionsPromise,
    ]);

    // --- Process conformance result ---
    if (conformanceResult.status === 'fulfilled' && conformanceResult.value) {
      conformsTo = conformanceResult.value;
      console.log(`Found ${conformsTo.length} conformance classes:`, conformsTo);
    } else if (conformanceResult.status === 'rejected') {
      const error = conformanceResult.reason;
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

      // Fallback for ERR_NETWORK code
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'ERR_NETWORK' && errorType === 'unknown') {
          errorTitle = 'Conformance Unreachable';
          errorType = 'network';
          errorMessage = `Unable to connect to conformance endpoint (${conformanceUrl}). The service may be unreachable or blocking cross-origin requests.`;
        }
      }

      conformanceError = { title: errorTitle, message: errorMessage, type: errorType, section: 'conformance' };
      console.warn('Error fetching conformance, will use default schema:', errorMessage);
    }

    if (!conformanceUrl && !conformanceError) {
      conformanceError = {
        title: 'Conformance Link Missing',
        message: 'Conformance link (rel="conformance") not found in landing page.',
        type: 'unknown',
        section: 'conformance'
      };
    }

    // --- Process collections result ---
    if (collectionsResult.status === 'rejected') {
      // All candidates failed — re-throw for the outer catch to handle
      throw collectionsResult.reason;
    }
    const response = collectionsResult.value;
    if (collectionsUrlCandidates.length > 1) {
      linkWarnings.push({
        title: 'Multiple Data Links',
        message: `The landing page links ${collectionsUrlCandidates.length} different URLs as data (rel="data"): ${collectionsUrlCandidates.join(', ')}. The collections came from ${collectionsUrl}.`,
        type: 'unknown',
        section: 'data link',
        severity: 'warning',
      });
    }
    if (!hasCollectionsList(response.data)) {
      linkWarnings.push({
        title: 'No Collections List',
        message: `${collectionsUrl} answered without a "collections" array, so no collections can be listed.`,
        type: 'unknown',
        section: 'data link',
      });
    }

    // --- Schema loading + validation (depends on conformance result) ---
    try {
      await validator.loadSchemaBasedOnConformance(conformsTo);
    } catch (error) {
      console.warn('Error loading schema, continuing with default:', error);
    }

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

    // Resolve any relative hrefs in collections and their links against the API base URL
    let repairedHrefs = 0;
    for (const collection of collections) {
      repairedHrefs += resolveCollectionHrefs(collection, apiUrl, collectionsRequestUrl);
    }
    const appendedHrefsWarning: ValidationError | null = repairedHrefs > 0 ? {
      title: 'Hrefs Appended to the Request URL',
      message: `${repairedHrefs} collection link and data query hrefs add their path after the query string of the collections request (${sanitizeUrl(collectionsRequestUrl ?? '')}/…), so they would request the collections list. They were repaired by moving the path in front of the query.`,
      type: 'unknown',
      section: 'data link',
      severity: 'warning'
    } : null;
    if (collectionsLinks) {
      for (const link of collectionsLinks) {
        if (typeof link.href === 'string') {
          link.href = resolveHref(link.href, apiUrl);
        }
      }
    }
    if (landingPageData?.links && Array.isArray(landingPageData.links)) {
      for (const link of landingPageData.links) {
        if (typeof link.href === 'string') {
          link.href = resolveHref(link.href, apiUrl);
        }
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
        ...(dataLinkError ? [dataLinkError] : []),
        ...linkWarnings,
        ...(appendedHrefsWarning ? [appendedHrefsWarning] : [])
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
      captured,
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
          ...(dataLinkError ? [dataLinkError] : []),
          ...linkWarnings
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
      conformsTo,
      captured,
    };
  }
}
