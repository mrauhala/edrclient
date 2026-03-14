import React from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Select from '@mui/material/Select';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Collection, expandTemporalValues, expandVerticalValues, expandCustomDimensionValues, getOverallTemporalExtent, normalizeTemporal } from './DataRetrievalAPI';
import { UseQueryUrlReturn } from './hooks/useQueryUrl';
import { useMapInteraction } from './contexts/MapInteractionContext';

// Configure dayjs to use UTC plugin
dayjs.extend(utc);

interface CollectionQueryBuilderProps {
  collection: Collection;
  queryState: UseQueryUrlReturn;
}

const CollectionQueryBuilder: React.FC<CollectionQueryBuilderProps> = ({ collection, queryState }) => {
  const {
    selectedDataQuery, setSelectedDataQuery,
    selectedFormat, setSelectedFormat,
    selectedParameters, setSelectedParameters,
    selectedDatetime, setSelectedDatetime,
    datetimeMode, setDatetimeMode,
    startDatetime, setStartDatetime,
    endDatetime, setEndDatetime,
    selectedVertical, setSelectedVertical,
    verticalMode, setVerticalMode,
    startVertical, setStartVertical,
    endVertical, setEndVertical,
    selectedCustomDimensions, setSelectedCustomDimensions,
    customDimensionModes, setCustomDimensionModes,
    customDimensionStarts, setCustomDimensionStarts,
    customDimensionEnds, setCustomDimensionEnds,
    getEffectiveOutputFormats,
  } = queryState;

  const { setClickedCoords, setDataQuery } = useMapInteraction();
  return (
    <>
      {/* Data Query Selector */}
      { typeof collection.data_queries !== "undefined" && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="data-query-select-label">Data Query</InputLabel>
          <Select
            labelId="data-query-select-label"
            value={selectedDataQuery}
            label="Data Query"
            onChange={(e) => {
              const queryType = e.target.value;
              setSelectedDataQuery(queryType);

              // Auto-select format for this data query
              const effectiveFormats = getEffectiveOutputFormats(collection, queryType);
              let formatToUse = selectedFormat;
              if (selectedFormat && !effectiveFormats.includes(selectedFormat)) {
                formatToUse = '';
              }
              if (!formatToUse && queryType && collection.data_queries[queryType]?.link?.variables?.default_output_format) {
                const defaultFormat = collection.data_queries[queryType].link.variables.default_output_format;
                if (effectiveFormats.includes(defaultFormat)) {
                  formatToUse = defaultFormat;
                }
              }
              if (formatToUse !== selectedFormat) {
                setSelectedFormat(formatToUse);
              }

              setDataQuery(queryType);
              if (queryType.toLowerCase() !== 'position') {
                setClickedCoords([]);
              }
              // URL rebuild is handled by useQueryUrl consolidated effect
            }}
            size="small"
          >
            <MenuItem value="">
              <em>Select a data query</em>
            </MenuItem>
            {Object.keys(collection.data_queries).map((queryKey) => (
              <MenuItem key={queryKey} value={queryKey}>
                {queryKey}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Format Selector */}
      {(() => {
        const effectiveFormats = getEffectiveOutputFormats(collection, selectedDataQuery);
        return effectiveFormats.length > 0 && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="format-select-label">Output Format</InputLabel>
            <Select
              labelId="format-select-label"
              value={selectedFormat}
              label="Output Format"
              onChange={(e) => {
                setSelectedFormat(e.target.value);
              }}
              size="small"
            >
              <MenuItem value="">
                <em>Select a format</em>
              </MenuItem>
              {effectiveFormats.map((format) => (
                <MenuItem key={format} value={format}>
                  {format}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      })()}

      {/* Parameter Selector - Multiselect */}
      { typeof collection.parameter_names !== "undefined" && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="parameter-select-label">Parameters</InputLabel>
          <Select
            labelId="parameter-select-label"
            multiple
            value={selectedParameters}
            label="Parameters"
            onChange={(e) => {
              const parameters = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
              setSelectedParameters(parameters);
            }}
            size="small"
            renderValue={(selected) => selected.join(', ')}
          >
            {Array.isArray(collection.parameter_names)
              ? collection.parameter_names.map((param) => (
                  <MenuItem key={param.id} value={param.id}>
                    <Checkbox checked={selectedParameters.indexOf(param.id) > -1} />
                    <ListItemText primary={param.label || param.id} />
                  </MenuItem>
                ))
              : Object.keys(collection.parameter_names || {}).map((paramKey) => {
                  const params = collection.parameter_names as { [key: string]: any };
                  return (
                    <MenuItem key={paramKey} value={paramKey}>
                      <Checkbox checked={selectedParameters.indexOf(paramKey) > -1} />
                      <ListItemText primary={params[paramKey]?.description || paramKey} />
                    </MenuItem>
                  );
                })
            }
          </Select>
        </FormControl>
      )}

      {/* Datetime Selector */}
      {collection.extent?.temporal && (() => {
        const temporalValues = expandTemporalValues(collection.extent.temporal, 500);
        const hasValues = collection.extent.temporal.values && collection.extent.temporal.values.length > 0;
        const hasInterval = collection.extent.temporal.interval && collection.extent.temporal.interval.length > 0;

        // Check if we have too many values (from large repeating intervals)
        // If so, use DateTimePicker instead of dropdown
        const tooManyValues = temporalValues.length > 250;
        const useDropdown = hasValues && !tooManyValues;

        // Show temporal selection UI if collection has temporal extent (values OR interval)
        return (hasValues || hasInterval) ? (
          <Box sx={{ mb: 2 }}>
            <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>Date/Time Selection</FormLabel>

            {/* Info message when using date picker due to large intervals */}
            {tooManyValues && (
              <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
                <Typography variant="caption">
                  This collection has a large repeating interval ({temporalValues.length} values, limit: 250). Using date/time picker for easier selection.
                </Typography>
              </Alert>
            )}

            {/* Datetime Mode Selector - always show when temporal extent exists */}
            <FormControl component="fieldset" sx={{ mb: 1 }}>
              <RadioGroup
                row
                value={datetimeMode}
                onChange={(e) => {
                  const newMode = e.target.value as 'individual' | 'range';
                  setDatetimeMode(newMode);
                  // Clear selections when switching modes
                  if (newMode === 'range') {
                    setSelectedDatetime('');
                  } else {
                    setStartDatetime('');
                    setEndDatetime('');
                  }
                }}
                sx={{ gap: 2 }}
              >
                <FormControlLabel
                  value="individual"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">Individual Time</Typography>}
                />
                <FormControlLabel
                  value="range"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">Time Range</Typography>}
                />
              </RadioGroup>
            </FormControl>

            {/* Quick Select Presets for Time Ranges */}
            {datetimeMode === 'range' && (() => {
              // Get temporal extent bounds using the utility function
              const normalizedTemporal = normalizeTemporal(collection.extent.temporal);
              let extentStart: dayjs.Dayjs | null = null;
              let extentEnd: dayjs.Dayjs | null = null;

              if (normalizedTemporal && normalizedTemporal.intervals.length > 0) {
                const overallExtent = getOverallTemporalExtent(normalizedTemporal.intervals);
                if (overallExtent) {
                  extentStart = overallExtent[0] && overallExtent[0] !== '..' ? dayjs.utc(overallExtent[0]) : null;
                  extentEnd = overallExtent[1] && overallExtent[1] !== '..' ? dayjs.utc(overallExtent[1]) : null;
                }
              }

              // Helper to check if a preset range is valid
              const isPresetValid = (presetStart: dayjs.Dayjs, presetEnd: dayjs.Dayjs): boolean => {
                // Open-ended extents are fine - validate only if bounds exist
                // For start: if extent has a start, preset start must be >= extent start
                if (extentStart && presetStart.isBefore(extentStart)) {
                  return false;
                }

                // For end: if extent has an end, preset end must be <= extent end
                if (extentEnd && presetEnd.isAfter(extentEnd)) {
                  return false;
                }

                return true;
              };

              const now = dayjs.utc();

              // Define all possible presets
              const presets = [
                // Backward-looking presets
                {
                  label: 'Last Hour',
                  start: now.subtract(1, 'hour'),
                  end: now
                },
                {
                  label: 'Today',
                  start: now.startOf('day'),
                  end: now
                },
                {
                  label: 'Last 7 Days',
                  start: now.subtract(7, 'day'),
                  end: now
                },
                {
                  label: 'This Month',
                  start: now.startOf('month'),
                  end: now
                },
                {
                  label: 'Last 30 Days',
                  start: now.subtract(30, 'day'),
                  end: now
                },
                // Forward-looking presets
                {
                  label: 'Next 24 Hours',
                  start: now,
                  end: now.add(24, 'hour')
                },
                {
                  label: 'Next 5 Days',
                  start: now,
                  end: now.add(5, 'day')
                },
                {
                  label: 'Next 7 Days',
                  start: now,
                  end: now.add(7, 'day')
                },
                {
                  label: 'Next 30 Days',
                  start: now,
                  end: now.add(30, 'day')
                },
              ];

              // Filter presets to only show valid ones
              const validPresets = presets.filter(preset => isPresetValid(preset.start, preset.end));

              return validPresets.length > 0 ? (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}>
                    Quick Select:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {validPresets.map((preset, idx) => (
                      <Button
                        key={idx}
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          // Clamp dates to extent bounds if necessary
                          let start = preset.start;
                          let end = preset.end;

                          if (extentStart && start.isBefore(extentStart)) {
                            start = extentStart;
                          }
                          if (extentEnd && end.isAfter(extentEnd)) {
                            end = extentEnd;
                          }

                          setStartDatetime(start.format('YYYY-MM-DDTHH:mm:ss[Z]'));
                          setEndDatetime(end.format('YYYY-MM-DDTHH:mm:ss[Z]'));
                        }}
                        sx={{
                          fontSize: '0.7rem',
                          py: 0.25,
                          px: 1,
                          minWidth: 'auto',
                          textTransform: 'none'
                        }}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </Box>
                </Box>
              ) : null;
            })()}

            {/* Individual Time - show dropdown if values exist, otherwise show DateTimePicker */}
            {datetimeMode === 'individual' && (
              useDropdown ? (
                <FormControl fullWidth>
                  <InputLabel id="datetime-select-label">Select Time</InputLabel>
                  <Select
                    labelId="datetime-select-label"
                    value={selectedDatetime}
                    label="Select Time"
                    onChange={(e) => {
                      const datetime = e.target.value as string;
                      setSelectedDatetime(datetime);
                    }}
                    size="small"
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {temporalValues.map((datetime) => (
                      <MenuItem key={datetime} value={datetime}>
                        <ListItemText
                          primary={datetime}
                          primaryTypographyProps={{
                            style: { fontSize: '0.85rem', fontFamily: 'monospace' }
                          }}
                        />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DateTimePicker
                    label="Date/Time"
                    value={selectedDatetime ? dayjs.utc(selectedDatetime) : null}
                    onChange={(newValue: Dayjs | null) => {
                      // Convert to ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
                      const isoDatetime = newValue ? newValue.utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : '';
                      setSelectedDatetime(isoDatetime);
                      // URL will be updated by useEffect
                    }}
                    format="DD/MM/YYYY HH:mm"
                    ampm={false}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                      },
                    }}
                  />
                </LocalizationProvider>
              )
            )}

            {/* Time Range Selectors - show when in range mode */}
            {datetimeMode === 'range' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Show dropdowns with list if we have actual values and not too many */}
                {useDropdown ? (
                  <>
                    <FormControl fullWidth size="small">
                      <InputLabel id="start-datetime-label">Start Time</InputLabel>
                      <Select
                        labelId="start-datetime-label"
                        value={startDatetime}
                        label="Start Time"
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setStartDatetime(newStart);
                        }}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 300,
                            },
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em>Select start time</em>
                        </MenuItem>
                        {temporalValues.map((datetime) => (
                          <MenuItem key={datetime} value={datetime}>
                            <ListItemText
                              primary={datetime}
                              primaryTypographyProps={{
                                style: { fontSize: '0.85rem', fontFamily: 'monospace' }
                              }}
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel id="end-datetime-label">End Time</InputLabel>
                      <Select
                        labelId="end-datetime-label"
                        value={endDatetime}
                        label="End Time"
                        onChange={(e) => {
                          const newEnd = e.target.value;
                          setEndDatetime(newEnd);
                        }}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 300,
                            },
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em>Select end time</em>
                        </MenuItem>
                        {temporalValues.map((datetime) => (
                          <MenuItem key={datetime} value={datetime}>
                            <ListItemText
                              primary={datetime}
                              primaryTypographyProps={{
                                style: { fontSize: '0.85rem', fontFamily: 'monospace' }
                              }}
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </>
                ) : (
                  /* Show date/time pickers if no values exist */
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DateTimePicker
                      label="Start Date/Time"
                      value={startDatetime ? dayjs.utc(startDatetime) : null}
                      onChange={(newValue: Dayjs | null) => {
                        // Convert to ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
                        const isoStart = newValue ? newValue.utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : '';
                        setStartDatetime(isoStart);
                        // URL will be updated by useEffect
                      }}
                      format="DD/MM/YYYY HH:mm"
                      ampm={false}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                        },
                      }}
                    />

                    <DateTimePicker
                      label="End Date/Time"
                      value={endDatetime ? dayjs.utc(endDatetime) : null}
                      onChange={(newValue: Dayjs | null) => {
                        // Convert to ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
                        const isoEnd = newValue ? newValue.utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : '';
                        setEndDatetime(isoEnd);
                        // URL will be updated by useEffect
                      }}
                      format="DD/MM/YYYY HH:mm"
                      ampm={false}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                        },
                      }}
                    />
                  </LocalizationProvider>
                )}
              </Box>
            )}
          </Box>
        ) : null;
      })()}

      {/* Vertical Extent Selector */}
      {collection.extent?.vertical && (() => {
        const verticalValues = expandVerticalValues(collection.extent.vertical, 500);
        const hasValues = collection.extent.vertical.values && collection.extent.vertical.values.length > 0;
        const hasInterval = collection.extent.vertical.interval && collection.extent.vertical.interval.length > 0;

        // Check if we have too many values (from large intervals)
        // If so, use TextField instead of dropdown
        const tooManyValues = verticalValues.length > 250;
        const useDropdown = hasValues && !tooManyValues;

        // Show vertical selection UI if collection has vertical extent (values OR interval)
        return (hasValues || hasInterval) ? (
          <Box sx={{ mb: 2 }}>
            <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>Vertical Level Selection</FormLabel>

            {/* Info message when using text input due to large intervals */}
            {tooManyValues && (
              <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
                <Typography variant="caption">
                  This collection has a large vertical range ({verticalValues.length} values, limit: 250). Using text input for easier selection.
                </Typography>
              </Alert>
            )}

            {/* Vertical Mode Selector - always show when vertical extent exists */}
            <FormControl component="fieldset" sx={{ mb: 1 }}>
              <RadioGroup
                row
                value={verticalMode}
                onChange={(e) => {
                  const newMode = e.target.value as 'individual' | 'range';
                  setVerticalMode(newMode);
                  // Clear selections when switching modes
                  if (newMode === 'range') {
                    setSelectedVertical('');
                  } else {
                    setStartVertical('');
                    setEndVertical('');
                  }
                }}
                sx={{ gap: 2 }}
              >
                <FormControlLabel
                  value="individual"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">Individual Level</Typography>}
                />
                <FormControlLabel
                  value="range"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">Level Range</Typography>}
                />
              </RadioGroup>
            </FormControl>

            {/* Individual Level - show dropdown if values exist, otherwise show TextField */}
            {verticalMode === 'individual' && (
              useDropdown ? (
                <FormControl fullWidth>
                  <InputLabel id="vertical-select-label">Select Level</InputLabel>
                  <Select
                    labelId="vertical-select-label"
                    value={selectedVertical}
                    label="Select Level"
                    onChange={(e) => {
                      const vertical = e.target.value as string;
                      setSelectedVertical(vertical);
                    }}
                    size="small"
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {verticalValues.map((level) => (
                      <MenuItem key={level} value={level}>
                        <ListItemText
                          primary={level}
                          primaryTypographyProps={{
                            style: { fontSize: '0.85rem', fontFamily: 'monospace' }
                          }}
                        />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  label="Vertical Level"
                  value={selectedVertical}
                  onChange={(e) => {
                    const vertical = e.target.value;
                    setSelectedVertical(vertical);
                  }}
                  fullWidth
                  size="small"
                  placeholder="Enter vertical level (e.g., 1000)"
                  helperText="Enter a numeric value"
                />
              )
            )}

            {/* Level Range Selectors - show when in range mode */}
            {verticalMode === 'range' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Show dropdowns with list if we have actual values and not too many */}
                {useDropdown ? (
                  <>
                    <FormControl fullWidth size="small">
                      <InputLabel id="start-vertical-label">Start Level</InputLabel>
                      <Select
                        labelId="start-vertical-label"
                        value={startVertical}
                        label="Start Level"
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setStartVertical(newStart);
                        }}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 300,
                            },
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em>Select start level</em>
                        </MenuItem>
                        {verticalValues.map((level) => (
                          <MenuItem key={level} value={level}>
                            <ListItemText
                              primary={level}
                              primaryTypographyProps={{
                                style: { fontSize: '0.85rem', fontFamily: 'monospace' }
                              }}
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel id="end-vertical-label">End Level</InputLabel>
                      <Select
                        labelId="end-vertical-label"
                        value={endVertical}
                        label="End Level"
                        onChange={(e) => {
                          const newEnd = e.target.value;
                          setEndVertical(newEnd);
                        }}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 300,
                            },
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em>Select end level</em>
                        </MenuItem>
                        {verticalValues.map((level) => (
                          <MenuItem key={level} value={level}>
                            <ListItemText
                              primary={level}
                              primaryTypographyProps={{
                                style: { fontSize: '0.85rem', fontFamily: 'monospace' }
                              }}
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </>
                ) : (
                  /* Show text inputs if no values exist or too many */
                  <>
                    <TextField
                      label="Start Level"
                      value={startVertical}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setStartVertical(newStart);
                      }}
                      fullWidth
                      size="small"
                      placeholder="Enter start level"
                      helperText="Enter a numeric value"
                    />
                    <TextField
                      label="End Level"
                      value={endVertical}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        setEndVertical(newEnd);
                      }}
                      fullWidth
                      size="small"
                      placeholder="Enter end level"
                      helperText="Enter a numeric value"
                    />
                  </>
                )}
              </Box>
            )}
          </Box>
        ) : null;
      })()}

      {/* Custom Dimension Selectors */}
      {collection.extent?.custom && collection.extent.custom.length > 0 && collection.extent.custom.map((dimension) => {
        const dimensionId = dimension.id;
        const dimensionValues = expandCustomDimensionValues(dimension, 500);
        const hasValues = dimension.values && dimension.values.length > 0;
        const hasInterval = dimension.interval && dimension.interval.length > 0;

        // Check if we have too many values (from large intervals)
        const tooManyValues = dimensionValues.length > 250;
        const useDropdown = hasValues && !tooManyValues;

        // Show dimension selection UI if dimension has values OR interval
        return (hasValues || hasInterval) ? (
          <Box key={dimensionId} sx={{ mb: 2 }}>
            <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>
              {dimension.id} Selection {dimension.reference ? `(${dimension.reference})` : ''}
            </FormLabel>

            {/* Info message when using text input due to large intervals */}
            {tooManyValues && (
              <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
                <Typography variant="caption">
                  This dimension has a large range ({dimensionValues.length} values, limit: 250). Using text input for easier selection.
                </Typography>
              </Alert>
            )}

            {/* Dimension Mode Selector */}
            <FormControl component="fieldset" sx={{ mb: 1 }}>
              <RadioGroup
                row
                value={customDimensionModes[dimensionId] || 'individual'}
                onChange={(e) => {
                  const newMode = e.target.value as 'individual' | 'range';
                  setCustomDimensionModes(prev => ({ ...prev, [dimensionId]: newMode }));
                  // Clear selections when switching modes
                  if (newMode === 'range') {
                    setSelectedCustomDimensions(prev => {
                      const updated = { ...prev };
                      delete updated[dimensionId];
                      return updated;
                    });
                  } else {
                    setCustomDimensionStarts(prev => {
                      const updated = { ...prev };
                      delete updated[dimensionId];
                      return updated;
                    });
                    setCustomDimensionEnds(prev => {
                      const updated = { ...prev };
                      delete updated[dimensionId];
                      return updated;
                    });
                  }
                }}
                sx={{ gap: 2 }}
              >
                <FormControlLabel
                  value="individual"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">Individual Value</Typography>}
                />
                <FormControlLabel
                  value="range"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">Range</Typography>}
                />
              </RadioGroup>
            </FormControl>

            {/* Individual Value Selector */}
            {(customDimensionModes[dimensionId] || 'individual') === 'individual' && (
              useDropdown ? (
                <FormControl fullWidth>
                  <InputLabel id={`${dimensionId}-select-label`}>Select Value</InputLabel>
                  <Select
                    labelId={`${dimensionId}-select-label`}
                    value={selectedCustomDimensions[dimensionId] || ''}
                    label="Select Value"
                    onChange={(e) => {
                      const value = e.target.value as string;
                      setSelectedCustomDimensions(prev => ({ ...prev, [dimensionId]: value }));
                    }}
                    size="small"
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {dimensionValues.map((val) => (
                      <MenuItem key={val} value={val}>
                        <ListItemText
                          primary={val}
                          primaryTypographyProps={{
                            style: { fontSize: '0.85rem', fontFamily: 'monospace' }
                          }}
                        />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  label="Value"
                  value={selectedCustomDimensions[dimensionId] || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedCustomDimensions(prev => ({ ...prev, [dimensionId]: value }));
                  }}
                  fullWidth
                  size="small"
                  placeholder="Enter value"
                  helperText={dimension.reference ? `Unit: ${dimension.reference}` : ''}
                />
              )
            )}

            {/* Range Selectors */}
            {(customDimensionModes[dimensionId] || 'individual') === 'range' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {useDropdown ? (
                  <>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`start-${dimensionId}-label`}>Start Value</InputLabel>
                      <Select
                        labelId={`start-${dimensionId}-label`}
                        value={customDimensionStarts[dimensionId] || ''}
                        label="Start Value"
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setCustomDimensionStarts(prev => ({ ...prev, [dimensionId]: newStart }));
                        }}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 300,
                            },
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em>Select start value</em>
                        </MenuItem>
                        {dimensionValues.map((val) => (
                          <MenuItem key={val} value={val}>
                            <ListItemText
                              primary={val}
                              primaryTypographyProps={{
                                style: { fontSize: '0.85rem', fontFamily: 'monospace' }
                              }}
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel id={`end-${dimensionId}-label`}>End Value</InputLabel>
                      <Select
                        labelId={`end-${dimensionId}-label`}
                        value={customDimensionEnds[dimensionId] || ''}
                        label="End Value"
                        onChange={(e) => {
                          const newEnd = e.target.value;
                          setCustomDimensionEnds(prev => ({ ...prev, [dimensionId]: newEnd }));
                        }}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 300,
                            },
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em>Select end value</em>
                        </MenuItem>
                        {dimensionValues.map((val) => (
                          <MenuItem key={val} value={val}>
                            <ListItemText
                              primary={val}
                              primaryTypographyProps={{
                                style: { fontSize: '0.85rem', fontFamily: 'monospace' }
                              }}
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </>
                ) : (
                  <>
                    <TextField
                      label="Start Value"
                      value={customDimensionStarts[dimensionId] || ''}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setCustomDimensionStarts(prev => ({ ...prev, [dimensionId]: newStart }));
                      }}
                      fullWidth
                      size="small"
                      placeholder="Enter start value"
                      helperText={dimension.reference ? `Unit: ${dimension.reference}` : ''}
                    />
                    <TextField
                      label="End Value"
                      value={customDimensionEnds[dimensionId] || ''}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        setCustomDimensionEnds(prev => ({ ...prev, [dimensionId]: newEnd }));
                      }}
                      fullWidth
                      size="small"
                      placeholder="Enter end value"
                      helperText={dimension.reference ? `Unit: ${dimension.reference}` : ''}
                    />
                  </>
                )}
              </Box>
            )}
          </Box>
        ) : null;
      })}
    </>
  );
};

export default CollectionQueryBuilder;
