import { useCallback, useMemo } from 'react';

export interface UseContentTypeDetectionReturn {
  parsedJson: unknown;
  isIWXXM: () => boolean;
  language: 'json' | 'xml' | 'text';
  shouldUseCodeView: boolean;
  formattedData: string;
}

// By the namespace of its elements, in any IWXXM version. The words METAR or TAF prove nothing: "STAFF" has TAF in it
export function isIwxxmXml(data: string | null, contentType: string | null): boolean {
  return !!data && !!contentType?.includes('xml') && data.includes('icao.int/iwxxm/');
}

export function useContentTypeDetection(
  data: string | null,
  contentType: string | null,
): UseContentTypeDetectionReturn {
  // Parse JSON once, derive everything from it
  const parsedJson = useMemo(() => {
    if (!data || !contentType?.includes('json')) return null;
    try {
      return JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }, [data, contentType]);

  const isIWXXM = useCallback(() => isIwxxmXml(data, contentType), [data, contentType]);


  const language = useMemo<'json' | 'xml' | 'text'>(() => {
    if (!contentType) return 'text';
    if (contentType.includes('json')) return 'json';
    if (contentType.includes('xml')) return 'xml';
    return 'text';
  }, [contentType]);

  const shouldUseCodeView = useMemo(() => {
    return language === 'json' || language === 'xml';
  }, [language]);

  // Compute formatted data once for highlighting calculations
  const formattedData = useMemo(() => {
    if (!data) return '';
    if (parsedJson !== null) return JSON.stringify(parsedJson, null, 2);
    return data;
  }, [data, parsedJson]);

  return {
    parsedJson,
    isIWXXM,
    language,
    shouldUseCodeView,
    formattedData,
  };
}
