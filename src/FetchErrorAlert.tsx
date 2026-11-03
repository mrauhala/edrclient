import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';

interface FetchErrorAlertProps {
  message: string;
  // Only when the same request may well succeed later (rate limits, server errors, network failures)
  onRetry?: () => void;
}

// The result window's error, with a way to send the request again without closing the window
export default function FetchErrorAlert({ message, onRetry }: FetchErrorAlertProps) {
  const modifier = navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl';
  return (
    <Box sx={{ p: 2 }}>
      <Alert
        severity="error"
        action={onRetry && (
          <Tooltip title={`Send the request again (${modifier}+Enter)`}>
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRetry}>
              Try again
            </Button>
          </Tooltip>
        )}
      >
        <Typography variant="subtitle2">Error fetching data:</Typography>
        <Typography variant="body2">{message}</Typography>
      </Alert>
    </Box>
  );
}
