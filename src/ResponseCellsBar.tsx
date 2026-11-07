import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useResponseCells } from './contexts/responseCells';
import { stepLabel, stepOf } from './coverage/cellSelection';
import { rampGradient } from './coverage/colourScale';
import { useCellsPalette } from './coverage/useCellsPalette';

const MONO = { fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '17px' };
const fourDigits = (value: number) => String(Number(value.toPrecision(4)));

// The map's small key and stepper, so stepping works with the response pane closed. All the controls are in the pane
export default function ResponseCellsBar({ shows, outOfView, onGoToData }: { shows: boolean; outOfView: boolean; onGoToData: () => void }) {
  const { picture, choices, choose } = useResponseCells();
  const palette = useCellsPalette();
  if (!shows || !picture) return null;
  const { cells, parameter, lo, hi } = picture;

  return (
    <Paper
      elevation={6}
      // Clear of the attribution button at the map's corner
      sx={{ alignSelf: 'flex-start', ml: '10px', mb: '6px', maxWidth: 'calc(100% - 62px)', px: 1.25, py: 0.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', pointerEvents: 'auto', opacity: 0.97 }}
    >
      <Box sx={{ minWidth: 120 }}>
        <Box sx={{ ...MONO, whiteSpace: 'nowrap' }}>{parameter.id}{parameter.unit ? ` ${parameter.unit}` : ''}</Box>
        {lo === null || hi === null ? (
          <Box sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>All null: only the outline is drawn</Box>
        ) : (
          <>
            <Box sx={{ height: 6, mt: 0.25, backgroundImage: rampGradient(choices.ramp, palette.mode) }} />
            <Box sx={{ ...MONO, fontSize: '0.6875rem', lineHeight: '14px', display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <span>{fourDigits(lo)}</span>
              <span>{fourDigits(hi)}</span>
            </Box>
          </>
        )}
      </Box>
      {cells.dims.map(dim => {
        const step = stepOf(dim, choices.steps);
        const last = dim.values.length - 1;
        const go = (next: number) => choose({ steps: { ...choices.steps, [dim.name]: next } });
        return (
          <Box key={dim.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <IconButton size="small" aria-label={`Previous ${dim.name} on the map`} disabled={step === 0} onClick={() => go(step - 1)} sx={{ p: 0.25 }}><NavigateBeforeIcon fontSize="small" /></IconButton>
            <Box sx={{ ...MONO, whiteSpace: 'nowrap' }}>{stepLabel(cells, dim, step)}</Box>
            <IconButton size="small" aria-label={`Next ${dim.name} on the map`} disabled={step === last} onClick={() => go(step + 1)} sx={{ p: 0.25 }}><NavigateNextIcon fontSize="small" /></IconButton>
          </Box>
        );
      })}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 110 }}>
        <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Opacity</Box>
        <Slider
          size="small"
          aria-label="Opacity of the response on the map"
          min={0}
          max={1}
          step={0.05}
          value={choices.opacity}
          onChange={(_event, value) => choose({ opacity: value as number })}
          sx={{ width: 64 }}
        />
      </Box>
      {outOfView && <Button size="small" onClick={onGoToData} sx={{ textTransform: 'none', py: 0, minHeight: 26 }}>Go to the data</Button>}
    </Paper>
  );
}
