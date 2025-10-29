import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import { Temporal, normalizeTemporal, formatTemporalInterval, getOverallTemporalExtent } from './DataRetrievalAPI';

interface TemporalExtentProps {
  temporal: Temporal | null | undefined;
  collectionId?: string;
  isSubsection?: boolean;
}

const TemporalExtent: React.FC<TemporalExtentProps> = ({ temporal, collectionId, isSubsection = false }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getAlertTitle = () => {
    return isSubsection ? "G.2: Temporal Extent (Optional)" : "TEMPORAL EXTENT";
  };

  // If no temporal extent, show appropriate message
  if (!temporal) {
    return (
      <Alert severity="warning">
        <AlertTitle>{getAlertTitle()}</AlertTitle>
        No temporal extent information available for this collection. 
        The collection may not have time-dependent data or temporal metadata may be missing.
      </Alert>
    );
  }

  // Normalize the temporal extent
  const normalizedTemporal = normalizeTemporal(temporal);
  
  if (!normalizedTemporal) {
    return (
      <Alert severity="error">
        <AlertTitle>{getAlertTitle()}</AlertTitle>
        Invalid temporal extent format in collection metadata.
      </Alert>
    );
  }

  const { intervals, values, trs } = normalizedTemporal;
  const hasIntervals = intervals.length > 0;
  const hasValues = values.length > 0;

  if (!hasIntervals && !hasValues) {
    return (
      <Alert severity="warning">
        <AlertTitle>{getAlertTitle()}</AlertTitle>
        Temporal extent is defined but contains no valid intervals or values.
      </Alert>
    );
  }

  // Get overall temporal coverage
  const overallExtent = hasIntervals ? getOverallTemporalExtent(intervals) : null;

  return (
    <Box sx={{ mt: 1 }}>
      <Alert severity="success">
        <AlertTitle>{getAlertTitle()}</AlertTitle>
        
        {/* Overall coverage summary */}
        {overallExtent && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              Overall Coverage: {formatTemporalInterval(overallExtent[0], overallExtent[1])}
            </Typography>
          </Box>
        )}

        {/* Temporal Reference System */}
        {trs && trs !== 'Gregorian' && (
          <Box sx={{ mb: 1 }}>
            <Chip 
              label={`TRS: ${trs}`} 
              size="small" 
              variant="outlined" 
              color="info"
            />
          </Box>
        )}

        {/* Summary counts */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          {hasIntervals && (
            <Chip 
              label={`${intervals.length} time interval${intervals.length !== 1 ? 's' : ''}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          {hasValues && (
            <Chip 
              label={`${values.length} time value${values.length !== 1 ? 's' : ''}`}
              size="small"
              color="secondary"
              variant="outlined"
            />
          )}
        </Box>

        {/* Toggle details button */}
        <Button
          variant="outlined"
          size="small"
          onClick={() => setShowDetails(!showDetails)}
          startIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </Button>

        {/* Detailed information */}
        <Collapse in={showDetails}>
          <Box sx={{ mt: 2 }}>
            
            {/* Time Intervals */}
            {hasIntervals && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Time Intervals ({intervals.length})
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                  {intervals.map((interval, index) => (
                    <ListItem key={index} divider={index < intervals.length - 1}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontFamily="monospace">
                            {formatTemporalInterval(interval[0], interval[1])}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            Interval {index + 1}
                            {interval[0] === null && ' (open start)'}
                            {interval[1] === null && ' (open end)'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Time Values */}
            {hasValues && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Specific Time Values ({values.length})
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                  {values.slice(0, 50).map((value, index) => (
                    <ListItem key={index} divider={index < Math.min(values.length, 50) - 1}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontFamily="monospace">
                            {value}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            Value {index + 1}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                  {values.length > 50 && (
                    <ListItem>
                      <ListItemText
                        secondary={
                          <Typography variant="caption" color="text.secondary" fontStyle="italic">
                            ... and {values.length - 50} more values
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            )}

            {/* Raw temporal object for debugging */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Raw temporal object available in browser console for collection: {collectionId}
              </Typography>
            </Box>
          </Box>
        </Collapse>
      </Alert>
    </Box>
  );
};

export default TemporalExtent;