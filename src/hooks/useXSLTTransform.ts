import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseXSLTTransformReturn {
  transformedHtml: string | null;
  transformError: string | null;
  isTransforming: boolean;
}

// Module-level cache for the XSLT stylesheet text
let cachedXsltText: string | null = null;

export function useXSLTTransform(
  data: string | null,
  viewMode: 'code' | 'preview',
  isIWXXM: () => boolean,
  setViewMode: (mode: 'code' | 'preview') => void,
): UseXSLTTransformReturn {
  const [transformedHtml, setTransformedHtml] = useState<string | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const performXSLTransform = useCallback(async (signal: AbortSignal) => {
    try {
      setTransformError(null);
      setIsTransforming(true);

      // Load XSLT stylesheet (cached after first fetch)
      if (!cachedXsltText) {
        const xsltResponse = await fetch('/iwxxm-transform.xsl', { signal });
        if (!xsltResponse.ok) {
          throw new Error('Failed to load XSLT stylesheet');
        }
        cachedXsltText = await xsltResponse.text();
      }

      if (signal.aborted) return;

      // Parse XML and XSLT
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data!, 'text/xml');

      // Check for XML parsing errors
      const xmlParseError = xmlDoc.getElementsByTagName('parsererror');
      if (xmlParseError.length > 0) {
        throw new Error('XML parsing error: ' + xmlParseError[0].textContent);
      }

      const xsltDoc = parser.parseFromString(cachedXsltText, 'text/xml');

      // Check for XSLT parsing errors
      const xsltParseError = xsltDoc.getElementsByTagName('parsererror');
      if (xsltParseError.length > 0) {
        throw new Error('XSLT parsing error: ' + xsltParseError[0].textContent);
      }

      // Perform transformation
      const xsltProcessor = new XSLTProcessor();
      xsltProcessor.importStylesheet(xsltDoc);

      const resultDoc = xsltProcessor.transformToDocument(xmlDoc);

      if (!resultDoc || !resultDoc.documentElement) {
        throw new Error('XSLT transformation produced no result');
      }

      // Check if the result has actual content
      const body = resultDoc.querySelector('body');

      if (!body || !body.innerHTML.trim()) {
        throw new Error('XSLT transformation produced empty output');
      }

      // Get both the styles from head and content from body
      const head = resultDoc.querySelector('head');
      const styles = head?.innerHTML || '';
      const bodyContent = body.innerHTML;

      const htmlString = styles + bodyContent;

      if (!signal.aborted) {
        setTransformedHtml(htmlString);
      }
    } catch (err) {
      if (signal.aborted) return;
      console.error('XSLT transformation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTransformError(`Failed to transform XML: ${errorMessage}`);
      setViewMode('code');
    } finally {
      if (!signal.aborted) {
        setIsTransforming(false);
      }
    }
  }, [data, setViewMode]);

  // Trigger transformation when switching to preview mode
  useEffect(() => {
    if (viewMode === 'preview' && isIWXXM() && data) {
      // Abort previous transform if still in-flight
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      performXSLTransform(controller.signal);
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [viewMode, data, isIWXXM, performXSLTransform]);

  return { transformedHtml, transformError, isTransforming };
}
