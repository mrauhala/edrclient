import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import VirtualizedCodeView from './VirtualizedCodeView';
import CoverageData, { type CoverageView } from './CoverageData';
import { summarizeCoverage } from './coverage/coverageSummary';
import FetchErrorAlert from './FetchErrorAlert';
import ResponseChecks, { ChecksTabLabel, findingMessage } from './ResponseChecks';
import ResponseHeaders from './ResponseHeaders';
import ResponseSizes from './ResponseSizes';
import ResponseStatusLine from './ResponseStatusLine';
import { useRequestUrl } from './contexts/RequestUrlContext';
import { usePublishResponseCells } from './contexts/responseCells';
import { shortUrl } from './query/requestUrl';
import { checksCount, responseTabs, shownTab, type ResponseTab } from './responseTabs';
import type { ResponseDetails } from './api/sendRequest';
import type { ValidationError } from './DataRetrievalAPI';
import { useContentTypeDetection } from './hooks/useContentTypeDetection';
import { useXSLTTransform } from './hooks/useXSLTTransform';
import { useValidationErrorNavigation } from './hooks/useValidationErrorNavigation';
import { findLineForJsonPointer } from './utils/jsonPointerToLine';

interface ResponsePaneProps {
  // Whether the pane is showing: its keyboard shortcuts are only for then
  open: boolean;
  onClose: () => void;
  data: string | null;
  // For image/* responses: a blob: URL the pane renders via <img>. data stays null in that case.
  imageUrl?: string | null;
  contentType: string | null;
  // Null without a response (a network failure) and for a stored response, which wasn't sent just now
  response?: ResponseDetails | null;
  isLoading: boolean;
  error: string | null;
  // Sends the failed request again; only given when that may help
  onRetry?: () => void;
  url: string;
  validationErrors?: ValidationError[];
  validationSchemaName?: string | null;
  scrollToPath?: string;
}

const TAB_NAMES: Record<Exclude<ResponseTab, 'checks'>, string> = {
  data: 'Data',
  raw: 'Raw',
  headers: 'Headers',
  sizes: 'Sizes',
};

