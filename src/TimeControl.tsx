import React, { useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Slider from '@mui/material/Slider';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { Temporal } from './types/api';
import type { UseQueryUrlReturn } from './hooks/useQueryUrl';
import { useTimeControl } from './hooks/useTimeControl';
import { normalizeTemporal, getOverallTemporalExtent, formatDateString } from './DataRetrievalAPI';

dayjs.extend(utc);

interface TimeControlProps {
  temporal: Temporal;
  queryState: UseQueryUrlReturn;
}

const TimeControl: React.FC<TimeControlProps> = ({ temporal, queryState }) => {
  const {
    datetimeMode, setDatetimeMode,
    selectedDatetime, setSelectedDatetime,
    startDatetime, setStartDatetime,
    endDatetime, setEndDatetime,
  } = queryState;

  const tc = useTimeControl(temporal, queryState);

  const handleModeChange = useCallback((_: React.MouseEvent<HTMLElement>, newMode: 'individual' | 'range' | null) => {
    if (newMode === null) return;
    setDatetimeMode(newMode);
    if (newMode === 'range') {
      setSelectedDatetime('');
    } else {
      setStartDatetime('');
      setEndDatetime('');
    }
  }, [setDatetimeMode, setSelectedDatetime, setStartDatetime, setEndDatetime]);

  const formatSliderLabel = useCallback((value: number) => {
    return formatDateString(new Date(value).toISOString());
  }, []);

  // Always show mark dots — pointerEvents:'none' prevents drag interference.
  // For discrete mode all values are marks; for continuous, marks are already capped at ~25.
  const showMarkDots = true;

  // Quick presets for range mode
  const renderPresets = useCallback(() => {
    const normalized = normalizeTemporal(temporal);
    let extentStart: dayjs.Dayjs | null = null;
    let extentEnd: dayjs.Dayjs | null = null;

    if (normalized && normalized.intervals.length > 0) {
      const overall = getOverallTemporalExtent(normalized.intervals);
      if (overall) {
        extentStart = overall[0] && overall[0] !== '..' ? dayjs.utc(overall[0]) : null;
        extentEnd = overall[1] && overall[1] !== '..' ? dayjs.utc(overall[1]) : null;
      }
    }

    const isPresetValid = (presetStart: dayjs.Dayjs, presetEnd: dayjs.Dayjs): boolean => {
      if (extentStart && presetStart.isBefore(extentStart)) return false;
      if (extentEnd && presetEnd.isAfter(extentEnd)) return false;
      return true;
    };

    const now = dayjs.utc();
    const presets = [
      { label: 'Last Hour', start: now.subtract(1, 'hour'), end: now },
      { label: 'Today', start: now.startOf('day'), end: now },
      { label: 'Last 7 Days', start: now.subtract(7, 'day'), end: now },
      { label: 'This Month', start: now.startOf('month'), end: now },
      { label: 'Last 30 Days', start: now.subtract(30, 'day'), end: now },
      { label: 'Next 24h', start: now, end: now.add(24, 'hour') },
      { label: 'Next 5 Days', start: now, end: now.add(5, 'day') },
      { label: 'Next 7 Days', start: now, end: now.add(7, 'day') },
      { label: 'Next 30 Days', start: now, end: now.add(30, 'day') },
    ];

    const validPresets = presets.filter(p => isPresetValid(p.start, p.end));
    if (validPresets.length === 0) return null;

    return (
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}>
          Quick Select:
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {validPresets.map((preset) => (
            <Button
              key={preset.label}
              size="small"
              variant="outlined"
              onClick={() => {
                let start = preset.start;
                let end = preset.end;
                if (extentStart && start.isBefore(extentStart)) start = extentStart;
                if (extentEnd && end.isAfter(extentEnd)) end = extentEnd;
                setStartDatetime(start.format('YYYY-MM-DDTHH:mm:ss[Z]'));
                setEndDatetime(end.format('YYYY-MM-DDTHH:mm:ss[Z]'));
              }}
              sx={{ fontSize: '0.7rem', py: 0.25, px: 1, minWidth: 'auto', textTransform: 'none' }}
            >
              {preset.label}
            </Button>
          ))}
        </Box>
      </Box>
    );
  }, [temporal, setStartDatetime, setEndDatetime]);

  // Fallback: DateTimePicker
  if (tc.timeMode === 'fallback') {
    return (
      <Box sx={{ mb: 2 }}>
        <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>Date/Time Selection</FormLabel>

        {temporal.trs && !temporal.trs.includes('Gregorian') && (
          <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
            <Typography variant="caption">
              Non-standard temporal reference system ({temporal.trs}). Using manual date/time picker.
            </Typography>
          </Alert>
        )}

        <ToggleButtonGroup
          size="small"
          exclusive
          value={datetimeMode}
          onChange={handleModeChange}
          sx={{ mb: 1.5 }}
        >
          <ToggleButton value="individual" sx={{ textTransform: 'none', fontSize: '0.8rem', py: 0.5 }}>Single</ToggleButton>
          <ToggleButton value="range" sx={{ textTransform: 'none', fontSize: '0.8rem', py: 0.5 }}>Range</ToggleButton>
        </ToggleButtonGroup>

        {datetimeMode === 'range' && renderPresets()}

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          {datetimeMode === 'individual' ? (
            <DateTimePicker
              label="Date/Time"
              value={selectedDatetime ? dayjs.utc(selectedDatetime) : null}
              onChange={(v: Dayjs | null) => setSelectedDatetime(v ? v.utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : '')}
              format="DD/MM/YYYY HH:mm"
              ampm={false}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <DateTimePicker
                label="Start Date/Time"
                value={startDatetime ? dayjs.utc(startDatetime) : null}
                onChange={(v: Dayjs | null) => setStartDatetime(v ? v.utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : '')}
                format="DD/MM/YYYY HH:mm"
                ampm={false}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
              <DateTimePicker
                label="End Date/Time"
                value={endDatetime ? dayjs.utc(endDatetime) : null}
                onChange={(v: Dayjs | null) => setEndDatetime(v ? v.utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : '')}
                format="DD/MM/YYYY HH:mm"
                ampm={false}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Box>
          )}
        </LocalizationProvider>
      </Box>
    );
  }

  // Slider-based time control
  return (
    <Box sx={{ mb: 2 }}>
      <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>Date/Time Selection</FormLabel>

      {/* Mode toggle */}
      <ToggleButtonGroup
        size="small"
        exclusive
        value={datetimeMode}
        onChange={handleModeChange}
        sx={{ mb: 1.5 }}
      >
        <ToggleButton value="individual" sx={{ textTransform: 'none', fontSize: '0.8rem', py: 0.5 }}>Single</ToggleButton>
        <ToggleButton value="range" sx={{ textTransform: 'none', fontSize: '0.8rem', py: 0.5 }}>Range</ToggleButton>
      </ToggleButtonGroup>

      {/* Quick presets (range mode only) */}
      {datetimeMode === 'range' && renderPresets()}

      {/* Current time display */}
      <Typography
        variant="body2"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          fontWeight: 500,
          color: 'primary.main',
          px: 1,
          py: 0.5,
          mb: 0.5,
          bgcolor: (theme) => theme.palette.mode === 'dark'
            ? 'rgba(25,118,210,0.15)'
            : 'rgba(25,118,210,0.08)',
          borderRadius: 1,
          border: 1,
          borderColor: (theme) => theme.palette.mode === 'dark'
            ? 'rgba(25,118,210,0.3)'
            : 'rgba(25,118,210,0.2)',
          textAlign: 'center',
        }}
        aria-live="polite"
      >
        {tc.currentTimeLabel}
      </Typography>

      {/* Transport row: |< < [-1h+] > >| [zoom] */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25, mb: 0.5 }}>
        <Tooltip title="Jump to start" placement="top">
          <IconButton size="small" onClick={tc.jumpToStart}>
            <SkipPreviousIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={`Step back (${tc.stepLabel})`} placement="top">
          <IconButton size="small" onClick={tc.stepBackward}>
            <NavigateBeforeIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        {/* Compact step selector: [-] 1h [+] */}
        {tc.timeMode === 'continuous' && tc.stepOptions.length > 1 && (
          <Box sx={{
            display: 'inline-flex',
            alignItems: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            mx: 0.25,
          }}>
            <Tooltip title="Smaller timestep" placement="top">
              <span>
                <IconButton
                  size="small"
                  onClick={tc.stepDown}
                  disabled={tc.selectedStepIndex <= 0}
                  sx={{ p: 0.25 }}
                >
                  <RemoveIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={tc.stepLabel} placement="top">
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  px: 0.5,
                  minWidth: 28,
                  textAlign: 'center',
                  userSelect: 'none',
                }}
              >
                {tc.stepShortLabel}
              </Typography>
            </Tooltip>
            <Tooltip title="Larger timestep" placement="top">
              <span>
                <IconButton
                  size="small"
                  onClick={tc.stepUp}
                  disabled={tc.selectedStepIndex >= tc.stepOptions.length - 1}
                  sx={{ p: 0.25 }}
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}

        <Tooltip title={`Step forward (${tc.stepLabel})`} placement="top">
          <IconButton size="small" onClick={tc.stepForward}>
            <NavigateNextIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Jump to end (latest)" placement="top">
          <IconButton size="small" onClick={tc.jumpToEnd}>
            <SkipNextIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        {/* Zoom controls */}
        {datetimeMode === 'range' && startDatetime && endDatetime && !tc.isZoomed && (
          <Tooltip title="Zoom to selection" placement="top">
            <IconButton size="small" onClick={tc.zoomToSelection} sx={{ ml: 0.5 }}>
              <ZoomInIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        {tc.isZoomed && (
          <Tooltip title="Reset zoom (full extent)" placement="top">
            <IconButton size="small" onClick={tc.resetZoom} sx={{ ml: 0.5 }}>
              <ZoomOutMapIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Slider */}
      <Box sx={{ px: 0.5 }}>
        <Slider
          size="small"
          value={tc.sliderValue}
          min={tc.viewMin}
          max={tc.viewMax}
          step={tc.timeMode === 'discrete' ? null : tc.stepMs}
          marks={tc.marks}
          valueLabelDisplay="auto"
          valueLabelFormat={formatSliderLabel}
          onChange={(_, value) => tc.onSliderChange(value as number | number[])}
          onChangeCommitted={(_, value) => tc.onSliderChangeCommitted(value as number | number[])}
          aria-label="Temporal extent slider"
          sx={{
            '& .MuiSlider-thumb': { width: 14, height: 14, zIndex: 2 },
            '& .MuiSlider-rail': { opacity: 0.3 },
            // Show/hide marks: always present for snapping, but only visible when showMarkDots
            '& .MuiSlider-mark': showMarkDots
              ? { width: 2, height: 8, opacity: 0.5, pointerEvents: 'none' }
              : { display: 'none' },
          }}
        />
      </Box>

      {/* Extent labels */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.65rem' }}>
          {tc.startLabel}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.65rem' }}>
          {tc.endLabel}
        </Typography>
      </Box>
    </Box>
  );
};

export default TimeControl;
