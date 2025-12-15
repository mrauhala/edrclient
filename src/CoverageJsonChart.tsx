import React, { useMemo, useState } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';

interface CoverageJsonChartProps {
  data: string;
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
      x?: {
        values: number[];
      };
      y?: {
        values: number[];
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

// Component to render a single coverage chart
const SingleCoverageChart: React.FC<{ coverage: CoverageJson; index?: number }> = ({ coverage, index }) => {
  const chartData = useMemo(() => {
    try {
      const domainType = coverage.domain?.domainType;
      
      // Check if it's a PointSeries or Grid with single x,y point
      if (domainType === 'PointSeries') {
        // PointSeries - proceed normally
      } else if (domainType === 'Grid') {
        // Grid - check if it has single x and y values
        const xValues = coverage.domain?.axes?.x?.values;
        const yValues = coverage.domain?.axes?.y?.values;
        
        if (!xValues || !yValues || xValues.length !== 1 || yValues.length !== 1) {
          return { error: 'Grid domain type is only supported with single x and y values (time series at a point)' };
        }
      } else {
        return { error: 'Only PointSeries domain type or Grid with single point is supported for charting' };
      }

      // Extract time values
      const timeValues = coverage.domain?.axes?.t?.values;
      if (!timeValues || timeValues.length === 0) {
        return { error: 'No time axis found in the coverage data' };
      }

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
        data: number[];
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
          // Filter out null values and create corresponding data points
          const dataPoints = range.values.map((value, index) => ({
            x: timestamps[index],
            y: value !== null ? value : NaN
          }));

          const values = dataPoints.map(p => p.y);
          
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
            valueFormatter: unit ? (value) => `${value} ${unit}` : undefined,
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

  // State to track which series are visible - must be before any conditional returns
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(() => {
    if ('error' in chartData && chartData.error) {
      return new Set<string>();
    }
    const { series } = chartData as {
      timestamps: number[];
      series: Array<{ data: number[]; label: string; valueFormatter?: (value: number | null) => string; yAxisKey?: string }>;
      unitMap: Map<string, string>;
    };
    return new Set(series.map(s => s.label));
  });

  if ('error' in chartData && chartData.error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">{chartData.error}</Alert>
      </Box>
    );
  }

  const { timestamps, series, unitMap } = chartData as {
    timestamps: number[];
    series: Array<{ data: number[]; label: string; valueFormatter?: (value: number | null) => string; yAxisKey?: string }>;
    unitMap: Map<string, string>;
  };
  
  // Toggle series visibility
  const toggleSeries = (label: string) => {
    setVisibleSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  };
  
  // Build y-axis configuration from unitMap
  const yAxisConfig: Array<{ id: string; label: string; scaleType?: 'linear'; position?: 'left' | 'right' }> = [];
  unitMap.forEach((yAxisKey, unit) => {
    yAxisConfig.push({
      id: yAxisKey,
      label: unit || 'Value',
      scaleType: 'linear' as const,
      position: yAxisKey === 'left' ? 'left' : 'right'
    });
  });
  
  // If no units were found, add a default axis
  if (yAxisConfig.length === 0) {
    yAxisConfig.push({
      id: 'left',
      label: 'Value',
      scaleType: 'linear' as const,
      position: 'left'
    });
  }
  
  // Map all series - hidden ones have empty data arrays (no line, no tooltip, but still in legend)
  const mappedSeries = series
    .map((s) => {
      const isHidden = !visibleSeries.has(s.label);
      return {
        data: isHidden ? [] : s.data,
        label: s.label,
        valueFormatter: s.valueFormatter,
        yAxisId: s.yAxisKey || 'left',
      };
    });
  
  // Adjust right margin if we have a secondary y-axis
  const rightMargin = yAxisConfig.length > 1 ? 80 : 20;
  
  // Handle legend item click
  const handleLegendClick = (_event: React.MouseEvent, _legendItem: any, itemIndex: number) => {
    const seriesLabel = series[itemIndex].label;
    toggleSeries(seriesLabel);
  };

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
              valueFormatter: (value) => new Date(value).toLocaleString()
            }
          ]}
          yAxis={yAxisConfig}
          series={mappedSeries}
          height={500}
          margin={{ left: 80, right: rightMargin, top: 20, bottom: 80 }}
          grid={{ vertical: true, horizontal: true }}
          slotProps={{
            legend: {
              position: { vertical: 'top', horizontal: 'center' },
              onItemClick: handleLegendClick,
            }
          }}
        />
      </Box>
    </Box>
  );
};

// Main component that handles both Coverage and CoverageCollection
const CoverageJsonChart: React.FC<CoverageJsonChartProps> = ({ data }) => {
  let parsed;
  let parseError: string | null = null;

  try {
    parsed = JSON.parse(data);
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Unknown error';
  }

  if (parseError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          Failed to parse CoverageJSON: {parseError}
        </Alert>
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
