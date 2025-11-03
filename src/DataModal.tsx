import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
  
  const handleCopyData = () => {
    if (data) {
      navigator.clipboard.writeText(data);
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
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {url}
        </Typography>
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
              <Typography variant="body2" color="text.secondary">
                Content Type: {getContentTypeLabel()}
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton size="small" onClick={handleCopyData}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            
            <Box sx={{ 
              flex: 1, 
              overflow: 'auto',
              p: 0,
              backgroundColor: 'background.paper'
            }}>
              {shouldUseSyntaxHighlighting() ? (
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
