import React, { useMemo } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { ChartsText, type ChartsTextProps } from '@mui/x-charts/ChartsText';
import type { AxisValueFormatterContext } from '@mui/x-charts/models';
import { getTimeSeriesError } from './utils/coverageTimeSeries';

interface CoverageJsonChartProps {
  data: unknown;
}

interface CoverageJson {
  type: string;
  domain?: {
    type: string;
    domainType?: string;
    axes?: {
      t?: {
        values: string[];
      };
    };
  };
  parameters?: {
    [key: string]: {
      type: string;
      description?: {
        en?: string;
        fi?: string;
      };
      unit?: {
        label?: {
          en?: string;
          fi?: string;
        };
        symbol?: {
          value?: string;
        };
      };
      observedProperty?: {
        label?: {
          en?: string;
          fi?: string;
        };
      };
    };
  };
  ranges?: {
    [key: string]: {
      type: string;
      dataType?: string;
      values: (number | null)[];
    };
  };
}

// Time axis ticks show the time, with the date added on the first tick and wherever the day
// changes from the previous tick. Tooltips show the full date and time.
const formatTime = (value: Date | number, context: AxisValueFormatterContext<'time'>): string => {
  const date = new Date(value);
  if (context.location !== 'tick') {
    return date.toLocaleString();
  }
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const ticks = context.scale.ticks(context.tickNumber);
  const index = ticks.findIndex(tick => tick.getTime() === date.getTime());
  const isNewDay = index <= 0 || ticks[index - 1].toDateString() !== date.toDateString();
  return isNewDay ? `${time}\n${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : time;
};

// Bold the time axis labels that carry a date line, i.e. the first tick and each day change
const TimeTickLabel: React.FC<ChartsTextProps> = (props) => (
  <ChartsText {...props} style={{ ...props.style, fontWeight: props.text.includes('\n') ? 'bold' : undefined }} />
);

// Component to render a single coverage chart
const SingleCoverageChart: React.FC<{ coverage: CoverageJson; index?: number }> = ({ coverage, index }) => {
  const chartData = useMemo(() => {
    try {
      const timeSeriesError = getTimeSeriesError(coverage);
      if (timeSeriesError) {
        return { error: timeSeriesError };
      }
      const timeValues = coverage.domain?.axes?.t?.values ?? [];

      // Convert time strings to Date objects and then to timestamps
      const timestamps = timeValues.map(t => new Date(t).getTime());

      // Extract parameter data
      const parameters = coverage.parameters;
      const ranges = coverage.ranges;

      if (!parameters || !ranges) {
        return { error: 'No parameters or ranges found in the coverage data' };
      }

      // Build series data for each parameter
      const series: Array<{
        data: (number | null)[];
        label: string;
        valueFormatter?: (value: number | null) => string;
        yAxisKey?: string;
      }> = [];
      
      const unitMap: Map<string, string> = new Map(); // Maps unit to yAxisKey
      const uniqueUnits: string[] = [];

      Object.keys(ranges).forEach(paramKey => {
        const range = ranges[paramKey];
        const parameter = parameters[paramKey];

        if (range.values && range.values.length > 0) {
          const values: (number | null)[] = range.values.map((value, index) =>
            index < timestamps.length ? value : null
          );
          
          // Get parameter label (try English first, then Finnish, then fallback to key)
          let label = paramKey;
          if (parameter?.observedProperty?.label?.en) {
            label = parameter.observedProperty.label.en;
          } else if (parameter?.observedProperty?.label?.fi) {
            label = parameter.observedProperty.label.fi;
          } else if (parameter?.description?.en) {
            label = parameter.description.en;
          } else if (parameter?.description?.fi) {
            label = parameter.description.fi;
          }

          // Get unit for value formatter (try English first, then Finnish)
          let unit = '';
          if (parameter?.unit?.symbol?.value) {
            unit = parameter.unit.symbol.value;
          } else if (parameter?.unit?.label?.en) {
            unit = parameter.unit.label.en;
          } else if (parameter?.unit?.label?.fi) {
            unit = parameter.unit.label.fi;
          }
          
          // Determine which y-axis this series should use
          let yAxisKey: string;
          if (unit) {
            if (!unitMap.has(unit)) {
              // Track unique units in order
              uniqueUnits.push(unit);
              // Assign axis: first -> left, second -> right, third+ -> left (with warning in console)
              if (uniqueUnits.length === 1) {
                yAxisKey = 'left';
              } else if (uniqueUnits.length === 2) {
                yAxisKey = 'right';
              } else {
                console.warn(`More than 2 different units detected. Unit "${unit}" will share the left axis.`);
                yAxisKey = 'left';
              }
              unitMap.set(unit, yAxisKey);
            } else {
              yAxisKey = unitMap.get(unit)!;
            }
          } else {
            yAxisKey = 'left';
          }

          series.push({
            data: values,
            label: label,
            valueFormatter: unit ? (value) => value !== null ? `${value} ${unit}` : '—' : undefined,
            yAxisKey: yAxisKey
          });
        }
      });

      if (series.length === 0) {
        return { error: 'No valid data series found' };
      }

      return {
        timestamps,
        series,
        unitMap,
        error: null
      };
    } catch (err) {
      console.error('Error parsing CoverageJSON:', err);
      return { error: `Failed to parse CoverageJSON: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
  }, [coverage]);

  if ('error' in chartData && chartData.error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">{chartData.error}</Alert>
      </Box>
    );
  }

  const { timestamps, series, unitMap } = chartData as {
    timestamps: number[];
    series: Array<{ data: (number | null)[]; label: string; valueFormatter?: (value: number | null) => string; yAxisKey?: string }>;
    unitMap: Map<string, string>;
  };
  
  // Build y-axis configuration from unitMap. Axes size themselves to their tick labels (a fixed
  // width truncates large values such as pressure in Pa to "102,…") and rescale to the series
  // left visible by legend toggling.
  const yAxisConfig: Array<{ id: string; label: string; scaleType?: 'linear'; position?: 'left' | 'right'; width: 'auto'; domainSeries: 'visible' }> = [];
  unitMap.forEach((yAxisKey, unit) => {
    yAxisConfig.push({
      id: yAxisKey,
      label: unit || 'Value',
      scaleType: 'linear' as const,
      position: yAxisKey === 'left' ? 'left' : 'right',
      width: 'auto',
      domainSeries: 'visible'
    });
  });
  
  // If no units were found, add a default axis
  if (yAxisConfig.length === 0) {
    yAxisConfig.push({
      id: 'left',
      label: 'Value',
      scaleType: 'linear' as const,
      position: 'left',
      width: 'auto',
      domainSeries: 'visible'
    });
  }
  
  const mappedSeries = series.map((s) => ({
    data: s.data,
    label: s.label,
    valueFormatter: s.valueFormatter,
    yAxisId: s.yAxisKey || 'left',
    // Mark every returned value so gaps and the server's time steps are visible
    showMark: true,
  }));

  return (
    <Box sx={{ p: 2, height: '100%', width: '100%' }}>
      <Typography variant="h6" gutterBottom>
        {index !== undefined ? `Coverage ${index + 1} - Time Series Chart` : 'Time Series Chart'}
      </Typography>
      <Box sx={{ width: '100%', height: 'calc(100% - 40px)', minHeight: 400 }}>
        <LineChart
          xAxis={[
            {
              data: timestamps,
              scaleType: 'time',
              label: 'Time',
              valueFormatter: formatTime,
              height: 'auto'
            }
          ]}
          yAxis={yAxisConfig}
          series={mappedSeries}
          // Set on the chart: LineChart overrides per-axis slots. Only time labels contain a date line.
          slots={{ axisTickLabel: TimeTickLabel }}
          height={500}
          margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
          grid={{ vertical: true, horizontal: true }}
          slotProps={{
            legend: {
              position: { vertical: 'top', horizontal: 'center' },
              toggleVisibilityOnClick: true,
            }
          }}
        />
      </Box>
    </Box>
  );
};

