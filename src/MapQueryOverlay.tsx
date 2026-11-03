import React, { type ReactNode } from 'react';
import MapSelectionInfo, { type MapSelection } from './MapSelectionInfo';

// What the map asks for in each query type, and the button that clears it. An optional geometry
// (an items box) gets no prompt, only the clear button.
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
  area: { title: 'Draw Areas on Map', text: 'Click to add vertices, double-click to complete each polygon', clear: 'Clear Polygons', accent: 'red' },
};

const ACCENTS = {
  red: { border: 'rgba(255, 0, 0, 0.6)', title: '#FF4444', selection: 'rgba(255, 255, 255, 0.2)' },
  blue: { border: 'rgba(0, 123, 255, 0.6)', title: '#007BFF', selection: 'rgba(0, 123, 255, 0.5)' },
};

// The prompt and then the selection take the bottom left corner, out of the way of where people click
// and clear of the collection panel (top left), the clear button (top right) and the attribution
// button and legends (bottom right)
const cornerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '10px',
  left: '10px',
  maxWidth: 'calc(100% - 64px)',
  zIndex: 1000,
};

const promptStyle: React.CSSProperties = {
  ...cornerStyle,
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  color: 'white',
  padding: '10px 14px',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 'normal',
  boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
  // Clicks on it reach the map
  pointerEvents: 'none',
};

const clearButtonStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 68, 68, 0.9)',
  color: 'white',
  border: '2px solid rgba(255, 255, 255, 0.3)',
  padding: '8px 16px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
};

interface MapQueryOverlayProps {
  queryType: string;
  hasGeometry: boolean;
  isDrawing: boolean;
  onClear: () => void;
  radiusLabel?: string;
  selection?: MapSelection; // what the query has from the map, listed once it has it
  children?: ReactNode; // controls shown under the clear button, e.g. the radius slider
}

// The prompt until the query has its geometry, then what it has and the clear button
const MapQueryOverlay: React.FC<MapQueryOverlayProps> = ({ queryType, hasGeometry, isDrawing, onClear, radiusLabel = '', selection, children }) => {
  const prompt = PROMPTS[queryType];
  if (!prompt) return null;
  const accent = ACCENTS[prompt.accent];
  return (
    <>
      {!hasGeometry && prompt.title && (
        <div style={{ ...promptStyle, border: `2px solid ${accent.border}` }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '14px', color: accent.title }}>{prompt.title}</div>
          <div>{prompt.text?.replace('{radius}', radiusLabel)}</div>
        </div>
      )}
      {hasGeometry && selection && selection.items.length > 0 && (
        <div style={cornerStyle}>
          <MapSelectionInfo {...selection} borderColor={accent.selection} />
        </div>
      )}
      {(hasGeometry || isDrawing) && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={onClear}
            style={clearButtonStyle}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 1)'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.9)'; }}
          >
            {prompt.clear}
          </button>
          {hasGeometry && children}
        </div>
      )}
    </>
  );
};

export default MapQueryOverlay;
