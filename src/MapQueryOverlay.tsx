import React, { type ReactNode } from 'react';

// What the map asks for in each query type, and the button that clears it
interface QueryPrompt {
  title: string;
  text: string; // {radius} is replaced with the radius and its unit
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
  area: { title: 'Draw Areas on Map', text: 'Click to add vertices, double-click to complete each polygon', clear: 'Clear Polygons', accent: 'red' },
};

const ACCENTS = {
  red: { border: 'rgba(255, 0, 0, 0.6)', title: '#FF4444' },
  blue: { border: 'rgba(0, 123, 255, 0.6)', title: '#007BFF' },
};

const promptStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  color: 'white',
  padding: '16px 24px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 'normal',
  zIndex: 1000,
  boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
  textAlign: 'center',
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
  children?: ReactNode; // controls shown under the clear button, e.g. the radius slider
}

// The prompt in the middle of the map until the query has its geometry, then the clear button
const MapQueryOverlay: React.FC<MapQueryOverlayProps> = ({ queryType, hasGeometry, isDrawing, onClear, radiusLabel = '', children }) => {
  const prompt = PROMPTS[queryType];
  if (!prompt) return null;
  const accent = ACCENTS[prompt.accent];
  return (
    <>
      {!hasGeometry && (
        <div style={{ ...promptStyle, border: `2px solid ${accent.border}` }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '16px', color: accent.title }}>{prompt.title}</div>
          <div>{prompt.text.replace('{radius}', radiusLabel)}</div>
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
