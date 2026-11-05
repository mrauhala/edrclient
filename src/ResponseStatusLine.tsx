import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { isSuccessStatus } from './api/httpErrors';
import type { ResponseDetails } from './api/sendRequest';
import { formatBytes, formatDuration } from './utils/formatResponse';

// What the server answered, at a glance: 200 · 2.23 s · 7.6 KB · application/vnd.cov+json
export default function ResponseStatusLine({ response }: { response: ResponseDetails }) {
  const { status, statusText, timeMs, sizeBytes, contentType } = response;
  const facts = [formatDuration(timeMs), formatBytes(sizeBytes), contentType].filter(Boolean);
  return (
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
      <Box component="span" sx={{ color: isSuccessStatus(status) ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
        {statusText ? `${status} ${statusText}` : status}
      </Box>
      {` · ${facts.join(' · ')}`}
    </Typography>
  );
}
