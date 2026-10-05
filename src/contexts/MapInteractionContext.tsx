import { createContext, useCallback, useContext, useState, useMemo, useRef, type ReactNode } from 'react';
import { geometryKindOf } from '../query/queryTypes';
import { convertLength } from '../query/units';
import type { BBox } from '../query/types';

interface MapInteractionContextValue {
  clickedCoords: [number, number][];
  setClickedCoords: (coords: [number, number][]) => void;
  selectedArea: [number, number][][];
  setSelectedArea: (area: [number, number][][]) => void;
  selectedBbox: BBox | null; // cube box, drawn on the map or typed in the builder
  setSelectedBbox: (bbox: BBox | null) => void;
  // Radius queries: the radius in radiusUnits. Changing the unit converts the radius.
  radius: number;
  setRadius: (radius: number) => void;
  radiusUnits: string;
  setRadiusUnits: (units: string) => void;
  // The selected data query's EDR type (position, area, ...), '' for none. Switching to a type that
  // takes another kind of geometry clears the drawn geometry.
  dataQuery: string;
  setDataQuery: (queryType: string) => void;
  // Current OL view extent (EPSG:3857) and viewport size, updated on map move/resize.
  viewExtent: [number, number, number, number] | null;
  setViewExtent: (extent: [number, number, number, number] | null) => void;
  viewSize: [number, number] | null;
  setViewSize: (size: [number, number] | null) => void;
}

const MapInteractionContext = createContext<MapInteractionContextValue | null>(null);

export function MapInteractionProvider({ children }: { children: ReactNode }) {
  const [clickedCoords, setClickedCoords] = useState<[number, number][]>([]);
  const [selectedArea, setSelectedArea] = useState<[number, number][][]>([]);
  const [selectedBbox, setSelectedBbox] = useState<BBox | null>(null);
  const [radius, setRadius] = useState<number>(10);
  const [radiusUnits, setRadiusUnitsState] = useState<string>('km');
  const radiusUnitsRef = useRef('km');
  const [dataQuery, setDataQueryState] = useState<string>('');
  const dataQueryRef = useRef('');
  const [viewExtent, setViewExtent] = useState<[number, number, number, number] | null>(null);
  const [viewSize, setViewSize] = useState<[number, number] | null>(null);

  // Points stay when switching position ↔ radius, a line trajectory ↔ corridor
  const setDataQuery = useCallback((queryType: string) => {
    if (geometryKindOf(queryType) !== geometryKindOf(dataQueryRef.current)) {
      setClickedCoords([]);
      setSelectedArea([]);
      setSelectedBbox(null);
    }
    dataQueryRef.current = queryType;
    setDataQueryState(queryType);
  }, []);

  const setRadiusUnits = useCallback((units: string) => {
    const from = radiusUnitsRef.current;
    if (units === from) return;
    setRadius(value => convertLength(value, from, units));
    radiusUnitsRef.current = units;
    setRadiusUnitsState(units);
  }, []);

  const value = useMemo(() => ({
    clickedCoords,
    setClickedCoords,
    selectedArea,
    setSelectedArea,
    selectedBbox,
    setSelectedBbox,
    radius,
    setRadius,
    radiusUnits,
    setRadiusUnits,
    dataQuery,
    setDataQuery,
    viewExtent,
    setViewExtent,
    viewSize,
    setViewSize,
  }), [clickedCoords, selectedArea, selectedBbox, radius, radiusUnits, setRadiusUnits, dataQuery, setDataQuery, viewExtent, viewSize]);

  return (
    <MapInteractionContext.Provider value={value}>
      {children}
    </MapInteractionContext.Provider>
  );
}

export function useMapInteraction() {
  const context = useContext(MapInteractionContext);
  if (!context) {
    throw new Error('useMapInteraction must be used within a MapInteractionProvider');
  }
  return context;
}
