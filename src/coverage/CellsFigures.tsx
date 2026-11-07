import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { useResponseCells } from '../contexts/responseCells';
import CellThumb from './CellThumb';
import { formatValue } from './coverageSummary';

const MONO = { fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '17px' };

// Every parameter with its thumbnail: the fastest way through many of them, where all-null ones stand out
export default function CellsFigures({ onOpen }: { onOpen: () => void }) {
  const { picture, choose } = useResponseCells();
  if (!picture) return null;
  const { cells } = picture;
  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', borderTop: '1px solid', borderColor: 'divider' }}>
      {cells.parameters.map(parameter => {
        const { figures } = parameter;
        const empty = figures.numbers === 0;
        return (
          <ButtonBase
            key={parameter.id}
            onClick={() => {
              choose({ parameterId: parameter.id, litHover: null, litPinned: null, range: 'auto', setLo: null, setHi: null });
              onOpen();
            }}
            sx={{ display: 'flex', width: '100%', alignItems: 'flex-start', justifyContent: 'flex-start', textAlign: 'left', gap: 1.25, px: 1.75, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <CellThumb parameter={parameter} width={56} height={40} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '0 8px' }}>
                <Box sx={{ ...MONO, overflowWrap: 'anywhere' }}>{parameter.id}</Box>
                <Box sx={{ fontSize: '0.75rem', lineHeight: '17px', color: empty ? 'warning.main' : figures.nulls ? 'primary.main' : 'text.secondary' }}>
                  {empty ? 'All null' : `${figures.total.toLocaleString('en-US')} values, ${figures.nulls.toLocaleString('en-US')} null`}
                </Box>
              </Box>
              {parameter.label && <Box sx={{ fontSize: '0.75rem', lineHeight: '17px', color: 'text.secondary' }}>{parameter.label}</Box>}
              {!empty && figures.min !== null && figures.mean !== null && (
                <Box sx={{ ...MONO, mt: 0.25 }}>
                  {formatValue(figures.min)}{figures.min !== figures.max && figures.max !== null ? ` to ${formatValue(figures.max)}` : ''}{parameter.unit ? ` ${parameter.unit}` : ' (no unit)'}, mean {formatValue(figures.mean)}
                </Box>
              )}
            </Box>
          </ButtonBase>
        );
      })}
      {cells.broken.map(parameter => (
        <Box key={parameter.id} sx={{ px: 1.75, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ ...MONO, overflowWrap: 'anywhere' }}>{parameter.id}</Box>
          <Box sx={{ fontSize: '0.75rem', lineHeight: '17px', color: 'error.main' }}>{parameter.problem}</Box>
        </Box>
      ))}
    </Box>
  );
}
