import React, { useState, useEffect, useCallback } from 'react';
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
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CoverageJsonChart from './CoverageJsonChart';

interface DataModalProps {
  open: boolean;
  onClose: () => void;
  data: string | null;
  contentType: string | null;
  isLoading: boolean;
  error: string | null;
  url: string;
}

const DataModal: React.FC<DataModalProps> = ({ 
  open, 
  onClose, 
  data, 
  contentType, 
  isLoading, 
  error, 
  url 
}) => {
  const theme = useTheme();
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [transformedHtml, setTransformedHtml] = useState<string | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);
  
  // Check if data is IWXXM XML
  const isIWXXM = useCallback(() => {
    if (!data || !contentType) return false;
    return contentType.includes('xml') && 
           (data.includes('iwxxm/3.0') || data.includes('iwxxm/2.1') || 
            data.includes('METAR') || data.includes('TAF') || data.includes('SIGMET'));
  }, [data, contentType]);
  
  // Check if data is CoverageJSON PointSeries or Grid with single point
  const isCoverageJsonPointSeries = useCallback(() => {
    if (!data || !contentType) return false;
    if (!contentType.includes('json')) return false;
    
    try {
      const parsed = JSON.parse(data);
      if (parsed.type !== 'Coverage') return false;
      
      const domainType = parsed.domain?.domainType;
      
      // PointSeries is supported
      if (domainType === 'PointSeries') return true;
      
      // Grid with single x,y point is also supported
      if (domainType === 'Grid') {
        const xValues = parsed.domain?.axes?.x?.values;
        const yValues = parsed.domain?.axes?.y?.values;
        return xValues?.length === 1 && yValues?.length === 1;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }, [data, contentType]);
  
  // Check if we should show code/preview toggle
  const shouldShowToggle = useCallback(() => {
    return isIWXXM() || isCoverageJsonPointSeries();
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

  const formatData = () => {
    if (!data) return '';
    
    try {
      // Try to parse and pretty-print JSON
      if (contentType?.includes('json')) {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      }
    } catch (e) {
      // If parsing fails, return as-is
    }
    
    return data;
  };

  const shouldUseSyntaxHighlighting = () => {
    const language = getLanguage();
    return language === 'json' || language === 'xml';
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Content Type: {getContentTypeLabel()}
                </Typography>
                
                {shouldShowToggle() && (
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
            
            <Box sx={{ 
              flex: 1, 
              overflow: 'auto',
              p: 0,
              backgroundColor: 'background.paper'
            }}>
              {viewMode === 'preview' && isIWXXM() && transformedHtml ? (
                <iframe
                  srcDoc={transformedHtml}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block'
                  }}
                  title="IWXXM Preview"
                />
              ) : viewMode === 'preview' && isCoverageJsonPointSeries() ? (
                <CoverageJsonChart data={data} />
              ) : (
                shouldUseSyntaxHighlighting() ? (
                  <SyntaxHighlighter
                    language={getLanguage()}
                    style={theme.palette.mode === 'dark' ? vscDarkPlus : vs}
                    customStyle={{
                      margin: 0,
                      padding: '16px',
                      fontSize: '0.875rem',
                      backgroundColor: 'transparent',
                    }}
                    showLineNumbers
                    wrapLines
                    wrapLongLines
                  >
                    {formatData()}
                  </SyntaxHighlighter>
                ) : (
                  <pre style={{ 
                    margin: 0, 
                    padding: '16px',
                    fontFamily: 'monospace', 
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {formatData()}
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