const ResponsePane: React.FC<ResponsePaneProps> = ({
  open,
  onClose,
  data,
  imageUrl = null,
  contentType,
  response = null,
  isLoading,
  error,
  onRetry,
  url,
  validationErrors = [],
  validationSchemaName = null,
  scrollToPath,
}) => {
  const theme = useTheme();
  // The request line above says what was sent, until it moves on or this isn't what it holds
  const { requestUrl } = useRequestUrl();
  const notTheRequestLine = url !== '' && url !== requestUrl;
  const isStored = response === null && data !== null;

  // Kept across sends, for the next response that has the tab
  const [preferredTab, setPreferredTab] = useState<ResponseTab | null>(null);
  const showRaw = useCallback(() => setPreferredTab('raw'), []);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedData, setCopiedData] = useState(false);
  const copyUrlTimer = useRef<ReturnType<typeof setTimeout>>();
  const copyDataTimer = useRef<ReturnType<typeof setTimeout>>();

  const {
    parsedJson, isIWXXM, language, shouldUseCodeView, formattedData,
  } = useContentTypeDetection(data, contentType);

  const coverage = useMemo(() => summarizeCoverage(parsedJson), [parsedJson]);
  const [coverageView, setCoverageView] = useState<CoverageView | null>(null);

  const tabs = responseTabs({
    hasResponse: response !== null && !isLoading,
    hasDataView: coverage !== null || isIWXXM() || imageUrl !== null,
    hasImage: imageUrl !== null,
  });
  const tab = shownTab(preferredTab, tabs);

  const { transformedHtml, transformError, isTransforming } = useXSLTTransform(data, tab === 'data', isIWXXM, showRaw);

  // A line a note in Checks sent the reader to. Not a flagged line: a note isn't a fault in the response
  const [noteLine, setNoteLine] = useState<number | null>(null);

  // The map draws what this pane holds, and clears the moment a new request is sent
  const openInRaw = useCallback((pointer: string) => {
    setNoteLine(findLineForJsonPointer(formattedData, pointer));
    setPreferredTab('raw');
  }, [formattedData, setNoteLine, setPreferredTab]);
  usePublishResponseCells(isLoading ? null : parsedJson, url, openInRaw);

  // Closing and reopening the pane leaves it as it was
  useEffect(() => {
    setCopiedUrl(false);
    setCopiedData(false);
    setNoteLine(null);
  }, [data]);

  const {
    errorLineList, errorLines, gutterRanges,
    currentErrorIdx, currentError, scrollLine, handlePrevError, handleNextError, goToError,
  } = useValidationErrorNavigation(validationErrors, formattedData, contentType, scrollToPath, open && tab === 'raw');

  // Stepping through the flagged lines leaves the note's behind
  useEffect(() => setNoteLine(null), [currentErrorIdx]);

  const flaggedColor = checksCount(errorLineList.flatMap(entry => entry.errors))?.color ?? 'info';

  const allFindings = useMemo(() => [...validationErrors, ...(coverage?.notes ?? [])], [validationErrors, coverage]);
  // Only when they're asked for: each is a walk through the whole of the text
  const showingChecks = tab === 'checks';
  const dataNotes = useMemo(() => (showingChecks && coverage
    ? coverage.notes.map(note => ({ message: note.message, line: findLineForJsonPointer(formattedData, note.path ?? '') }))
    : []), [showingChecks, coverage, formattedData]);
  const markedLines = useMemo(() => (noteLine === null ? errorLines : new Set(errorLines).add(noteLine)), [errorLines, noteLine]);
  const modifier = navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl';

  const handleCopyData = useCallback(() => {
    if (!data) return;
    navigator.clipboard.writeText(data).then(() => {
      setCopiedData(true);
      clearTimeout(copyDataTimer.current);
      copyDataTimer.current = setTimeout(() => setCopiedData(false), 1500);
    }).catch(() => {
      // Clipboard write failed silently — no feedback shown
    });
  }, [data]);

  const handleCopyUrl = useCallback(() => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      clearTimeout(copyUrlTimer.current);
      copyUrlTimer.current = setTimeout(() => setCopiedUrl(false), 1500);
    }).catch(() => {
      // Clipboard write failed silently — no feedback shown
    });
  }, [url]);

  const copyBody = (
    <Tooltip title={copiedData ? "Copied!" : "Copy to clipboard"}>
      <IconButton size="small" aria-label="Copy the response" onClick={handleCopyData} color={copiedData ? "success" : "default"} sx={{ flexShrink: 0, mx: 0.5 }}>
        {copiedData ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, minHeight: 40, px: 1.5, py: 0.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {response ? (
            <ResponseStatusLine response={response} />
          ) : contentType ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Content-Type: {contentType}
            </Typography>
          ) : !notTheRequestLine && (
            <Typography variant="subtitle2" component="div">Response</Typography>
          )}
          {notTheRequestLine && (
            <Typography variant="caption" noWrap title={url} sx={{ color: 'text.secondary', display: 'block' }}>
              {isStored ? '' : 'Sent: '}{shortUrl(url)}
            </Typography>
          )}
        </Box>
        {notTheRequestLine && (
          <Tooltip title={copiedUrl ? "Copied!" : "Copy URL"}>
            <IconButton
              size="small"
              aria-label="Copy URL"
              onClick={handleCopyUrl}
              color={copiedUrl ? "success" : "default"}
              sx={{ flexShrink: 0 }}
            >
              {copiedUrl ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Close (R)">
          <IconButton size="small" aria-label="Close the response pane" onClick={onClose} sx={{ flexShrink: 0 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!url && !isLoading && (
          <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
            Nothing sent yet. Choose a query and press Send, and its response shows here.
          </Typography>
        )}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        )}

        {error && <FetchErrorAlert message={error} onRetry={onRetry} />}

        {tabs.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tabs
              value={tab}
              onChange={(_event, value: ResponseTab) => setPreferredTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Ways to read this response"
              sx={{ flex: 1, minWidth: 0, minHeight: 36 }}
            >
              {tabs.map(name => (
                <Tab
                  key={name}
                  value={name}
                  label={name === 'checks' ? <ChecksTabLabel findings={allFindings} /> : TAB_NAMES[name]}
                  sx={{ minHeight: 36, minWidth: 0, px: 1.5, py: 0, textTransform: 'none' }}
                />
              ))}
            </Tabs>
            {tab === 'raw' && data && copyBody}
          </Box>
        )}

        {!isLoading && response && tab === 'headers' && <ResponseHeaders headers={response.headers} />}

        {!isLoading && response && tab === 'sizes' && <ResponseSizes response={response} />}

        {!isLoading && response && tab === 'checks' && (
          <ResponseChecks
            schemaName={validationSchemaName}
            findings={validationErrors}
            lines={errorLineList}
            onGoToLine={index => {
              setNoteLine(null);
              goToError(index);
              setPreferredTab('raw');
            }}
            dataNotes={dataNotes}
            onGoToNote={line => {
              setNoteLine(line);
              setPreferredTab('raw');
            }}
          />
        )}

        {!isLoading && tab === 'data' && imageUrl && (
          <Box sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background.default',
            backgroundImage:
              'linear-gradient(45deg, rgba(127,127,127,0.15) 25%, transparent 25%),' +
              'linear-gradient(-45deg, rgba(127,127,127,0.15) 25%, transparent 25%),' +
              'linear-gradient(45deg, transparent 75%, rgba(127,127,127,0.15) 75%),' +
              'linear-gradient(-45deg, transparent 75%, rgba(127,127,127,0.15) 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
            p: 2,
          }}>
            <img
              src={imageUrl}
              alt="API response"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}
            />
          </Box>
        )}

        {!isLoading && tab === 'data' && coverage && (
          <CoverageData summary={coverage} view={coverageView} onViewChange={setCoverageView} />
        )}

        {!isLoading && tab === 'data' && data && !coverage && (
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', backgroundColor: 'background.paper' }}>
            {transformedHtml && !isTransforming ? (
              <iframe
                srcDoc={transformedHtml}
                // The stylesheet's output from the API's XML: no scripts, and not the app's origin
                sandbox=""
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block'
                }}
                title="IWXXM Preview"
              />
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress size={32} />
                <Typography variant="body2" sx={{ color: 'text.secondary', ml: 1.5 }}>
                  Transforming XSLT...
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {!isLoading && tab === 'raw' && response && !data && (
          <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
            The response has no body.
          </Typography>
        )}

        {!isLoading && tab === 'raw' && data && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {(errorLineList.length > 0 || tabs.length === 0) && (
              <Box role="toolbar" aria-label="The response's text" sx={{
                px: 1,
                py: 0.25,
                backgroundColor: 'background.default',
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 0.5,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  {errorLineList.length > 0 && (
                    <>
                      <Chip
                        icon={<ErrorOutlineIcon />}
                        label={`${errorLineList.length} line${errorLineList.length === 1 ? '' : 's'} flagged`}
                        color={flaggedColor}
                        size="small"
                        variant="outlined"
                      />
                      <Tooltip title={`Previous flagged line (${modifier}+↑)`}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={handlePrevError}
                            disabled={currentErrorIdx <= 0}
                            aria-label="Previous flagged line"
                          >
                            <KeyboardArrowUpIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Typography variant="caption" sx={{ minWidth: 32, textAlign: 'center', userSelect: 'none' }}>
                        {currentErrorIdx + 1}/{errorLineList.length}
                      </Typography>
                      <Tooltip title={`Next flagged line (${modifier}+↓)`}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={handleNextError}
                            disabled={currentErrorIdx >= errorLineList.length - 1}
                            aria-label="Next flagged line"
                          >
                            <KeyboardArrowDownIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </Box>
                {tabs.length === 0 && copyBody}
              </Box>
            )}

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
                borderLeft: `3px solid ${theme.palette[flaggedColor].main}`,
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
                {currentError.errors.map((err, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    {err.path && (
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.secondary' }}>
                        {err.path}
                      </Typography>
                    )}
                    {err.keyword && (
                      <Chip label={err.keyword} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 16 }} />
                    )}
                    <Typography variant="caption" sx={{ color: 'text.primary' }}>{findingMessage(err)}</Typography>
                  </Box>
                ))}
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
              {shouldUseCodeView ? (
                <VirtualizedCodeView
                  code={formattedData}
                  language={language}
                  isDark={theme.palette.mode === 'dark'}
                  errorLines={markedLines}
                  gutterRanges={gutterRanges}
                  errorColor={theme.palette[flaggedColor].main}
                  scrollToLine={noteLine ?? scrollLine}
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
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ResponsePane;
