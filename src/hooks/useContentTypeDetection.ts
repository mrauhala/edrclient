import { useCallback, useMemo } from 'react';

export interface UseContentTypeDetectionReturn {
  parsedJson: unknown;
  isIWXXM: () => boolean;
  isCoverageJsonPointSeries: boolean;
  shouldShowToggle: boolean;
  contentTypeLabel: string;
  language: 'json' | 'xml' | 'text';
  shouldUseCodeView: boolean;
  formattedData: string;
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

  // Check if data is IWXXM XML
  const isIWXXM = useCallback(() => {
    if (!data || !contentType) return false;
    return contentType.includes('xml') &&
           (data.includes('iwxxm/3.0') || data.includes('iwxxm/2.1') ||
            data.includes('METAR') || data.includes('TAF') || data.includes('SIGMET'));
  }, [data, contentType]);

  // Check if data is CoverageJSON PointSeries or Grid with single point
  const isCoverageJsonPointSeries = useMemo(() => {
    if (!parsedJson || typeof parsedJson !== 'object') return false;
    const parsed = parsedJson as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Check if it's a CoverageCollection
    if (parsed.type === 'CoverageCollection' && parsed.coverages && Array.isArray(parsed.coverages)) {
      return parsed.coverages.some((coverage: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const domainType = coverage.domain?.domainType;
        if (domainType === 'PointSeries') return true;
        if (domainType === 'Grid') {
          const xValues = coverage.domain?.axes?.x?.values;
          const yValues = coverage.domain?.axes?.y?.values;
          return xValues?.length === 1 && yValues?.length === 1;
        }
        return false;
      });
    }

    // Check if it's a single Coverage
    if (parsed.type !== 'Coverage') return false;

    const domainType = parsed.domain?.domainType;
    if (domainType === 'PointSeries') return true;
    if (domainType === 'Grid') {
      const xValues = parsed.domain?.axes?.x?.values;
      const yValues = parsed.domain?.axes?.y?.values;
      return xValues?.length === 1 && yValues?.length === 1;
    }

    return false;
  }, [parsedJson]);

  const shouldShowToggle = useMemo(() => {
    return isIWXXM() || isCoverageJsonPointSeries;
  }, [isIWXXM, isCoverageJsonPointSeries]);

  const contentTypeLabel = useMemo(() => {
    if (!contentType) return 'Unknown';
    if (contentType.includes('json')) return 'JSON';
    if (contentType.includes('xml')) return 'XML';
    if (contentType.includes('text')) return 'Text';
    return contentType;
  }, [contentType]);

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
    isCoverageJsonPointSeries,
    shouldShowToggle,
    contentTypeLabel,
    language,
    shouldUseCodeView,
    formattedData,
  };
}
