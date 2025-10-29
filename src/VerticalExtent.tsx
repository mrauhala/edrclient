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
import { Vertical, normalizeVertical, formatVerticalInterval, formatVerticalValue, getOverallVerticalExtent, getVerticalUnit } from './DataRetrievalAPI';

interface VerticalExtentProps {
  vertical: Vertical | null | undefined;
  collectionId?: string;
  isSubsection?: boolean;
}

const VerticalExtent: React.FC<VerticalExtentProps> = ({ vertical, collectionId, isSubsection = false }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getAlertTitle = () => {
    return isSubsection ? "G.3: Vertical Extent (Optional)" : "VERTICAL EXTENT";
  };

  // If no vertical extent, show appropriate message
  if (!vertical) {
    return (
      <Alert severity="warning">
        <AlertTitle>{getAlertTitle()}</AlertTitle>
        No vertical extent information available for this collection. 
        The collection may not have height/depth-dependent data or vertical metadata may be missing.
      </Alert>
    );
  }

  // Normalize the vertical extent
  const normalizedVertical = normalizeVertical(vertical);
  
  if (!normalizedVertical) {
    return (
      <Alert severity="error">
        <AlertTitle>{getAlertTitle()}</AlertTitle>
        Invalid vertical extent format in collection metadata.
      </Alert>
    );
  }

  const { intervals, values, vrs } = normalizedVertical;
  const hasIntervals = intervals.length > 0;
  const hasValues = values.length > 0;

  if (!hasIntervals && !hasValues) {
    return (
      <Alert severity="warning">
        <AlertTitle>{getAlertTitle()}</AlertTitle>
        Vertical extent is defined but contains no valid intervals or values.
      </Alert>
    );
  }

  // Get overall vertical coverage and unit
  const overallExtent = hasIntervals ? getOverallVerticalExtent(intervals) : null;
  const unit = getVerticalUnit(vrs);

  return (
    <Box sx={{ mt: 1 }}>
      <Alert severity="success">
        <AlertTitle>{getAlertTitle()}</AlertTitle>
        
        {/* Overall coverage summary */}
        {overallExtent && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              Overall Coverage: {formatVerticalInterval(overallExtent[0], overallExtent[1], unit)}
            </Typography>
          </Box>
        )}

        {/* Vertical Reference System */}
        {vrs && vrs !== 'Unknown' && (
          <Box sx={{ mb: 1 }}>
            <Chip 
              label={`VRS: ${vrs}`} 
              size="small" 
              variant="outlined" 
              color="info"
              sx={{ fontSize: '0.65rem', maxWidth: '100%' }}
            />
          </Box>
        )}

        {/* Summary counts */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          {hasIntervals && (
            <Chip 
              label={`${intervals.length} level interval${intervals.length !== 1 ? 's' : ''}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          {hasValues && (
            <Chip 
              label={`${values.length} level value${values.length !== 1 ? 's' : ''}`}
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
            
            {/* Level Intervals */}
            {hasIntervals && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Level Intervals ({intervals.length})
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                  {intervals.map((interval, index) => (
                    <ListItem key={index} divider={index < intervals.length - 1}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontFamily="monospace">
                            {formatVerticalInterval(interval[0], interval[1], unit)}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            Interval {index + 1}
                            {interval[0] === null && ' (open minimum)'}
                            {interval[1] === null && ' (open maximum)'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Level Values */}
            {hasValues && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Specific Level Values ({values.length})
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                  {values.slice(0, 50).map((value, index) => (
                    <ListItem key={index} divider={index < Math.min(values.length, 50) - 1}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontFamily="monospace">
                            {formatVerticalValue(value)}{unit && ` ${unit}`}
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

            {/* Raw vertical object for debugging */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Raw vertical object available in browser console for collection: {collectionId}
              </Typography>
            </Box>
          </Box>
        </Collapse>
      </Alert>
    </Box>
  );
};

export default VerticalExtent;