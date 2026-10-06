import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { toLonLat } from 'ol/proj';
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
import { spatialExtentOf } from './query/validateQuery';
import type { BBox, QueryIssue } from './query/types';

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

const NO_EDGES: (number | null)[] = [null, null, null, null];
const EDGES = [{ label: 'West', index: 0 }, { label: 'East', index: 2 }, { label: 'South', index: 1 }, { label: 'North', index: 3 }];
const round = (value: number) => Math.round(value * 1000) / 1000;

// The map view as a lon/lat box, cut to the collection's extent when they overlap
function viewBox(viewExtent: [number, number, number, number], collectionBox: BBox | null): BBox {
  const [west, south] = toLonLat([viewExtent[0], viewExtent[1]]);
  const [east, north] = toLonLat([viewExtent[2], viewExtent[3]]);
  let box: BBox = [Math.max(west, -180), Math.max(south, -90), Math.min(east, 180), Math.min(north, 90)];
  if (collectionBox) {
    const cut: BBox = [Math.max(box[0], collectionBox[0]), Math.max(box[1], collectionBox[1]), Math.min(box[2], collectionBox[2]), Math.min(box[3], collectionBox[3])];
    if (cut[0] < cut[2] && cut[1] < cut[3]) box = cut;
  }
  return box.map(round) as BBox;
}

// A cube's box as four edge fields, in step with the box drawn on the map. Edges being typed live
// here until all four are numbers; only then does the box (and the request) change.
function BoxFields({ collection, issue, requiredByApiDocs, bboxAsCoords, setBboxAsCoords }: {
  collection: Collection;
  issue?: QueryIssue;
  requiredByApiDocs: boolean;
  bboxAsCoords: boolean;
  setBboxAsCoords: (value: boolean) => void;
}) {
  const { selectedBbox, setSelectedBbox, viewExtent } = useMapInteraction();
  const [edges, setEdges] = useState<(number | null)[]>(selectedBbox ?? NO_EDGES);
  const sent = useRef<BBox | null>(selectedBbox);
  useEffect(() => {
    if (selectedBbox === sent.current) return; // our own update
    sent.current = selectedBbox;
    setEdges(selectedBbox ?? NO_EDGES);
  }, [selectedBbox]);

  const setEdge = (index: number, value: number | null) => {
    const next = edges.map((edge, i) => (i === index ? value : edge));
    setEdges(next);
    const box = next.every(edge => edge !== null) ? next as BBox : null;
    sent.current = box;
    setSelectedBbox(box);
  };

  return (
    <Box sx={{ mb: 2 }} id="query-field-bbox">
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Box (longitude/latitude)</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {EDGES.map(({ label, index }) => (
          <NumberField key={label} id={`query-field-bbox-${label.toLowerCase()}`} label={label} value={edges[index]}
            onChange={value => setEdge(index, value)} issue={issue?.severity === 'error' ? issue : undefined} />
        ))}
      </Box>
      <FieldIssueText issue={issue?.input === 'form' ? issue : undefined} />
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
        <Button size="small" disabled={!viewExtent} onClick={() => viewExtent && setSelectedBbox(viewBox(viewExtent, spatialExtentOf(collection)))}>
          Use map view
        </Button>
        {(requiredByApiDocs || bboxAsCoords) && (
          <FormControlLabel
            control={<Checkbox size="small" checked={bboxAsCoords} onChange={event => setBboxAsCoords(event.target.checked)} />}
            label={<Typography variant="body2">Also send the box as coords (the server's API docs require it)</Typography>}
          />
        )}
      </Box>
    </Box>
  );
}

interface QueryTypeInputsProps {
  collection: Collection;
  queryKey: string;
  queryParams: Record<string, string>;
  setQueryParam: (name: string, value: string) => void;
  bboxAsCoords: boolean;
  setBboxAsCoords: (value: boolean) => void;
}

// Inputs a query type needs besides (or instead of) the map: the radius, a corridor's width and
// height, or a cube's box
const QueryTypeInputs: React.FC<QueryTypeInputsProps> = ({ collection, queryKey, queryParams, setQueryParam, bboxAsCoords, setBboxAsCoords }) => {
  const { radius, setRadius, radiusUnits, setRadiusUnits } = useMapInteraction();
  const { issues, apiOperation } = useQueryValidation();
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
  if (queryType === 'cube') {
    return (
      <BoxFields collection={collection} issue={fieldIssue('bbox')} requiredByApiDocs={!!apiOperation?.required.includes('coords')}
        bboxAsCoords={bboxAsCoords} setBboxAsCoords={setBboxAsCoords} />
    );
  }
  if (queryType === 'corridor') {
    // A height needs a level to be measured from, so only collections with levels get one
    const sizes = [
      { field: 'corridor-width', unitField: 'width-units', label: 'Corridor width', kind: 'width' as const },
      ...(collection.extent?.vertical ? [{ field: 'corridor-height', unitField: 'height-units', label: 'Corridor height', kind: 'height' as const }] : []),
    ];
    return (
      <>
        {sizes.map(({ field, unitField, label, kind }) => {
          const value = queryParams[field]?.trim() ?? '';
          return (
            <ValueWithUnit key={field} issues={[fieldIssue(field), fieldIssue(unitField)]}>
              <NumberField id={`query-field-${field}`} label={label} value={value === '' || !isFinite(Number(value)) ? null : Number(value)}
                onChange={number => setQueryParam(field, number === null ? '' : String(number))} issue={fieldIssue(field)} />
              <UnitField id={`query-field-${unitField}`} label="Unit" value={queryParams[unitField] ?? ''} options={unitsFor(variables, kind)}
                onChange={unit => setQueryParam(unitField, unit)} issue={fieldIssue(unitField)} />
            </ValueWithUnit>
          );
        })}
      </>
    );
  }
  return null;
};

export default QueryTypeInputs;
