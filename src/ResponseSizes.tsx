import { Fragment, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { responseSizes } from './api/responseSizes';
import type { ResponseDetails } from './api/sendRequest';
import { formatBytes } from './utils/formatResponse';

const exactly = (bytes: number) => (bytes < 1000 ? `${bytes} B` : `${formatBytes(bytes)} (${bytes} B)`);

const HIDDEN = <Box component="span" sx={{ color: 'text.secondary' }}>Hidden</Box>;

function compressionText(ratio: number | null, encoding: string | null) {
  if (ratio === null) return encoding ? <>{encoding}, by how much is {HIDDEN}</> : HIDDEN;
  if (ratio === 1) return encoding ? `None, despite ${encoding}` : 'None';
  return `${ratio.toFixed(1)}×${encoding ? `, ${encoding}` : ''}`;
}

const Group = ({ title, rows }: { title: string; rows: [string, ReactNode][] }) => (
  <>
    <Typography component="h3" variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 500, mb: 0.5 }}>{title}</Typography>
    <Box
      component="dl"
      sx={{
        display: 'grid',
        // The longest label's width, so that both groups' columns line up
        gridTemplateColumns: '18ch minmax(0, 1fr)',
        columnGap: 2,
        rowGap: 0.25,
        m: 0,
        mb: 2,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        lineHeight: '18px',
        '& dd': { m: 0, overflowWrap: 'anywhere' },
      }}
    >
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <Box component="dt" sx={{ color: 'text.secondary' }}>{label}</Box>
          <Box component="dd">{value}</Box>
        </Fragment>
      ))}
    </Box>
  </>
);

// How big the request and response were, as far as a page is allowed to know. A browser's own inspector
// sees more, so what's hidden says so, and what an API can send to reveal it.
export default function ResponseSizes({ response }: { response: ResponseDetails }) {
  const { requestUrl, bodyUnpacked, bodyOnWire, compression, encoding, fromCache } = responseSizes(response);
  const compressedUnnamed = compression !== null && compression > 1 && !encoding;

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
      <Group title="Request" rows={[['URL', exactly(requestUrl)], ['Headers', HIDDEN], ['Body', 'None']]} />
      <Group
        title="Response"
        rows={[
          ['Body, unpacked', exactly(bodyUnpacked)],
          ['Body, on the wire', bodyOnWire === null ? HIDDEN : exactly(bodyOnWire)],
          ['Compression', compressionText(compression, encoding)],
          ['Headers', HIDDEN],
          ['From the cache', fromCache === null ? HIDDEN : fromCache ? 'Yes' : 'No'],
        ]}
      />
      <Box component="ul" sx={{ m: 0, pl: 2.5, typography: 'caption', color: 'text.secondary', '& li': { mb: 0.5 } }}>
        {bodyOnWire === null && <li>For the size on the wire, the API can send Content-Length or Timing-Allow-Origin.</li>}
        {fromCache === null && <li>For whether it came from the browser&apos;s cache, the API can send Timing-Allow-Origin.</li>}
        {compressedUnnamed && <li>To name the compression, the API can list Content-Encoding in Access-Control-Expose-Headers.</li>}
        <li>Browsers don&apos;t tell a page how big headers are. Your browser&apos;s own inspector shows them.</li>
      </Box>
    </Box>
  );
}
