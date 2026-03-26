import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CodeIcon from '@mui/icons-material/Code';
import PreviewIcon from '@mui/icons-material/Preview';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';
import VirtualizedCodeView from './VirtualizedCodeView';
import CoverageJsonChart from './CoverageJsonChart';
import type { ValidationError } from './DataRetrievalAPI';
import { findLineForJsonPointer, findCollectionRange, getCollectionIndexFromPath } from './utils/jsonPointerToLine';

interface DataModalProps {
  open: boolean;
  onClose: () => void;
  data: string | null;
  contentType: string | null;
  isLoading: boolean;
  error: string | null;
  url: string;
  validationErrors?: ValidationError[];
  validationSchemaName?: string | null;
  scrollToPath?: string;
}

const DataModal: React.FC<DataModalProps> = ({
  open,
  onClose,
  data,
  contentType,
  isLoading,
  error,
  url,
  validationErrors = [],
  validationSchemaName = null,
  scrollToPath,
}) => {
  const theme = useTheme();
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [transformedHtml, setTransformedHtml] = useState<string | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);

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
    const parsed = parsedJson as any;

    // Check if it's a CoverageCollection
    if (parsed.type === 'CoverageCollection' && parsed.coverages && Array.isArray(parsed.coverages)) {
      return parsed.coverages.some((coverage: any) => {
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

  // Check if we should show code/preview toggle
  const shouldShowToggle = useMemo(() => {
    return isIWXXM() || isCoverageJsonPointSeries;
  }, [isIWXXM, isCoverageJsonPointSeries]);
  
  // Transform XML using XSLT
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
      
      // Use transformToDocument instead of transformToFragment
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
      
      // Combine styles and body content
      const htmlString = styles + bodyContent;
      
      setTransformedHtml(htmlString);
    } catch (err) {
      console.error('XSLT transformation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTransformError(`Failed to transform XML: ${errorMessage}`);
      setViewMode('code');
    }
  }, [data]);
  
  // Effect to trigger transformation when switching to preview mode
  useEffect(() => {
    if (viewMode === 'preview' && isIWXXM() && data) {
      performXSLTransform();
    }
  }, [viewMode, data, isIWXXM, performXSLTransform]);
  
  const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: 'code' | 'preview' | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };
  
  const handleCopyData = () => {
    if (data) {
      navigator.clipboard.writeText(data);
    }
  };

  const handleCopyUrl = () => {
    if (url) {
      navigator.clipboard.writeText(url);
    }
  };

  const getContentTypeLabel = () => {
    if (!contentType) return 'Unknown';
    if (contentType.includes('json')) return 'JSON';
    if (contentType.includes('xml')) return 'XML';
    if (contentType.includes('text')) return 'Text';
    return contentType;
  };

  const getLanguage = () => {
    if (!contentType) return 'text';
    if (contentType.includes('json')) return 'json';
    if (contentType.includes('xml')) return 'xml';
    return 'text';
  };

  // Compute formatted data once for highlighting calculations
  const formattedData = useMemo(() => {
    if (!data) return '';
    if (parsedJson !== null) return JSON.stringify(parsedJson, null, 2);
    return data;
  }, [data, parsedJson]);

  const shouldUseCodeView = () => {
    const language = getLanguage();
    return language === 'json' || language === 'xml';
  };

  // Compute error line numbers, collection gutter ranges, and per-line error map
  const { errorLines, errorLineList, gutterRanges, initialErrorIdx } = useMemo(() => {
    const empty = {
      errorLines: new Set<number>(),
      errorLineList: [] as { line: number; errors: ValidationError[] }[],
      gutterRanges: [] as { start: number; end: number }[],
      initialErrorIdx: 0,
    };
    if (!validationErrors.length || !formattedData || !contentType?.includes('json')) return empty;

    const errLines = new Set<number>();
    const byLine = new Map<number, ValidationError[]>();
    const ranges: { start: number; end: number }[] = [];
    const seenCollections = new Set<number>();
    let targetLine = 0;

    for (const err of validationErrors) {
      if (!err.path || err.path === 'root') continue;
      const line = findLineForJsonPointer(formattedData, err.path);
      if (line > 0) {
        errLines.add(line);
        if (!byLine.has(line)) byLine.set(line, []);
        byLine.get(line)!.push(err);
      }

      const collIdx = getCollectionIndexFromPath(err.path);
      if (collIdx !== null && !seenCollections.has(collIdx)) {
        seenCollections.add(collIdx);
        const range = findCollectionRange(formattedData, collIdx);
        if (range) ranges.push(range);
      }

      if (scrollToPath && err.path === scrollToPath && line > 0) {
        targetLine = line;
      }
    }

    if (!targetLine && scrollToPath && scrollToPath !== 'root') {
      targetLine = findLineForJsonPointer(formattedData, scrollToPath);
    }

    // Build sorted list of unique error lines with their errors
    const sortedLines = Array.from(byLine.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([line, errors]) => ({ line, errors }));

    // Find initial index based on scrollToPath
    let initIdx = 0;
    if (targetLine > 0) {
      const idx = sortedLines.findIndex(e => e.line === targetLine);
      if (idx >= 0) initIdx = idx;
    }

    return { errorLines: errLines, errorLineList: sortedLines, gutterRanges: ranges, initialErrorIdx: initIdx };
  }, [validationErrors, formattedData, contentType, scrollToPath]);

  // Navigation state
  const [currentErrorIdx, setCurrentErrorIdx] = useState(0);

  // Reset navigation index when errors change or when initially opened
  useEffect(() => {
    setCurrentErrorIdx(initialErrorIdx);
  }, [initialErrorIdx]);

  const currentError = errorLineList[currentErrorIdx];

  const handlePrevError = useCallback(() => {
    if (currentErrorIdx <= 0) return;
    setCurrentErrorIdx(currentErrorIdx - 1);
  }, [currentErrorIdx]);

  const handleNextError = useCallback(() => {
    if (currentErrorIdx >= errorLineList.length - 1) return;
    setCurrentErrorIdx(currentErrorIdx + 1);
  }, [currentErrorIdx, errorLineList.length]);

  // Keyboard navigation: Ctrl/Cmd + ArrowUp/Down for prev/next error
  useEffect(() => {
    if (!open || !errorLineList.length) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); handlePrevError(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); handleNextError(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, errorLineList.length, handlePrevError, handleNextError]);



  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, pr: 6 }}>
        <Typography variant="h6" component="div" noWrap>
          API Response
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {url}
            </Typography>
            {contentType && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                Content-Type: {contentType}
              </Typography>
            )}
          </Box>
          <Tooltip title="Copy URL">
            <IconButton
              size="small"
              onClick={handleCopyUrl}
              sx={{ ml: 1, flexShrink: 0 }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">
              <Typography variant="subtitle2">Error fetching data:</Typography>
              <Typography variant="body2">{error}</Typography>
            </Alert>
          </Box>
        )}
        
        {!isLoading && !error && data && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ 
              p: 1, 
              backgroundColor: 'background.default', 
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Content Type: {getContentTypeLabel()}
                </Typography>

                {validationSchemaName && errorLineList.length === 0 && (
                  <Chip
                    icon={<CheckCircleOutlineIcon />}
                    label={`${validationSchemaName}: Valid`}
                    color="success"
                    size="small"
                    variant="outlined"
                    sx={{ ml: 1 }}
                  />
                )}

                {errorLineList.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 1 }}>
                    <Chip
                      icon={<ErrorOutlineIcon />}
                      label={`${errorLineList.length} ${errorLineList.length === 1 ? 'error' : 'errors'}`}
                      color="error"
                      size="small"
                      variant="outlined"
                    />
                    <IconButton
                      size="small"
                      onClick={handlePrevError}
                      disabled={currentErrorIdx <= 0}
                      aria-label="Previous error"
                    >
                      <KeyboardArrowUpIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="caption" sx={{ minWidth: 32, textAlign: 'center', userSelect: 'none' }}>
                      {currentErrorIdx + 1}/{errorLineList.length}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleNextError}
                      disabled={currentErrorIdx >= errorLineList.length - 1}
                      aria-label="Next error"
                    >
                      <KeyboardArrowDownIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}

                {shouldShowToggle && (
                  <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={handleViewModeChange}
                    size="small"
                    color="primary"
                  >
                    <ToggleButton value="code">
                      <Tooltip title="View raw code">
                        <CodeIcon fontSize="small" sx={{ mr: 0.5 }} />
                      </Tooltip>
                      Code
                    </ToggleButton>
                    <ToggleButton value="preview">
                      <Tooltip title="View formatted preview">
                        <PreviewIcon fontSize="small" sx={{ mr: 0.5 }} />
                      </Tooltip>
                      Preview
                    </ToggleButton>
                  </ToggleButtonGroup>
                )}
              </Box>
              
              <Tooltip title="Copy to clipboard">
                <IconButton size="small" onClick={handleCopyData}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            
            {transformError && (
              <Alert severity="warning" sx={{ m: 1 }}>
                {transformError}
              </Alert>
            )}

            {currentError && (
              <Box sx={{
                px: 1.5,
                py: 0.75,
                backgroundColor: 'background.default',
                borderBottom: '1px solid',
                borderLeft: `3px solid ${theme.palette.error.main}`,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'baseline',
                gap: 1,
                flexWrap: 'wrap',
                minHeight: 32,
              }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.secondary', flexShrink: 0 }}>
                  L{currentError.line}
                </Typography>
                {currentError.errors.map((err, i) => {
                  const msg = err.path && err.message.startsWith(err.path)
                    ? err.message.slice(err.path.length).replace(/^:\s*/, '')
                    : err.message;
                  return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      {err.path && (
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.secondary' }}>
                          {err.path}
                        </Typography>
                      )}
                      {err.keyword && (
                        <Chip label={err.keyword} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 16 }} />
                      )}
                      <Typography variant="caption" sx={{ color: 'text.primary' }}>{msg}</Typography>
                    </Box>
                  );
                })}
              </Box>
            )}

            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                p: 0,
                backgroundColor: 'background.paper',
              }}
            >
              {viewMode === 'preview' && isIWXXM() && transformedHtml ? (
                <iframe
                  srcDoc={transformedHtml}
                  sandbox="allow-same-origin"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block'
                  }}
                  title="IWXXM Preview"
                />
              ) : viewMode === 'preview' && isCoverageJsonPointSeries ? (
                <CoverageJsonChart data={parsedJson} />
              ) : (
                shouldUseCodeView() ? (
                  <VirtualizedCodeView
                    code={formattedData}
                    language={getLanguage() as 'json' | 'xml' | 'text'}
                    isDark={theme.palette.mode === 'dark'}
                    errorLines={errorLines}
                    gutterRanges={gutterRanges}
                    errorColor={theme.palette.error.main}
                    scrollToLine={currentError?.line}
                  />
                ) : (
                  <pre style={{
                    margin: 0,
                    padding: '16px',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {formattedData}
                  </pre>
                )
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DataModal;
