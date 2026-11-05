import { Fragment } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ResponseHeader } from './api/sendRequest';

// The response's headers. Stacked in a narrow pane, where a long name would leave its value no room
export default function ResponseHeaders({ headers }: { headers: ResponseHeader[] }) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2, containerType: 'inline-size' }}>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          columnGap: 1,
          m: 0,
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: '18px',
          '& dt': { overflowWrap: 'anywhere' },
          '& dd': { m: 0, mb: 1, overflowWrap: 'anywhere' },
          '@container (min-width: 440px)': {
            gridTemplateColumns: 'minmax(0, 214px) minmax(0, 1fr)',
            '& dd': { mb: 0 },
          },
        }}
      >
        {headers.map(({ name, value }) => (
          <Fragment key={name}>
            <Box component="dt" sx={{ color: 'primary.main' }}>{name}</Box>
            <Box component="dd">{value}</Box>
          </Fragment>
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2 }}>
        A browser only lets this app read the headers the API exposes through CORS (Access-Control-Expose-Headers), so the server may have sent more.
      </Typography>
    </Box>
  );
}