// Main component that handles both Coverage and CoverageCollection
const CoverageJsonChart: React.FC<CoverageJsonChartProps> = ({ data }) => {
  const parsed = data as any;

  if (!parsed || typeof parsed !== 'object') {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Invalid CoverageJSON data</Alert>
      </Box>
    );
  }

  // Check if it's a CoverageCollection
  if (parsed.type === 'CoverageCollection' && parsed.coverages && Array.isArray(parsed.coverages)) {
    const coverages = parsed.coverages as CoverageJson[];
    
    if (coverages.length === 0) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="warning">CoverageCollection is empty</Alert>
        </Box>
      );
    }

    // Render multiple charts, one per coverage
    return (
      <Box sx={{ p: 2, height: '100%', width: '100%', overflowY: 'auto' }}>
        <Typography variant="h5" gutterBottom>
          CoverageCollection ({coverages.length} {coverages.length === 1 ? 'Coverage' : 'Coverages'})
        </Typography>
        {coverages.map((coverage, index) => (
          <Box key={index}>
            <SingleCoverageChart coverage={coverage} index={index} />
            {index < coverages.length - 1 && <Divider sx={{ my: 3 }} />}
          </Box>
        ))}
      </Box>
    );
  }

  // Single Coverage - use original logic
  if (parsed.type === 'Coverage') {
    return <SingleCoverageChart coverage={parsed as CoverageJson} />;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Alert severity="warning">Unsupported type: {parsed.type}</Alert>
    </Box>
  );
};

export default CoverageJsonChart;
