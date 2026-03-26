import React, { useState } from 'react';
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
import { useContentTypeDetection } from './hooks/useContentTypeDetection';
import { useXSLTTransform } from './hooks/useXSLTTransform';
import { useValidationErrorNavigation } from './hooks/useValidationErrorNavigation';

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

  const {
    parsedJson, isIWXXM, isCoverageJsonPointSeries, shouldShowToggle,
    contentTypeLabel, language, shouldUseCodeView, formattedData,
  } = useContentTypeDetection(data, contentType);

  const { transformedHtml, transformError } = useXSLTTransform(data, viewMode, isIWXXM, setViewMode);

  const {
    errorLineList, errorLines, gutterRanges,
    currentErrorIdx, currentError, handlePrevError, handleNextError,
  } = useValidationErrorNavigation(validationErrors, formattedData, contentType, scrollToPath, open);

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
                  Content Type: {contentTypeLabel}
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
                shouldUseCodeView ? (
                  <VirtualizedCodeView
                    code={formattedData}
                    language={language}
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
