import { useMemo, useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import { useResponseCells } from '../contexts/responseCells';
import { useElementWidth } from '../hooks/useElementWidth';
import { shareText, type SetApart } from './cellFigures';
import { tallies } from './cellSelection';
import { OUTSIDE_CSS, lutCss, lutFor, rampGradient, type Highlight } from './colourScale';
import { formatValue } from './coverageSummary';
import { ticks } from './paintCells';
import { isTouch } from './touch';
import { useCellsPalette } from './useCellsPalette';

const BAR_AREA = 44;
const LABEL_ROW = 14;
const TICK_CHARACTER = 6.7;
const MONO = { fontFamily: 'monospace', fontSize: '0.6875rem', lineHeight: '14px' };

const barHeight = (count: number, most: number) => (count === 0 ? 0 : Math.max(1.5, (Math.log1p(count) / Math.log1p(most)) * BAR_AREA));
const shortRange = (list: SetApart[]) => (list[0].min === list[0].max ? formatValue(list[0].min) : `${formatValue(list[0].min)}…`);
const fourDigits = (value: number) => String(Number(value.toPrecision(4)));

const plural = (count: number) => `${count.toLocaleString('en-US')} value${count === 1 ? '' : 's'}`;

// The legend is the histogram: one component, since a spike or a gap in the distribution is how a fill value gives
// itself away. On a log count, so that a single cell still shows. Pointing at a bar lights only its cells
export default function ValueLegend() {
  const { picture, choices, choose, lit } = useResponseCells();
  const palette = useCellsPalette();
  const [setMain, mainWidth] = useElementWidth();
  const [said, setSaid] = useState<string | null>(null);
  const { ramp, range, litPinned } = choices;

  const counted = useMemo(() => (picture ? tallies(picture.codes) : null), [picture]);
  const lut = useMemo(() => lutFor(ramp, palette.mode, null), [ramp, palette.mode]);
  if (!picture || !counted) return null;
  const { figures, parameter, codes, lo, hi } = picture;
  const { bins, nulls, below, above } = counted;
  const most = Math.max(1, ...bins, nulls, below, above);
  const unit = parameter.unit ? ` ${parameter.unit}` : '';
  const total = codes.length;

  const noNumbers = figures.numbers === 0;
  const flat = figures.oneValue && range !== 'set';
  const lows = figures.apart.filter(apart => apart.low);
  const highs = figures.apart.filter(apart => !apart.low);
  const named = range === 'auto' && ramp !== 'diverging';
  const belowLabel = named && lows.length ? shortRange(lows) : `< ${formatValue(lo ?? 0)}`;
  const aboveLabel = named && highs.length ? shortRange(highs) : `> ${formatValue(hi ?? 0)}`;

  const describe = (highlight: Highlight) => {
    if (highlight.kind === 'bin') {
      const from = (lo ?? 0) + (((hi ?? 0) - (lo ?? 0)) * highlight.from) / 255;
      const to = (lo ?? 0) + (((hi ?? 0) - (lo ?? 0)) * (highlight.to + 1)) / 255;
      const count = bins[highlight.bin];
      return `${formatValue(from)} to ${formatValue(to)}${unit}: ${plural(count)} (${shareText(count / total)})`;
    }
    const count = highlight.kind === 'null' ? nulls : highlight.kind === 'below' ? below : above;
    const word = highlight.kind === 'null' ? 'null' : highlight.kind === 'below' ? 'below the scale' : 'above the scale';
    return `${word}: ${plural(count)} (${shareText(count / total)})`;
  };

  const binAt = (event: MouseEvent<HTMLElement>): Highlight => {
    const at = event.currentTarget.getBoundingClientRect();
    const bin = Math.max(0, Math.min(63, Math.floor(((event.clientX - at.left) / at.width) * 64)));
    return { kind: 'bin', from: bin * 4, to: bin * 4 + 3, bin };
  };
  const sameLit = (a: Highlight | null, b: Highlight) => a?.kind === b.kind && (a.kind !== 'bin' || (b.kind === 'bin' && a.bin === b.bin));
  const lightUp = (highlight: Highlight) => {
    choose({ litPinned: sameLit(litPinned, highlight) ? null : highlight, litHover: null });
    setSaid(null);
  };

  // A log scale flattens what most cells share, so that bar says how much it holds
  const { spike } = figures;
  const spikeBin = spike && !flat && lo !== null && hi !== null && spike.value >= lo && spike.value <= hi && hi > lo && figures.numbers >= 50
    ? Math.round(((spike.value - lo) / (hi - lo)) * 255) >> 2
    : null;

  const column = (kind: 'null' | 'below' | 'above', label: string, count: number) => {
    const highlight: Highlight = { kind };
    return (
      <Box
        key={kind}
        onPointerEnter={() => {
          choose({ litHover: highlight });
          setSaid(describe(highlight));
        }}
        onPointerLeave={() => {
          choose({ litHover: null });
          setSaid(null);
        }}
        onClick={() => lightUp(highlight)}
        sx={{ flex: '0 0 auto', width: 58, cursor: 'pointer', outline: sameLit(litPinned, highlight) ? '1px solid' : 'none', outlineColor: 'text.primary' }}
      >
        <Box sx={{ ...MONO, textAlign: 'center', color: 'text.primary' }}>{shareText(count / total)}</Box>
        <Box sx={{ height: BAR_AREA, display: 'flex', alignItems: 'flex-end' }}>
          <Box sx={{
            width: '100%',
            height: barHeight(count, most),
            ...(kind === 'null' ? {
              backgroundImage: `repeating-linear-gradient(-45deg, ${palette.mode === 'dark' ? '#5a5a5a' : '#a8a8a8'} 0 1.5px, ${palette.mode === 'dark' ? '#222' : '#ececec'} 1.5px 5px)`,
            } : { backgroundColor: OUTSIDE_CSS }),
          }} />
        </Box>
        <Box sx={{
          height: 8,
          ...(kind === 'null' ? {
            backgroundImage: `repeating-linear-gradient(-45deg, ${palette.mode === 'dark' ? '#5a5a5a' : '#a8a8a8'} 0 1.5px, ${palette.mode === 'dark' ? '#222' : '#ececec'} 1.5px 5px)`,
          } : { backgroundColor: OUTSIDE_CSS }),
        }} />
        <Box title={label} sx={{ ...MONO, mt: 0.25, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
        <Box sx={{ ...MONO, textAlign: 'center', color: 'text.secondary' }}>{count.toLocaleString('en-US')}</Box>
      </Box>
    );
  };

  // Ticks that fit between the two ends, which are always labelled
  const innerTicks = lo !== null && hi !== null && hi > lo && mainWidth > 0
    ? ticks(lo, hi, Math.max(1, Math.floor(mainWidth / 90))).list.filter(value => {
      const at = ((value - lo) / (hi - lo)) * mainWidth;
      const half = (fourDigits(value).length * TICK_CHARACTER) / 2;
      return at - half > fourDigits(lo).length * TICK_CHARACTER + 12 && at + half < mainWidth - ((fourDigits(hi).length + unit.length) * TICK_CHARACTER + 12);
    })
    : [];

  const hint = isTouch() ? 'Heights are on a log scale. Tap a bar to find its cells' : 'Heights are on a log scale. Point at a bar to find its cells';
  const say = said ?? (litPinned ? 'Only those cells are lit. Click again to light them all' : noNumbers || flat ? '' : hint);

  return (
    <Box sx={{ mx: 1.75, mt: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        {(nulls > 0 || noNumbers) && column('null', 'null', nulls)}
        {below > 0 && column('below', belowLabel, below)}
        {!noNumbers && flat && (
          <Box sx={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 0.75, fontFamily: 'monospace', fontSize: '0.8125rem' }}>
            <Box component="span" aria-hidden sx={{ width: 12, height: 12, backgroundColor: lutCss(lut, codes.find(code => code < 256) ?? 0) }} />
            One value: {formatValue(figures.min ?? 0)}{unit}
          </Box>
        )}
        {!noNumbers && !flat && (
          <Box
            ref={setMain}
            onPointerMove={event => {
              const highlight = binAt(event);
              if (!sameLit(choices.litHover, highlight)) choose({ litHover: highlight });
              setSaid(describe(highlight));
            }}
            onPointerLeave={() => {
              choose({ litHover: null });
              setSaid(null);
            }}
            onClick={event => lightUp(binAt(event))}
            sx={{ flex: 1, minWidth: 0, cursor: 'pointer', touchAction: 'pan-y' }}
          >
            <Box sx={{ position: 'relative', height: LABEL_ROW + BAR_AREA, display: 'flex', alignItems: 'flex-end' }}>
              {Array.from(bins, (count, bin) => {
                const isLit = !lit || (lit.kind === 'bin' && lit.bin === bin);
                return (
                  <Box
                    key={bin}
                    sx={{ flex: 1, minWidth: 0, mx: mainWidth > 256 ? '0.5px' : 0, height: barHeight(count, most), backgroundColor: lutCss(lut, bin * 4 + 2), opacity: isLit ? 1 : 0.25 }}
                  />
                );
              })}
              {spikeBin !== null && bins[spikeBin] > 0 && (
                <Box sx={{
                  ...MONO,
                  position: 'absolute',
                  top: 0,
                  ...(spikeBin < 13 ? { left: `${(spikeBin / 64) * 100}%` }
                    : spikeBin > 51 ? { right: `${((63 - spikeBin) / 64) * 100}%` }
                      : { left: `${((spikeBin + 0.5) / 64) * 100}%`, transform: 'translateX(-50%)' }),
                }}>
                  {shareText(bins[spikeBin] / total)}
                </Box>
              )}
            </Box>
            <Box sx={{ height: 8, backgroundImage: rampGradient(ramp, palette.mode) }} />
            <Box sx={{ ...MONO, position: 'relative', height: 14, mt: 0.25, whiteSpace: 'nowrap' }}>
              <Box component="span" sx={{ position: 'absolute', left: 0 }}>{fourDigits(lo ?? 0)}</Box>
              {innerTicks.map(value => (
                <Box component="span" key={value} sx={{ position: 'absolute', left: `${((value - (lo ?? 0)) / ((hi ?? 1) - (lo ?? 0))) * 100}%`, transform: 'translateX(-50%)' }}>{fourDigits(value)}</Box>
              ))}
              <Box component="span" sx={{ position: 'absolute', right: 0 }}>{fourDigits(hi ?? 0)}{unit}</Box>
            </Box>
          </Box>
        )}
        {above > 0 && column('above', aboveLabel, above)}
      </Box>
      {/* Stacked on the longest it says, so that what's below doesn't move */}
      <Box sx={{ display: 'grid', mt: 0.5, minHeight: 18, fontSize: '0.75rem', lineHeight: '18px', color: 'text.secondary' }}>
        <Box aria-hidden sx={{ gridArea: '1 / 1', visibility: 'hidden' }}>{hint}</Box>
        <Box sx={{ gridArea: '1 / 1', minWidth: 0 }}>{say}</Box>
      </Box>
    </Box>
  );
}
