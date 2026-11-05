import React, { useId, useState, type ReactNode } from 'react';
import ButtonBase from '@mui/material/ButtonBase';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { usePanes } from './contexts/PanesContext';

// What the map asks for in each query type, and the button that clears it. An optional input
// (an items box, a location) gets no prompt, only the clear button.
interface QueryPrompt {
  title?: string;
  text?: string; // {radius} is replaced with the radius and its unit
  clear: string;
  accent: 'red' | 'blue';
}

const PROMPTS: Record<string, QueryPrompt> = {
  position: { title: 'Click Points on Map', text: 'Click to add multiple points', clear: 'Clear Points', accent: 'red' },
  radius: { title: 'Click Points on Map', text: 'Click to add multiple points with radius {radius}', clear: 'Clear Points', accent: 'blue' },
  trajectory: {
    title: 'Draw Trajectory on Map', text: 'Click to add points along the path; double-click to finish', clear: 'Clear Trajectory', accent: 'red',
  },
  corridor: {
    title: 'Draw the Corridor on Map', text: 'Click to add points along the centre line; double-click to finish', clear: 'Clear Corridor', accent: 'red',
  },
  cube: { title: 'Draw a Box on Map', text: 'Click one corner of the box, then the opposite corner', clear: 'Clear Box', accent: 'red' },
  items: { clear: 'Clear Box', accent: 'red' },
  locations: { clear: 'Clear Location', accent: 'red' },
  area: { title: 'Draw Areas on Map', text: 'Click to add vertices, double-click to complete each polygon', clear: 'Clear Polygons', accent: 'red' },
};

const ACCENTS = {
  red: { border: 'rgba(255, 0, 0, 0.6)', title: '#FF4444', selection: 'rgba(255, 255, 255, 0.2)' },
  blue: { border: 'rgba(0, 123, 255, 0.6)', title: '#007BFF', selection: 'rgba(0, 123, 255, 0.5)' },
};

// At the left of the map's bottom edge, out of the way of where people click and clear of the
// collection panel (top left), the feature viewer (top right) and the overview and attribution
// buttons (bottom right)
const cardStyle: React.CSSProperties = {
  marginLeft: '10px',
  maxWidth: 'calc(100% - 74px)',
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  color: 'white',
  padding: '6px 10px',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 'normal',
  boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: '12px',
  rowGap: '4px',
};

const clearButtonStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 68, 68, 0.9)',
  color: 'white',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  padding: '8px 10px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 'bold',
  cursor: 'pointer',
  // Also while the prompt beside it lets clicks through
  pointerEvents: 'auto',
};

const undoButtonStyle: React.CSSProperties = {
  ...clearButtonStyle,
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
};

const buttonsStyle: React.CSSProperties = { display: 'flex', gap: '6px', marginLeft: 'auto' };

const headerButtonSx = { minHeight: 32, gap: 0.5, borderRadius: '4px', font: 'inherit', fontSize: 12, fontWeight: 'bold', textAlign: 'left' };

const listStyle: React.CSSProperties = {
  margin: '2px 0 4px',
  maxHeight: '30vh',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  fontFamily: 'monospace',
  fontSize: '10px',
};

export interface MapSelection {
  title: string;
  items: string[];
}

interface MapQueryOverlayProps {
  queryType: string;
  hasGeometry: boolean;
  isDrawing: boolean;
  onClear: () => void;
  onUndo?: () => void; // takes back the newest point or vertex, for geometry built up from them
  radiusLabel?: string;
  selection?: MapSelection; // what the query has from the map, listed once it has it
  location?: { name: string; onInfo: () => void }; // the selected location, and showing its information
  children?: ReactNode; // controls for the geometry, under the list, e.g. the radius slider
}

// Everything about the query's map input, in one card: the prompt until the query has its geometry,
// then what it has, and the clear button. The list collapses, and starts collapsed on phones, where
// it would cover the map. The parent stacks the card along the map's bottom edge
const MapQueryOverlay: React.FC<MapQueryOverlayProps> = ({ queryType, hasGeometry, isDrawing, onClear, onUndo, radiusLabel = '', selection, location, children }) => {
  const { isMobile } = usePanes();
  const [listOpen, setListOpen] = useState(!isMobile);
  const listId = useId();

  const prompt = PROMPTS[queryType];
  if (!prompt) return null;
  const showPrompt = !hasGeometry && !!prompt.title;
  const showClear = hasGeometry || isDrawing;
  if (!showPrompt && !showClear) return null;
  const list = hasGeometry && selection && selection.items.length > 0 ? selection : null;
  const accent = ACCENTS[prompt.accent];
  return (
    <div
      style={{
        ...cardStyle,
        border: hasGeometry ? `1px solid ${accent.selection}` : `2px solid ${accent.border}`,
        // Clicks on the prompt reach the map
        pointerEvents: hasGeometry ? 'auto' : 'none',
      }}
    >
      <div style={rowStyle}>
        {showPrompt && <div style={{ fontWeight: 'bold', fontSize: '14px', color: accent.title }}>{prompt.title}</div>}
        {list && (
          <ButtonBase
            aria-expanded={listOpen}
            aria-controls={listOpen ? listId : undefined}
            onClick={() => setListOpen(!listOpen)}
            sx={headerButtonSx}
          >
            {list.title} ({list.items.length})
            {listOpen ? <ExpandMore sx={{ fontSize: 18 }} /> : <ExpandLess sx={{ fontSize: 18 }} />}
          </ButtonBase>
        )}
        {location && (
          <ButtonBase aria-label={`Location information: ${location.name}`} onClick={location.onInfo} sx={headerButtonSx}>
            <InfoOutlined sx={{ fontSize: 18 }} />
            {location.name}
          </ButtonBase>
        )}
        {showClear && (
          <div style={buttonsStyle}>
            {onUndo && <button onClick={onUndo} style={undoButtonStyle}>Undo</button>}
            <button
              onClick={onClear}
              style={clearButtonStyle}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 1)'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.9)'; }}
            >
              {prompt.clear}
            </button>
          </div>
        )}
      </div>
      {showPrompt && <div style={{ marginTop: '4px' }}>{prompt.text?.replace('{radius}', radiusLabel)}</div>}
      {list && listOpen && (
        <div id={listId} style={listStyle}>
          {list.items.map((item, idx) => (
            <div key={idx} style={{ marginTop: idx > 0 ? '4px' : '0' }}>{idx + 1}. {item}</div>
          ))}
        </div>
      )}
      {hasGeometry && children}
    </div>
  );
};

export default MapQueryOverlay;
