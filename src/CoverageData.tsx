import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTheme, type Theme } from '@mui/material/styles';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { ChartsText, type ChartsTextProps } from '@mui/x-charts/ChartsText';
import { LineChart, type MarkElementProps } from '@mui/x-charts/LineChart';
import {
  countText, formatValue, meanText, rangeText,
  type ChartedParameter, type CoverageSeries, type CoverageSummary, type ParameterFigures, type StepChange,
} from './coverage/coverageSummary';
import { useResponseCells } from './contexts/responseCells';
import { opensAsPicture } from './coverage/cellSelection';
import CellsFigures from './coverage/CellsFigures';
import CellsTable from './coverage/CellsTable';
import CellsView from './coverage/CellsView';
import CoverageTable from './CoverageTable';
import { formatTimeTick } from './utils/timeAxisTicks';
import { utcMoment } from './utils/utcTime';

export type CoverageView = 'cells' | 'chart' | 'table';

// Rows narrower than this put the words above a shorter chart
const NARROW = '@container (max-width: 440px)';
const NAME_COLUMN = 172;
// Room at the sides for half a time label, which the axis would otherwise shorten
const MARGIN = { left: 22, right: 22, top: 8, bottom: 8 };
const AXIS_HEIGHT = 36;
// A line per location takes only so many before none can be told apart. The rest are in the Table
const MOST_LINES = 8;

// Told apart by people with colour blindness too, on each theme's surface
const LOCATION_COLOURS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

export function lineColours(locations: number, theme: Theme): string[] {
  return locations === 1 ? [theme.palette.primary.main] : LOCATION_COLOURS[theme.palette.mode];
}

const MONO = { fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '17px' };

// Every point is marked, so that gaps and the server's time steps show. Small, since a row has
// a hundred points in a few hundred pixels
const dot = (r: number) => function Dot({ x, y, color }: MarkElementProps) {
  return <circle cx={x} cy={y} r={r} fill={color} />;
};
const DOTS = { few: dot(2.5), some: dot(2), many: dot(1.5) };
const dotFor = (times: number) => (times > 60 ? DOTS.many : times > 24 ? DOTS.some : DOTS.few);
// Thin enough beside the dots for those to show
const THIN_LINE = { '& .MuiLineElement-root': { strokeWidth: 1 } };

// Where a time is across the plot, from 0 to 1
export function timeFraction(times: number[], time: number): number {
  const span = times[times.length - 1] - times[0];
  return span > 0 ? (time - times[0]) / span : 0;
}

const plotX = (fraction: number) => `calc(${MARGIN.left}px + (100% - ${MARGIN.left + MARGIN.right}px) * ${fraction})`;

// A value at the cursor, as it reads beside a line
export const cursorText = (value: number | null, unit: string) => (value === null ? 'null' : unit ? `${formatValue(value)} ${unit}` : formatValue(value));

const LineKey = ({ color }: { color: string }) => (
  <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 12, height: 2, backgroundColor: color, flexShrink: 0, verticalAlign: 'middle' }} />
);

// Bold the time labels that carry a date line, i.e. the first labelled tick and each day change
const TimeTickLabel = (props: ChartsTextProps) => (
  <ChartsText {...props} style={{ ...props.style, fontWeight: props.text.includes('\n') ? 'bold' : undefined }} />
);

const Y_AXIS = [{ position: 'none' as const, domainLimit: 'strict' as const }];
const NO_TOOLTIP = { tooltip: { trigger: 'none' as const } };

interface ParameterRowProps {
  parameter: ChartedParameter;
  times: number[];
  colours: string[];
  changes: StepChange[];
  hover: number | null;
  onHover: (index: number | null) => void;
}

