import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Link from '@mui/material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import KeywordChips from '../KeywordChips';
import ThemeChips, { isThemesArray } from '../ThemeChips';
import ContactCards, { isContactsArray } from '../ContactCards';

const INITIAL_VISIBLE = 8;
const JSON_TRUNCATE_LENGTH = 500;

interface FeatureViewerPropertiesProps {
  properties: Record<string, unknown>;
  onSelectLabelProperty?: (propertyName: string) => void;
  selectedLabelProperty?: string;
}

function isUrl(value: unknown): value is string {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
}

const FeatureViewerProperties: React.FC<FeatureViewerPropertiesProps> = ({
  properties,
  onSelectLabelProperty,
  selectedLabelProperty,
}) => {
  const [expanded, setExpanded] = useState(false);

  const entries = useMemo(
    () => Object.entries(properties),
    [properties]
  );

  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        No properties available
      </Typography>
    );
  }

  const needsExpansion = entries.length > INITIAL_VISIBLE;
  const visibleEntries = needsExpansion && !expanded ? entries.slice(0, INITIAL_VISIBLE) : entries;
  const hiddenEntries = needsExpansion && !expanded ? entries.slice(INITIAL_VISIBLE) : [];

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Properties
      </Typography>
      {onSelectLabelProperty && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontStyle: 'italic' }}>
          Click a property to use it as a map label
        </Typography>
      )}

      <Box>
        {visibleEntries.map(([key, value], index) => (
          <PropertyRow
            key={key}
            propKey={key}
            value={value}
            isSelected={selectedLabelProperty === key}
            onSelectLabel={onSelectLabelProperty}
            showDivider={index > 0 && index % 5 === 0}
          />
        ))}

        {needsExpansion && (
          <>
            <Collapse in={expanded}>
              {hiddenEntries.map(([key, value], index) => (
                <PropertyRow
                  key={key}
                  propKey={key}
                  value={value}
                  isSelected={selectedLabelProperty === key}
                  onSelectLabel={onSelectLabelProperty}
                  showDivider={(index + INITIAL_VISIBLE) % 5 === 0}
                />
              ))}
            </Collapse>
            <Button
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ mt: 1, textTransform: 'none' }}
            >
              {expanded ? 'Show less' : `Show all ${entries.length} properties`}
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
};

interface PropertyRowProps {
  propKey: string;
  value: unknown;
  isSelected: boolean;
  onSelectLabel?: (propertyName: string) => void;
  showDivider: boolean;
}

const PropertyRow: React.FC<PropertyRowProps> = ({
  propKey,
  value,
  isSelected,
  onSelectLabel,
  showDivider,
}) => {
  const isStringOrNumber = typeof value === 'string' || typeof value === 'number';
  const isClickable = isStringOrNumber && !!onSelectLabel;

  return (
    <>
      {showDivider && <Divider sx={{ my: 1 }} />}
      <Box
        sx={{
          py: 0.75,
          px: 1,
          borderLeft: isSelected ? '3px solid' : '3px solid transparent',
          borderLeftColor: isSelected ? 'warning.main' : 'transparent',
          cursor: isClickable ? 'pointer' : 'default',
          '&:hover': isClickable
            ? { backgroundColor: 'action.hover' }
            : undefined,
          minHeight: onSelectLabel ? '44px' : undefined,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
        onClick={() => {
          if (isClickable) {
            onSelectLabel(propKey);
          }
        }}
      >
        <Typography
          variant="caption"
          component="div"
          color={isSelected ? 'warning.main' : 'text.secondary'}
          sx={{ fontWeight: 'bold' }}
        >
          {propKey}
        </Typography>
        <PropertyValue propKey={propKey} value={value} />
      </Box>
    </>
  );
};

const PropertyValue: React.FC<{ propKey: string; value: unknown }> = ({ propKey, value }) => {
  const [jsonExpanded, setJsonExpanded] = useState(false);

  if (value === null || value === undefined) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        null
      </Typography>
    );
  }

  if (propKey === 'keywords' && Array.isArray(value)) {
    return (
      <Box sx={{ mt: 0.5 }}>
        <KeywordChips keywords={value as string[]} />
      </Box>
    );
  }

  if (propKey === 'themes' && isThemesArray(value)) {
    return (
      <Box sx={{ mt: 0.5 }}>
        <ThemeChips themes={value} />
      </Box>
    );
  }

  if (propKey === 'contacts' && isContactsArray(value)) {
    return (
      <Box sx={{ mt: 0.5 }}>
        <ContactCards contacts={value} />
      </Box>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <Chip
        label={String(value)}
        size="small"
        color={value ? 'success' : 'default'}
        variant="outlined"
        sx={{ mt: 0.5 }}
      />
    );
  }

  if (isUrl(value)) {
    return (
      <Link
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        variant="body2"
        sx={{
          wordBreak: 'break-all',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {value.length > 60 ? `${value.slice(0, 60)}...` : value}
        <OpenInNewIcon sx={{ fontSize: 14 }} />
      </Link>
    );
  }

  if (typeof value === 'object') {
    const jsonStr = JSON.stringify(value, null, 2);
    const isLarge = jsonStr.length > JSON_TRUNCATE_LENGTH;

    return (
      <Box>
        <pre
          style={{
            margin: 0,
            fontSize: '0.75rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
          }}
        >
          {isLarge && !jsonExpanded ? `${jsonStr.slice(0, JSON_TRUNCATE_LENGTH)}...` : jsonStr}
        </pre>
        {isLarge && (
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setJsonExpanded(!jsonExpanded);
            }}
            sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontSize: '0.75rem' }}
          >
            {jsonExpanded ? 'Collapse' : 'Expand'}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Typography
      variant="body2"
      component="div"
      sx={{ wordBreak: 'break-word' }}
    >
      {String(value)}
    </Typography>
  );
};

export default React.memo(FeatureViewerProperties);
