import { Fragment } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ResponseHeader } from './api/sendRequest';

// The response's headers. Stacked on phones, where a long name would leave its value no room
export default function ResponseHeaders({ headers }: { headers: ResponseHeader[] }) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'max-content minmax(0, 1fr)' },
          columnGap: 2,
          rowGap: 0.5,
          m: 0,
          fontFamily: 'monospace',
          fontSize: '0.875rem',
        }}
      >
        {headers.map(({ name, value }) => (
          <Fragment key={name}>
            <Box component="dt" sx={{ color: 'text.secondary' }}>{name}</Box>
            <Box component="dd" sx={{ m: 0, mb: { xs: 1, sm: 0 }, overflowWrap: 'anywhere' }}>{value}</Box>
          </Fragment>
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2 }}>
        A browser only lets this app read the headers the API exposes through CORS (Access-Control-Expose-Headers), so the server may have sent more.
      </Typography>
    </Box>
  );
}
