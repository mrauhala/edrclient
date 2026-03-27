import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TuneIcon from '@mui/icons-material/Tune';
import CheckIcon from '@mui/icons-material/Check';
import type { QueryablesSchema, QueryableProperty } from '../api/queryables';
import type { FeatureItem } from './types';

interface QueryablesFilterPanelProps {
  queryables: QueryablesSchema | null;
  queryablesLoading: boolean;
  activeFilters: Record<string, string>;
  onApplyFilter: (property: string, value: string) => void;
  loadedItems: FeatureItem[];
}

function getInputType(prop: QueryableProperty): 'enum' | 'boolean' | 'text' {
  if (prop.enum && prop.enum.length > 0) return 'enum';
  if (prop.type === 'boolean') return 'boolean';
  return 'text';
}

function getTypeLabel(prop: QueryableProperty): string {
  if (prop.format === 'date-time') return 'date-time';
  return prop.type;
}

/** Extract unique values for a given property from loaded items (capped at 50). */
function extractUniqueValues(items: FeatureItem[], propertyName: string): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.size >= 50) break;
    const val = item.properties?.[propertyName];
    if (val != null && val !== '') {
      seen.add(String(val));
    }
  }
  return Array.from(seen).sort();
}

export function QueryablesFilterPanel({
  queryables,
  queryablesLoading,
  activeFilters,
  onApplyFilter,
  loadedItems,
}: QueryablesFilterPanelProps) {
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');

  const selectedQP = queryables?.properties.find(p => p.name === selectedProperty) ?? null;
  const inputType = selectedQP ? getInputType(selectedQP) : 'text';

  // Suggestions from loaded items for the selected property
  const suggestions = useMemo(() => {
    if (!selectedProperty || !selectedQP) return [];
    // If schema already has enum, use that instead
    if (selectedQP.enum && selectedQP.enum.length > 0) return [];
    if (selectedQP.type === 'boolean') return [];
    return extractUniqueValues(loadedItems, selectedProperty);
  }, [selectedProperty, selectedQP, loadedItems]);

  const handleChipClick = (name: string) => {
    if (selectedProperty === name) {
      setSelectedProperty(null);
      setFilterValue('');
    } else {
      setSelectedProperty(name);
      // Pre-fill with existing filter value if editing
      setFilterValue(activeFilters[name] ?? '');
    }
  };

  const handleApply = () => {
    if (!selectedProperty || !filterValue) return;
    onApplyFilter(selectedProperty, filterValue);
    setSelectedProperty(null);
    setFilterValue('');
  };

  const handleCancel = () => {
    setSelectedProperty(null);
    setFilterValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, pt: 1, pb: 0.5 }}>
        <TuneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
          Filter by property
        </Typography>
      </Box>

      {/* Property chips */}
      <Box sx={{ display: 'flex', gap: 0.5, px: 1.5, pb: 1, flexWrap: 'wrap' }}>
        {queryablesLoading ? (
          <>
            {[70, 85, 60, 90, 75].map((w, i) => (
              <Skeleton key={i} variant="rounded" width={w} height={24} sx={{ borderRadius: 3 }} />
            ))}
          </>
        ) : queryables?.properties.map((prop) => {
          const isSelected = selectedProperty === prop.name;
          const hasFilter = prop.name in activeFilters;
          return (
            <Chip
              key={prop.name}
              icon={isSelected || hasFilter ? <CheckIcon sx={{ fontSize: 14 }} /> : undefined}
              label={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {prop.title || prop.name}
                  {!isSelected && !hasFilter && (
                    <Typography component="span" sx={{ fontSize: '0.58rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {getTypeLabel(prop)}
                    </Typography>
                  )}
                </Box>
              }
              size="small"
              variant={isSelected || hasFilter ? 'filled' : 'outlined'}
              color={isSelected || hasFilter ? 'primary' : 'default'}
              onClick={() => handleChipClick(prop.name)}
              sx={{ height: 24, fontSize: '0.72rem' }}
            />
          );
        })}
      </Box>

      {/* Inline filter form */}
      {selectedProperty && selectedQP && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, pb: 1, pt: 0.5, borderTop: 1, borderColor: 'divider', bgcolor: 'primary.50' }}>
          <Typography variant="caption" sx={{ fontWeight: 500, color: 'primary.main', flexShrink: 0, fontSize: '0.75rem' }}>
            {selectedQP.title || selectedQP.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">=</Typography>

          {inputType === 'enum' ? (
            <Autocomplete
              size="small"
              options={selectedQP.enum!}
              value={filterValue || null}
              onChange={(_, v) => setFilterValue(v ?? '')}
              disableClearable={false}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select value..."
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
              )}
              sx={{ flex: 1, minWidth: 120, '& .MuiInputBase-root': { height: 28, fontSize: '0.75rem', py: '0 !important' }, '& .MuiInputBase-input': { py: '2px !important' } }}
              slotProps={{ popper: { sx: { '& .MuiAutocomplete-option': { fontSize: '0.75rem' } } } }}
            />
          ) : inputType === 'boolean' ? (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filterValue}
              onChange={(_, v) => { if (v !== null) setFilterValue(v); }}
              sx={{ height: 28 }}
            >
              <ToggleButton value="true" sx={{ fontSize: '0.72rem', px: 1.5, textTransform: 'none' }}>true</ToggleButton>
              <ToggleButton value="false" sx={{ fontSize: '0.72rem', px: 1.5, textTransform: 'none' }}>false</ToggleButton>
            </ToggleButtonGroup>
          ) : suggestions.length > 0 ? (
            <Autocomplete
              size="small"
              freeSolo
              options={suggestions}
              value={filterValue}
              onChange={(_, v) => setFilterValue(v ?? '')}
              onInputChange={(_, v, reason) => { if (reason !== 'reset') setFilterValue(v); }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Type or select..."
                  onKeyDown={handleKeyDown}
                  autoFocus
                  slotProps={{
                    htmlInput: {
                      ...params.inputProps,
                      inputMode: (selectedQP.type === 'number' || selectedQP.type === 'integer') ? 'numeric' : 'text',
                    },
                  }}
                />
              )}
              sx={{ flex: 1, minWidth: 120, '& .MuiInputBase-root': { height: 28, fontSize: '0.75rem', py: '0 !important' }, '& .MuiInputBase-input': { py: '2px !important' } }}
              slotProps={{ popper: { sx: { '& .MuiAutocomplete-option': { fontSize: '0.75rem' } } } }}
            />
          ) : (
            <TextField
              size="small"
              placeholder="Enter value..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              slotProps={{
                htmlInput: {
                  inputMode: (selectedQP.type === 'number' || selectedQP.type === 'integer') ? 'numeric' : 'text',
                },
              }}
              sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5, px: 1 }, '& .MuiInputBase-root': { height: 28 } }}
            />
          )}

          <Button
            size="small"
            variant="contained"
            onClick={handleApply}
            disabled={!filterValue}
            sx={{ height: 28, fontSize: '0.72rem', textTransform: 'none', minWidth: 'auto', px: 1.5 }}
          >
            Apply
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={handleCancel}
            sx={{ height: 28, fontSize: '0.72rem', textTransform: 'none', minWidth: 'auto', px: 1, color: 'text.secondary', borderColor: 'divider' }}
          >
            Cancel
          </Button>
        </Box>
      )}
    </Box>
  );
}
