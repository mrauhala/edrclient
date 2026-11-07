import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { useOpenRequest } from '../contexts/OpenRequestContext';
import { useResponseCells } from '../contexts/responseCells';
import { longestReadout, positionUrl, sourceCell } from './cellSelection';
import { OUTSIDE_CSS } from './colourScale';
import type { DrawableCells } from './coverageCells';
import { isTouch } from './touch';

const MONO = { fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '18px' };
const action = { fontSize: '0.8125rem', verticalAlign: 'baseline' };

const NULL_WORD = { color: 'text.secondary', fontStyle: 'italic' };
const ACTION_ROW = { display: 'flex', flexWrap: 'wrap', gap: '2px 12px', mt: 0.5 };

interface LinesProps {
  value: ReactNode;
  under: string;
  pinned: boolean;
  where: string;
  pointer: string | null;
  actions: ReactNode;
}

// The readout's lines. The same for what's shown and for the room kept for it, so that the two wrap alike
function ReadoutLines({ value, under, pinned, where, pointer, actions }: LinesProps) {
  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px' }}>
        <Box sx={{ fontFamily: 'monospace', fontSize: '0.9375rem', lineHeight: '22px', overflowWrap: 'anywhere' }}>{value}</Box>
        {under && <Box sx={{ ...NULL_WORD, fontSize: '0.75rem' }}>{under}</Box>}
        {pinned && <Box sx={{ ml: 'auto', fontSize: '0.75rem', color: 'primary.main' }}>Pinned</Box>}
      </Box>
      <Box sx={{ ...MONO, overflowWrap: 'anywhere' }}>{where}</Box>
      {pointer && <Box sx={{ ...MONO, color: 'text.secondary', overflowWrap: 'anywhere' }}>{pointer}</Box>}
      {actions}
    </>
  );
}

const placeOf = (g: DrawableCells['geometry'], cell: number) => {
  if (g.kind === 'grid') {
    const row = Math.floor(cell / g.nx);
    return `x ${g.xs[cell - row * g.nx]}, y ${g.ys[row]}`;
  }
  if (g.kind === 'samples') return `x ${g.xs[cell]}, y ${g.ys[cell]}`;
  const first = g.offsets[cell];
  const corners = g.offsets[cell + 1] - first - 1;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < corners; i++) {
    sumX += g.pts[(first + i) * 2];
    sumY += g.pts[(first + i) * 2 + 1];
  }
  return `about x ${(sumX / corners).toFixed(5)}, y ${(sumY / corners).toFixed(5)}`;
};

// A fixed place for what's pointed at, not a floating tooltip, so it can't cover a cell or sit under a finger. It keeps
// the room for the longest it can hold, so it doesn't change height as the pointer moves, and it cuts nothing off
export default function CellReadout() {
  const { picture, choices, choose, hover, url, openInRaw } = useResponseCells();
  const { openRequest } = useOpenRequest();
  const hovered = useSyncExternalStore(hover.subscribe, hover.get, hover.get);
  const { pin, flip, steps } = choices;
  const [filledIn, setFilledIn] = useState(false);
  useEffect(() => setFilledIn(false), [pin, picture?.cells]);
  const cells = picture?.cells;
  const parameter = picture?.parameter;
  const longest = useMemo(() => (cells && parameter ? longestReadout(cells, parameter) : null), [cells, parameter]);

  if (!picture || !cells || !parameter || !longest) return null;
  const { slice, codes } = picture;
  const g = cells.geometry;
  const chosen = hovered?.cell ?? pin;
  // A hover from the response before this one, for the moment until it's cleared
  const cell = chosen !== null && chosen < cells.cells ? chosen : null;

  let shown: ReactNode;
  if (cell === null) {
    shown = (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', fontSize: '0.8125rem', lineHeight: '18px', color: 'text.secondary' }}>
        {isTouch()
          ? 'Tap a cell for its exact value and where it is in the response.'
          : 'Point at a cell for its exact value and where it is in the response. Click to pin it.'}
      </Box>
    );
  } else {
    const source = sourceCell(g, cell, flip);
    const raw = parameter.rawAt(source, slice);
    const indices = parameter.indicesAt(source, slice).map(([name, index]) => `${name} ${index}`).join(', ');
    const pinned = pin === cell;
    const toPosition = pinned ? positionUrl(url, cells, parameter, cell, steps) : null;
    shown = (
      <ReadoutLines
        value={raw.absent ? <Box component="span" sx={NULL_WORD}>No point here in the response</Box>
          : raw.value === null || raw.value === undefined ? <Box component="span" sx={NULL_WORD}>null</Box>
            : typeof raw.value !== 'number' ? <>{JSON.stringify(raw.value)} <Box component="span" sx={NULL_WORD}>not a number</Box></>
              : (
                <>
                  {codes[cell] > 256 && <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 10, height: 10, mr: 0.75, backgroundColor: OUTSIDE_CSS }} />}
                  {String(raw.value)}{parameter.unit ? ` ${parameter.unit}` : ''}
                </>
              )}
        under={hovered && hovered.under > 1 ? `one of ${hovered.under} under this pixel` : ''}
        pinned={pinned}
        where={`${indices ? `[${indices}] ` : ''}${placeOf(g, cell)}`}
        pointer={raw.pointer}
        actions={pinned && (
          <Box sx={ACTION_ROW}>
            <Link component="button" sx={action} onClick={() => choose({ pin: null })}>Unpin</Link>
            {raw.pointer && <Link component="button" sx={action} onClick={() => { void navigator.clipboard?.writeText(raw.pointer ?? '').catch(() => {}); }}>Copy path</Link>}
            {raw.pointer && openInRaw && <Link component="button" sx={action} onClick={() => openInRaw(raw.pointer ?? '')}>Open in Raw</Link>}
            {toPosition && (
              <Link
                component="button"
                sx={action}
                onClick={() => {
                  openRequest(toPosition, { switchApi: false });
                  setFilledIn(true);
                }}
              >
                Check with position
              </Link>
            )}
          </Box>
        )}
      />
    );
  }

  return (
    <Box data-cell-readout sx={{ mx: 1.75, mt: 1, px: 1.5, py: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'grid' }}>
        <Box aria-hidden sx={{ gridArea: '1 / 1', visibility: 'hidden' }}>
          <ReadoutLines
            value={longest.value}
            under={longest.under}
            pinned
            where={longest.where}
            pointer={longest.pointer}
            actions={<Box sx={ACTION_ROW}><Box sx={action}>Unpin</Box><Box sx={action}>Copy path</Box><Box sx={action}>Open in Raw</Box><Box sx={action}>Check with position</Box></Box>}
          />
        </Box>
        <Box aria-live="polite" sx={{ gridArea: '1 / 1', minWidth: 0 }}>{shown}</Box>
      </Box>
      {filledIn && <Box sx={{ mt: 0.5, fontSize: '0.75rem', lineHeight: '18px', color: 'text.secondary' }}>In the request line, not sent. Sending it replaces this response.</Box>}
    </Box>
  );
}
