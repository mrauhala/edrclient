import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { usePanes } from '../contexts/PanesContext';
import { useResponseCells } from '../contexts/responseCells';
import { useElementWidth } from '../hooks/useElementWidth';
import CellReadout from './CellReadout';
import CellsCanvas from './CellsCanvas';
import { notesFor, sliceIndex, type Flip, type RangeMode, type RangeScope } from './cellSelection';
import type { RampKind } from './colourScale';
import type { CellNote } from './coverageCells';
import { formatValue } from './coverageSummary';
import ParameterPicker from './ParameterPicker';
import StepBars from './StepBars';
import ValueLegend from './ValueLegend';

// From here, as with the map closed, the readout and the rest go beside the picture, all in sight at once
const WIDE_PANE = 880;
const SIDE_COLUMN = 400;
const MONO = { fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '18px' };
const SMALL_TOGGLE = { '& .MuiToggleButton-root': { height: 26, px: 1, py: 0, textTransform: 'none', fontSize: '0.75rem' } };
const NOTE_ICONS = {
  warn: <WarningAmberIcon fontSize="small" color="warning" aria-label="Worth a look" />,
  error: <ErrorOutlineIcon fontSize="small" color="error" aria-label="Wrong" />,
  info: <InfoOutlinedIcon fontSize="small" color="action" aria-label="Note" />,
};

function MapChoice() {
  const { picture, choices, choose } = useResponseCells();
  const { isMobile, isOpen, showPane } = usePanes();
  if (!picture) return null;
  if (!picture.cells.crs.geographic) {
    return <Box title="The response's x and y aren't in a CRS the map can place" sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>Can't go on the map</Box>;
  }
  if (!isMobile && !isOpen.map) {
    return <Link component="button" sx={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }} onClick={() => showPane('map')}>Show the map</Link>;
  }
  return (
    <FormControlLabel
      control={<Checkbox size="small" checked={choices.onMap} onChange={event => choose({ onMap: event.target.checked })} sx={{ p: 0.5 }} />}
      label="On the map"
      slotProps={{ typography: { sx: { fontSize: '0.8125rem', whiteSpace: 'nowrap' } } }}
      sx={{ m: 0 }}
    />
  );
}

function CellControls() {
  const { picture, choices, choose } = useResponseCells();
  if (!picture) return null;
  const { cells, figures } = picture;
  const { range, setLo, setHi, ramp, flip } = choices;
  const unlit = { litHover: null, litPinned: null };
  const numberField = (label: string, value: number | null, onChange: (next: number | null) => void) => (
    <TextField
      size="small"
      type="number"
      label={label}
      defaultValue={value ?? ''}
      key={`${label}${cells.domainType}`}
      onBlur={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
      onKeyDown={event => {
        if (event.key === 'Enter') onChange((event.target as HTMLInputElement).value === '' ? null : Number((event.target as HTMLInputElement).value));
      }}
      slotProps={{ htmlInput: { step: 'any', style: { fontSize: '0.75rem', padding: '4px 6px', width: 76 } }, inputLabel: { shrink: true, sx: { fontSize: '0.75rem' } } }}
    />
  );

  return (
    <Box sx={{ px: 1.75, mt: 0.5 }}>
      {figures.numbers > 0 && !figures.oneValue && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={range}
            aria-label="Colour range"
            sx={SMALL_TOGGLE}
            onChange={(_event, next: RangeMode | null) => {
              if (!next) return;
              const first = next === 'set' && setLo === null;
              choose({
                range: next,
                ...unlit,
                ...(first ? { setLo: Number(formatValue(figures.lo ?? 0)), setHi: Number(formatValue(figures.hi ?? 0)) } : {}),
              });
            }}
          >
            <ToggleButton value="auto">Auto</ToggleButton>
            <ToggleButton value="all" disabled={figures.apart.length === 0}>All values</ToggleButton>
            <ToggleButton value="set">Set</ToggleButton>
          </ToggleButtonGroup>
          {range === 'set' && (
            <>
              {numberField('from', setLo, next => choose({ setLo: next, ...unlit }))}
              {numberField('to', setHi, next => choose({ setHi: next, ...unlit }))}
            </>
          )}
          {cells.slices > 1 && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={picture.scope}
              aria-label="What the colours cover"
              sx={SMALL_TOGGLE}
              onChange={(_event, next: RangeScope | null) => {
                if (next) choose({ scope: next, ...unlit });
              }}
            >
              <ToggleButton value="all">All steps</ToggleButton>
              <ToggleButton value="this">{cells.dims.some(dim => dim.name === 'z') ? 'This level' : 'This time'}</ToggleButton>
            </ToggleButtonGroup>
          )}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={ramp}
            aria-label="Colour scale"
            sx={SMALL_TOGGLE}
            onChange={(_event, next: RampKind | null) => {
              if (next) choose({ ramp: next, ...unlit });
            }}
          >
            <ToggleButton value="sequential">Sequential</ToggleButton>
            <ToggleButton value="diverging">Around 0</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}
      {cells.geometry.kind === 'grid' && cells.geometry.cells > 1 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 1 }}>
          <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Try it</Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={flip}
            aria-label="Try the picture flipped"
            sx={SMALL_TOGGLE}
            onChange={(_event, next: Flip | null) => {
              if (next) choose({ flip: next, ...unlit });
            }}
          >
            <ToggleButton value="none">As sent</ToggleButton>
            <ToggleButton value="ns">Flipped N–S</ToggleButton>
            <ToggleButton value="ew">Flipped E–W</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}
    </Box>
  );
}

