import { useCallback, useMemo } from 'react';
import { isTimeSeriesCoverage } from '../utils/coverageTimeSeries';

export interface UseContentTypeDetectionReturn {
  parsedJson: unknown;
  isIWXXM: () => boolean;
  isCoverageJsonTimeSeries: boolean;
  // Whether there's more to show than the text
  hasDataView: boolean;
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

  // Check if data is CoverageJSON that can be charted as a time series
  const isCoverageJsonTimeSeries = useMemo(() => {
    if (!parsedJson || typeof parsedJson !== 'object') return false;
    const parsed = parsedJson as { type?: unknown; coverages?: unknown };

    if (parsed.type === 'CoverageCollection' && Array.isArray(parsed.coverages)) {
      return parsed.coverages.some(isTimeSeriesCoverage);
    }

    return parsed.type === 'Coverage' && isTimeSeriesCoverage(parsed);
  }, [parsedJson]);

  const hasDataView = useMemo(() => {
    return isIWXXM() || isCoverageJsonTimeSeries;
  }, [isIWXXM, isCoverageJsonTimeSeries]);

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
    isCoverageJsonTimeSeries,
    hasDataView,
    language,
    shouldUseCodeView,
    formattedData,
  };
}
