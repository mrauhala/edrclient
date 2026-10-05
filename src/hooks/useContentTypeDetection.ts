import { useCallback, useMemo } from 'react';
import { isTimeSeriesCoverage } from '../utils/coverageTimeSeries';

export interface UseContentTypeDetectionReturn {
  parsedJson: unknown;
  isIWXXM: () => boolean;
  isCoverageJsonTimeSeries: boolean;
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

  // Check if data is CoverageJSON that can be charted as a time series
  const isCoverageJsonTimeSeries = useMemo(() => {
    if (!parsedJson || typeof parsedJson !== 'object') return false;
    const parsed = parsedJson as { type?: unknown; coverages?: unknown };

    if (parsed.type === 'CoverageCollection' && Array.isArray(parsed.coverages)) {
      return parsed.coverages.some(isTimeSeriesCoverage);
    }

    return parsed.type === 'Coverage' && isTimeSeriesCoverage(parsed);
  }, [parsedJson]);

  const shouldShowToggle = useMemo(() => {
    return isIWXXM() || isCoverageJsonTimeSeries;
  }, [isIWXXM, isCoverageJsonTimeSeries]);

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
    isCoverageJsonTimeSeries,
    shouldShowToggle,
    contentTypeLabel,
    language,
    shouldUseCodeView,
    formattedData,
  };
}
