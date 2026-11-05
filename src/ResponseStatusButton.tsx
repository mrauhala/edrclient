import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import type { ResponseDetails } from './api/sendRequest';
import { formatBytes, formatDuration } from './utils/formatResponse';

interface ResponseStatusButtonProps {
  response: ResponseDetails | null;
  isLoading: boolean;
  hasError: boolean;
  onClick: () => void;
}

// In the bottom bar while the response pane is closed: how the last request went, and the way back to its response
export default function ResponseStatusButton({ response, isLoading, hasError, onClick }: ResponseStatusButtonProps) {
  if (!isLoading && !response && !hasError) return null;

  const label = isLoading ? 'Waiting…'
    : response ? `${response.status} · ${formatDuration(response.timeMs)} · ${formatBytes(response.sizeBytes)}`
      : 'No response';

  return (
    <Tooltip title="Show the response (R)">
      <Button
        size="small"
        color={hasError ? 'error' : isLoading ? 'inherit' : 'success'}
        startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : undefined}
        onClick={onClick}
        sx={{ flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'none' }}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
