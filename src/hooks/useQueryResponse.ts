import { useCallback, useEffect, useRef, useState } from 'react';
import { QueryResultValidator } from '../QueryResultValidator';
import { httpFailure } from '../api/httpErrors';
import { sendRequest } from '../api/sendRequest';
import type { ResponseDetails } from '../api/sendRequest';
import { useGeoJsonLayers } from '../contexts/GeoJsonLayerContext';
import { useService } from '../contexts/ServiceContext';
import type { ValidationError } from '../types/api';

// The latest request and what came back for it, shown in the response pane, which each one opens.
// Closing the pane only hides it: this stays until the next request
export function useQueryResponse(showResponse: () => void) {
  const { setGeoJsonLayers } = useGeoJsonLayers();
  const { getAuthCredentials } = useService();

  // Abort controller for in-flight data fetches
  const fetchControllerRef = useRef<AbortController | null>(null);

  const [data, setData] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  // Status, time, size and headers of what was fetched; null for a stored response, which wasn't sent just now
  const [response, setResponse] = useState<ResponseDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [url, setUrl] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationSchemaName, setValidationSchemaName] = useState<string | null>(null);
  const [scrollToPath, setScrollToPath] = useState<string | undefined>();

  // Release any image blob URL from a previous response
  const releaseImage = useCallback(() => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
    setImageUrl(null);
  }, []);

  // Listen for validation error clicks to open API response viewer with stored data
  useEffect(() => {
    const handleOpenValidationResponse = (e: Event) => {
      const { url: storedUrl, errors, scrollToPath: path, data: storedData } = (e as CustomEvent).detail;
      if (!storedUrl || !storedData) return;

      // Replaces whatever the pane had, so a fetch still on its way mustn't arrive over it
      fetchControllerRef.current?.abort();
      fetchControllerRef.current = null;
      releaseImage();
      showResponse();
      setIsLoading(false);
      setError(null);
      setData(storedData);
      setContentType('application/json');
      setResponse(null);
      setUrl(storedUrl);
      setValidationErrors(errors || []);
      setValidationSchemaName(null);
      setScrollToPath(path);
    };
    document.addEventListener('open-validation-response', handleOpenValidationResponse);
    return () => document.removeEventListener('open-validation-response', handleOpenValidationResponse);
  }, [releaseImage, showResponse]);

  // Fetches a query into the response pane
  const fetchQuery = useCallback(async (requestUrl: string) => {
    // Cancel any in-flight fetch
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    showResponse();
    setUrl(requestUrl);
    setValidationErrors([]);
    setValidationSchemaName(null);
    setScrollToPath(undefined);
    setIsLoading(true);
    setError(null);
    setData(null);
    setContentType(null);
    setResponse(null);
    releaseImage();

    try {
      const { body, ...details } = await sendRequest(requestUrl, getAuthCredentials(requestUrl), controller.signal);
      const { status, contentType: responseType } = details;
      setResponse(details);
      setContentType(responseType);

      const failure = httpFailure(status, body);
      if (failure) setError(failure);

      // Binary image response (image/png, image/jpeg, image/webp, image/svg+xml, etc.):
      // wrap the arraybuffer in a blob URL so the pane can render it via <img>.
      if (responseType.startsWith('image/')) {
        const blob = new Blob([body], { type: responseType });
        const objectUrl = URL.createObjectURL(blob);
        imageUrlRef.current = objectUrl;
        setImageUrl(objectUrl);
        return;
      }

      // Text-ish response: decode the arraybuffer and continue with the existing pipeline.
      const responseData = new TextDecoder('utf-8').decode(body);
      setData(responseData);

      // An error's body is shown as it came, but isn't data to check or map
      if (failure) return;

      // Validate query result against registered schemas (e.g. CoverageJSON)
      try {
        const validation = await QueryResultValidator.getInstance().validate(responseData, responseType, requestUrl);
        // Another request may have started meanwhile
        if (controller.signal.aborted) return;
        if (validation.matched) {
          setValidationSchemaName(validation.schemaName || null);
          setValidationErrors(validation.errors || []);
        }
      } catch (e) {
        console.error('Query result validation failed:', e);
      }

      // GeoJSON becomes a map layer, whatever the request's f: a server may serve it as plain
      // application/json (Met Office) or by default without f (items). CoverageJSON parses too,
      // but isn't a Feature(Collection).
      if (responseType.includes('json')) {
        try {
          const geoJsonData = JSON.parse(responseData);

          if (geoJsonData.type === 'FeatureCollection' || geoJsonData.type === 'Feature') {
            // Generate a title from the URL or use a default
            const urlParts = requestUrl.split('/');
            const collectionName = urlParts.find(part => part.includes('collections'))
              ? urlParts[urlParts.indexOf(urlParts.find(part => part.includes('collections'))!) + 1]
              : 'Fetched Data';

            const newLayer = {
              url: requestUrl,
              title: `${collectionName} (Fetched)`,
              visible: true,
              labelProperty: 'name',
              data: geoJsonData  // Pass the pre-fetched data
            };

            // Add layer if it doesn't already exist
            setGeoJsonLayers(prev => {
              const exists = prev.some(layer => layer.url === requestUrl);
              if (exists) {
                return prev;
              }
              return [...prev, newLayer];
            });
          }
        } catch (e) {
          console.error('Error parsing GeoJSON:', e);
        }
      }
    } catch (error: any) {
      // Ignore aborted requests (user started a new fetch or opened a stored response)
      if (controller.signal.aborted) return;

      console.error('Error fetching data:', error);

      // Classify error for actionable feedback
      let message = error.message || 'Failed to fetch data';

      if (
        error.message?.includes('CORS') ||
        error.message?.includes('Access-Control-Allow-Origin') ||
        error.message?.includes('cross-origin')
      ) {
        message = 'CORS blocked. Your API must include the Access-Control-Allow-Origin header for this origin.';
      } else if (
        error.code === 'ERR_NETWORK' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('Failed to fetch')
      ) {
        message = 'Network error. The API may be unreachable or blocking cross-origin requests (CORS).';
      }

      // Without a response (network failures, timeouts, CORS, which the browser can't tell apart),
      // the same request may well work next time
      setError({ message, retryable: true });
    } finally {
      // Not when a newer request took over: its spinner stays until it's done
      if (fetchControllerRef.current === controller) setIsLoading(false);
    }
  }, [getAuthCredentials, setGeoJsonLayers, showResponse, releaseImage]);

  // The pane's Try again: the request that failed, even if the query builder has moved on
  const retry = useCallback(() => {
    if (url) fetchQuery(url);
  }, [url, fetchQuery]);

  return {
    fetchQuery,
    pane: {
      url,
      data,
      imageUrl,
      contentType,
      response,
      isLoading,
      error: error?.message ?? null,
      onRetry: error?.retryable ? retry : undefined,
      validationErrors,
      validationSchemaName,
      scrollToPath,
    },
  };
}
