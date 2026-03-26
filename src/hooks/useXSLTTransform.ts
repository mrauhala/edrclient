import { useState, useCallback, useEffect } from 'react';

export interface UseXSLTTransformReturn {
  transformedHtml: string | null;
  transformError: string | null;
}

export function useXSLTTransform(
  data: string | null,
  viewMode: 'code' | 'preview',
  isIWXXM: () => boolean,
  setViewMode: (mode: 'code' | 'preview') => void,
): UseXSLTTransformReturn {
  const [transformedHtml, setTransformedHtml] = useState<string | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);

  const performXSLTransform = useCallback(async () => {
    try {
      setTransformError(null);

      // Load XSLT stylesheet
      const xsltResponse = await fetch('/iwxxm-transform.xsl');
      if (!xsltResponse.ok) {
        throw new Error('Failed to load XSLT stylesheet');
      }
      const xsltText = await xsltResponse.text();

      // Parse XML and XSLT
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data!, 'text/xml');

      // Check for XML parsing errors
      const xmlParseError = xmlDoc.getElementsByTagName('parsererror');
      if (xmlParseError.length > 0) {
        throw new Error('XML parsing error: ' + xmlParseError[0].textContent);
      }

      const xsltDoc = parser.parseFromString(xsltText, 'text/xml');

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

      setTransformedHtml(htmlString);
    } catch (err) {
      console.error('XSLT transformation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTransformError(`Failed to transform XML: ${errorMessage}`);
      setViewMode('code');
    }
  }, [data, setViewMode]);

  // Trigger transformation when switching to preview mode
  useEffect(() => {
    if (viewMode === 'preview' && isIWXXM() && data) {
      performXSLTransform();
    }
  }, [viewMode, data, isIWXXM, performXSLTransform]);

  return { transformedHtml, transformError };
}