function CellStats() {
  const { picture, choices } = useResponseCells();
  if (!picture) return null;
  const { cells, parameter } = picture;
  const { figures } = parameter;
  const slice = sliceIndex(cells.dims, choices.steps);
  const here = figures.perSlice[slice];
  const unit = parameter.unit ? ` ${parameter.unit}` : '';
  const span = (a: number, b: number) => (a === b ? formatValue(a) : `${formatValue(a)} to ${formatValue(b)}`);
  let without: string | null = null;
  if (figures.apart.length && here.numbers && figures.lo !== null && figures.hi !== null) {
    let count = 0;
    let sum = 0;
    const from = slice * cells.cells;
    for (let i = 0; i < cells.cells; i++) {
      const value = parameter.data[from + i];
      if (value === value && value >= figures.lo && value <= figures.hi) {
        count++;
        sum += value;
      }
    }
    if (count) without = `Without what's far off: ${span(figures.lo, figures.hi)}${unit}, mean ${formatValue(sum / count)}`;
  }
  const noun = cells.geometry.kind === 'samples' ? 'point' : 'cell';
  return (
    <Box sx={{ ...MONO, px: 1.75, mt: 1 }}>
      <div>{here.numbers && here.min !== null && here.max !== null && here.mean !== null ? `${span(here.min, here.max)}${unit}, mean ${formatValue(here.mean)}` : 'No numbers'}</div>
      {without && <div>{without}</div>}
      {cells.slices > 1 && (
        <Box sx={{ color: 'text.secondary' }}>
          All {cells.slices} steps: {figures.numbers && figures.min !== null && figures.max !== null ? `${span(figures.min, figures.max)}${unit}, ` : ''}{figures.nulls.toLocaleString('en-US')} null
        </Box>
      )}
      <Box sx={{ fontFamily: 'inherit', color: here.nulls ? 'primary.main' : 'text.secondary' }}>
        {cells.cells.toLocaleString('en-US')} {noun}{cells.cells === 1 ? '' : 's'}, {here.nulls.toLocaleString('en-US')} null{parameter.notNumbers ? `, ${parameter.notNumbers.toLocaleString('en-US')} not a number` : ''}
      </Box>
    </Box>
  );
}

function CellNotes() {
  const { picture, url } = useResponseCells();
  if (!picture) return null;
  const notes: CellNote[] = notesFor(picture.cells, picture.parameter, url);
  if (!notes.length) return null;
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 1, px: 1.75, pb: 1.5 }}>
      {notes.map(note => (
        <Box component="li" key={note.text} sx={{ display: 'flex', gap: 1, py: 0.75, borderTop: '1px solid', borderColor: 'divider', fontSize: '0.8125rem', lineHeight: '18px' }}>
          {NOTE_ICONS[note.level]}
          <span>{note.text}</span>
        </Box>
      ))}
    </Box>
  );
}

// The picture of the cells, and everything to read it with. It all comes from the one response
export default function CellsView() {
  const { choices } = useResponseCells();
  const [setRoot, width] = useElementWidth();
  const wide = width >= WIDE_PANE;
  return (
    <Box ref={setRoot} sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider', pt: 0.75, pb: 1 }}>
      <Box sx={wide ? { display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${SIDE_COLUMN}px`, alignItems: 'start' } : undefined}>
        {/* Stays in sight while the notes beside it are read */}
        <Box sx={wide ? { position: 'sticky', top: 0, minWidth: 0 } : undefined}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '4px 12px', px: 1.75, pb: 0.5 }}>
            <ParameterPicker />
            <MapChoice />
          </Box>
          <StepBars />
          {choices.flip !== 'none' && (
            <Box sx={{ display: 'flex', gap: 1, mx: 1.75, my: 0.5, px: 1, py: 0.5, border: '1px solid', borderColor: 'warning.main', borderRadius: 1, fontSize: '0.8125rem' }}>
              <WarningAmberIcon fontSize="small" color="warning" />
              <span>Drawn flipped {choices.flip === 'ns' ? 'north to south' : 'east to west'}, on the map too. This is not what the response says</span>
            </Box>
          )}
          <CellsCanvas readoutBelow={!wide} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <CellReadout />
          <ValueLegend />
          <CellControls />
          <CellStats />
          <CellNotes />
        </Box>
      </Box>
    </Box>
  );
}