// A parameter's words, and its line or lines on its own scale, so that Pa doesn't flatten K
const ParameterRow = memo(function ParameterRow({ parameter, times, colours, changes, hover, onHover }: ParameterRowProps) {
  const theme = useTheme();
  const { id, label, unit, numbers, nulls, series } = parameter;

  const xAxis = useMemo(() => [{
    id: 'time', data: times, scaleType: 'utc' as const, position: 'none' as const, min: times[0], max: times[times.length - 1],
  }], [times]);
  const lines = useMemo(() => series.slice(0, MOST_LINES).map((data, index) => ({
    data, color: colours[index], showMark: true, connectNulls: false, curve: 'linear' as const,
  })), [series, colours]);
  const highlightedAxis = useMemo(() => (hover === null ? [] : [{ axisId: 'time', dataIndex: hover }]), [hover]);
  const slots = useMemo(() => ({ mark: dotFor(times.length) }), [times.length]);
  const fraction = hover === null ? 0 : timeFraction(times, times[hover]);
  const onRight = fraction > 0.55;

  return (
    <Box sx={{
      flex: '1 0 118px',
      display: 'grid',
      gridTemplateColumns: `${NAME_COLUMN}px minmax(0, 1fr)`,
      gap: 1.5,
      px: 1.75,
      py: 0.75,
      borderBottom: '1px solid',
      borderColor: 'divider',
      [NARROW]: { flex: '0 0 auto', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.5, px: 1.5 },
    }}>
      <Box sx={{ minWidth: 0, [NARROW]: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 8px' } }}>
        <Box sx={{ ...MONO, overflowWrap: 'anywhere' }} title={label ?? undefined}>{id}</Box>
        {label && <Box sx={{ fontSize: '0.75rem', lineHeight: '17px', color: 'text.secondary', [NARROW]: { display: 'none' } }}>{label}</Box>}
        <Box sx={{ ...MONO, mt: 0.5, [NARROW]: { mt: 0, color: 'text.secondary' } }}>
          {rangeText(parameter)}
          {meanText(parameter) && <Box sx={{ [NARROW]: { display: 'none' } }}>{meanText(parameter)}</Box>}
        </Box>
        <Box sx={{ fontSize: '0.75rem', lineHeight: '17px', color: nulls > 0 ? 'primary.main' : 'text.secondary', [NARROW]: { display: 'none' } }}>
          {countText(parameter)}
        </Box>
      </Box>
      <Box sx={{ position: 'relative', minHeight: 96, [NARROW]: { minHeight: 0, height: 72 } }}>
        {numbers === 0 ? (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'text.secondary' }}>
            {parameter.others > 0 ? 'Not numbers' : 'All null'}
          </Box>
        ) : (
          <Box sx={{ position: 'absolute', inset: 0 }}>
            <LineChart
              title={`${id} over time`}
              xAxis={xAxis}
              yAxis={Y_AXIS}
              series={lines}
              margin={MARGIN}
              grid={{ vertical: true }}
              hideLegend
              skipAnimation
              axisHighlight={{ x: 'line', y: 'none' }}
              highlightedAxis={highlightedAxis}
              onHighlightedAxisChange={items => onHover(items[0]?.dataIndex ?? null)}
              slots={slots}
              slotProps={NO_TOOLTIP}
              sx={THIN_LINE}
            >
              {changes.map(change => (
                <ChartsReferenceLine key={change.at} x={change.at} lineStyle={{ stroke: theme.palette.warning.main, strokeDasharray: '3 4' }} />
              ))}
            </LineChart>
          </Box>
        )}
        {hover !== null && (
          <Box sx={{
            ...MONO,
            position: 'absolute',
            top: 4,
            left: plotX(fraction),
            transform: onRight ? 'translateX(-100%)' : undefined,
            ml: onRight ? '-5px' : '5px',
            px: 0.5,
            maxWidth: '55%',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0 8px',
            backgroundColor: 'background.paper',
            pointerEvents: 'none',
          }}>
            {series.slice(0, MOST_LINES).map((line, index) => (
              <Box component="span" key={index} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
                {series.length > 1 && <LineKey color={colours[index]} />}
                {cursorText(line[hover], unit)}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
});

// The time axis all the rows share, kept in sight below them
function TimeAxis({ times, changes, hover }: { times: number[]; changes: StepChange[]; hover: number | null }) {
  const theme = useTheme();
  const xAxis = useMemo(() => [{
    id: 'time', data: times, scaleType: 'utc' as const, position: 'bottom' as const, min: times[0], max: times[times.length - 1],
    valueFormatter: formatTimeTick, height: AXIS_HEIGHT, tickSize: 4,
  }], [times]);
  const noLine = useMemo(() => [{ data: times.map(() => null) }], [times]);
  const fraction = hover === null ? 0 : timeFraction(times, times[hover]);
  const stepColour = theme.palette.mode === 'dark' ? 'warning.light' : 'warning.dark';

  return (
    <Box sx={{
      position: 'sticky',
      bottom: 0,
      zIndex: 1,
      flexShrink: 0,
      display: 'grid',
      gridTemplateColumns: `${NAME_COLUMN}px minmax(0, 1fr)`,
      gap: 1.5,
      px: 1.75,
      pt: 0.25,
      backgroundColor: 'background.paper',
      borderBottom: '1px solid',
      borderColor: 'divider',
      [NARROW]: { gridTemplateColumns: 'minmax(0, 1fr)', gap: 0, px: 1.5 },
    }}>
      <Box sx={{ fontSize: '0.75rem', lineHeight: '16px', color: 'text.secondary', [NARROW]: { height: 16, mb: '-16px', position: 'relative', zIndex: 1, width: 'fit-content' } }}>UTC</Box>
      <Box sx={{ minWidth: 0 }}>
        {/* A lane of its own, since what's in it could land on any label below */}
        <Box sx={{ ...MONO, position: 'relative', height: 16, lineHeight: '16px' }}>
          {changes.map(change => (
            <Box component="span" key={change.at} sx={{ position: 'absolute', left: plotX(timeFraction(times, change.at)), ml: '4px', color: stepColour }}>{change.label}</Box>
          ))}
          {hover !== null && (
            <Box component="span" sx={{
              position: 'absolute',
              left: plotX(fraction),
              transform: fraction < 0.12 ? undefined : fraction > 0.88 ? 'translateX(-100%)' : 'translateX(-50%)',
              px: 0.5,
              borderRadius: 0.5,
              whiteSpace: 'nowrap',
              backgroundColor: 'text.primary',
              color: 'background.paper',
              zIndex: 2,
            }}>
              {utcMoment(times[hover])}
            </Box>
          )}
        </Box>
        <LineChart
          height={AXIS_HEIGHT + 1}
          xAxis={xAxis}
          yAxis={Y_AXIS}
          series={noLine}
          margin={{ left: MARGIN.left, right: MARGIN.right, top: 0, bottom: 0 }}
          hideLegend
          skipAnimation
          disableAxisListener
          slots={{ axisTickLabel: TimeTickLabel }}
          slotProps={NO_TOOLTIP}
        />
      </Box>
    </Box>
  );
}

function ChartedRows({ series }: { series: CoverageSeries }) {
  const theme = useTheme();
  const [hover, setHover] = useState<number | null>(null);
  const onHover = useCallback((index: number | null) => setHover(index), []);
  const colours = useMemo(() => lineColours(series.locations.length, theme), [series.locations.length, theme]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', borderTop: '1px solid', borderColor: 'divider' }}>
      {series.parameters.map(parameter => (
        <ParameterRow
          key={parameter.id}
          parameter={parameter}
          times={series.times}
          colours={colours}
          changes={series.stepChanges}
          hover={hover}
          onHover={onHover}
        />
      ))}
      <TimeAxis times={series.times} changes={series.stepChanges} hover={hover} />
    </Box>
  );
}

function FiguresList({ parameters }: { parameters: ParameterFigures[] }) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', borderTop: '1px solid', borderColor: 'divider' }}>
      {parameters.map(parameter => {
        const range = rangeText(parameter);
        const mean = meanText(parameter);
        return (
          <Box key={parameter.id} sx={{ px: 1.75, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '0 8px' }}>
              <Box sx={{ ...MONO, overflowWrap: 'anywhere' }}>{parameter.id}</Box>
              <Box sx={{ fontSize: '0.75rem', lineHeight: '17px', color: parameter.nulls > 0 ? 'primary.main' : 'text.secondary' }}>{countText(parameter)}</Box>
            </Box>
            {parameter.label && <Box sx={{ fontSize: '0.75rem', lineHeight: '17px', color: 'text.secondary' }}>{parameter.label}</Box>}
            {range && <Box sx={{ ...MONO, mt: 0.25 }}>{mean ? `${range}, ${mean}` : range}</Box>}
          </Box>
        );
      })}
    </Box>
  );
}

function Legend({ locations, colours }: { locations: string[]; colours: string[] }): ReactNode {
  const more = locations.length - MOST_LINES;
  return (
    <Box sx={{ ...MONO, display: 'flex', flexWrap: 'wrap', gap: '2px 12px', px: 1.75, pb: 1 }}>
      {locations.slice(0, MOST_LINES).map((location, index) => (
        <Box component="span" key={index} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <LineKey color={colours[index]} />
          {location}
        </Box>
      ))}
      {more > 0 && <Box component="span" sx={{ color: 'text.secondary' }}>and {more} more in the Table</Box>}
    </Box>
  );
}

interface CoverageDataProps {
  summary: CoverageSummary;
  // What was chosen, kept by the pane across sends. Null until something is
  view: CoverageView | null;
  onViewChange: (view: CoverageView) => void;
}

// A CoverageJSON response as data: what it holds in a sentence, then its cells as a picture, a row per parameter on a
// shared time axis, or the same as a table. What can't be drawn or charted gets its figures alone
export default function CoverageData({ summary, view, onViewChange }: CoverageDataProps) {
  const theme = useTheme();
  const { reading, drawAnyway } = useResponseCells();
  const { series } = summary;
  const canChart = series !== null && series.times.length > 1;
  // One value for each parameter says it all in the figures
  const hasSeriesTable = series !== null && (canChart || series.locations.length > 1);
  const cells = reading?.drawable ? reading : null;
  const hasTable = hasSeriesTable || cells !== null;

  // What was chosen, if this response has it
  const available: CoverageView[] = [...(cells ? ['cells' as const] : []), 'chart', ...(hasTable ? ['table' as const] : [])];
  const preferred = view ?? (cells && opensAsPicture(cells) ? 'cells' : 'chart');
  const shown = available.includes(preferred) ? preferred : 'chart';

  return (
    // The picture and what's below it scroll along with the words above it, which would leave a phone little room if they stayed
    <Box
      data-cells-scroller={shown === 'cells' ? '' : undefined}
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        containerType: 'inline-size',
        backgroundColor: 'background.paper',
        ...(shown === 'cells' ? { overflowY: 'auto', overflowX: 'hidden' } : {}),
      }}
    >
      <Box sx={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, px: 1.75, py: 1 }}>
        <Box sx={{ flex: '1 1 240px', minWidth: 0, fontSize: '0.8125rem', lineHeight: '18px' }}>
          <Box component="span" sx={{ fontFamily: 'monospace' }}>{summary.domainType}</Box>
          {`: ${summary.shape}.${summary.timeText ? ` ${summary.timeText}` : ''}`}
          {summary.axes.map(axis => <Box key={axis} sx={{ ...MONO, color: 'text.secondary' }}>{axis}</Box>)}
          {cells?.order && <Box sx={{ ...MONO, color: 'text.secondary' }}>values[0] is at the {cells.order.firstY} {cells.order.firstX}</Box>}
          {cells && !cells.crs.declared && <Box sx={{ ...MONO, color: 'text.secondary' }}>x and y have no CRS</Box>}
        </Box>
        {available.length > 1 && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={shown}
            onChange={(_event, next: CoverageView | null) => { if (next) onViewChange(next); }}
            aria-label="How to show the data"
            sx={{ '& .MuiToggleButton-root': { height: 28, px: 1.25, py: 0, textTransform: 'none', fontSize: '0.8125rem' } }}
          >
            {cells && <ToggleButton value="cells">{cells.viewLabel}</ToggleButton>}
            <ToggleButton value="chart">{canChart ? 'Chart' : 'Figures'}</ToggleButton>
            <ToggleButton value="table">Table</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>
      {reading && !reading.drawable && reading.why !== 'other-view' && (
        <Box sx={{ mx: 1.75, mb: 1, px: 1.5, py: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, fontSize: '0.8125rem', lineHeight: '18px' }}>
          {reading.why === 'too-large' ? (
            <>
              <Box sx={{ fontWeight: 500 }}>{reading.reason}</Box>
              <Box sx={{ color: 'text.secondary' }}>The figures are below, and Raw has every value.</Box>
              <Button size="small" variant="outlined" onClick={drawAnyway} sx={{ mt: 0.75, textTransform: 'none' }}>Draw it anyway</Button>
            </>
          ) : (
            <>
              <Box sx={{ fontWeight: 500 }}>Can't draw this as a grid</Box>
              <Box sx={{ ...MONO, overflowWrap: 'anywhere' }}>{reading.reason}</Box>
              <Box sx={{ color: 'text.secondary', mt: 0.5 }}>Raw has what was sent.</Box>
            </>
          )}
        </Box>
      )}
      {series && canChart && shown === 'chart' && series.locations.length > 1 && (
        <Legend locations={series.locations} colours={lineColours(series.locations.length, theme)} />
      )}
      {shown === 'cells' ? <CellsView />
        : shown === 'table' ? (hasSeriesTable ? <CoverageTable series={series} /> : <CellsTable onOpenCell={() => onViewChange('cells')} />)
          : canChart ? <ChartedRows series={series} />
            : cells ? <CellsFigures onOpen={() => onViewChange('cells')} />
              : <FiguresList parameters={summary.parameters} />}
    </Box>
  );
}
