import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import type { Collection } from './DataRetrievalAPI';
import { FieldIssueText } from './QueryIssuesPanel';
import { useQueryValidation } from './hooks/useQueryValidation';
import { useMapInteraction } from './contexts/MapInteractionContext';
import { queryTypeOf, queryVariables, unitsFor } from './query/queryTypes';
import type { QueryIssue } from './query/types';

// A number typed as text: the value updates whenever the text is a number, and an outside change
// (e.g. the map's slider) replaces the text only if it means another number, so "2." survives typing
function NumberField({ id, label, value, onChange, issue }: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  issue?: QueryIssue;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    setText(current => {
      const typed = current.trim() === '' ? null : Number(current);
      return typed === value ? current : value === null ? '' : String(value);
    });
  }, [value]);
  return (
    <TextField
      id={id}
      label={label}
      size="small"
      fullWidth
      value={text}
      error={issue?.severity === 'error'}
      onChange={event => {
        setText(event.target.value);
        const parsed = event.target.value.trim() === '' ? null : Number(event.target.value);
        if (parsed === null || isFinite(parsed)) onChange(parsed);
      }}
      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
    />
  );
}

// A unit: a select of the units the collection lists, or free text when it lists none
function UnitField({ id, label, value, options, onChange, issue }: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  issue?: QueryIssue;
}) {
  if (options.length === 0) {
    return <TextField id={id} label={label} size="small" fullWidth value={value} error={issue?.severity === 'error'} onChange={event => onChange(event.target.value)} />;
  }
  return (
    <FormControl id={id} size="small" fullWidth error={issue?.severity === 'error'}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select labelId={`${id}-label`} label={label} value={options.includes(value) ? value : ''} onChange={event => onChange(event.target.value)}>
        {options.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

// A value and its unit side by side, with the more important of their issues below
function ValueWithUnit({ children, issues }: { children: React.ReactNode; issues: (QueryIssue | undefined)[] }) {
  const issue = issues.filter(Boolean).sort((a, b) => (a!.severity === 'error' ? -1 : b!.severity === 'error' ? 1 : 0))[0];
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1 }}>{children}</Box>
      <FieldIssueText issue={issue} />
    </Box>
  );
}

// Inputs a query type needs besides the map geometry: the radius for radius queries
const QueryTypeInputs: React.FC<{ collection: Collection; queryKey: string }> = ({ collection, queryKey }) => {
  const { radius, setRadius, radiusUnits, setRadiusUnits } = useMapInteraction();
  const { issues } = useQueryValidation();
  const fieldIssue = (field: string) => issues.find(issue => issue.field === field && issue.severity !== 'info');
  const queryType = queryTypeOf(collection, queryKey);
  const variables = queryVariables(collection, queryKey);

  if (queryType === 'radius') {
    return (
      <ValueWithUnit issues={[fieldIssue('within'), fieldIssue('within-units')]}>
        <NumberField id="query-field-within" label="Radius" value={radius} onChange={value => setRadius(value ?? 0)} issue={fieldIssue('within')} />
        <UnitField id="query-field-within-units" label="Unit" value={radiusUnits} options={unitsFor(variables, 'within')}
          onChange={setRadiusUnits} issue={fieldIssue('within-units')} />
      </ValueWithUnit>
    );
  }
  return null;
};

export default QueryTypeInputs;
