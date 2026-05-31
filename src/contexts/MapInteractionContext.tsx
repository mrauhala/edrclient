import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';

interface MapInteractionContextValue {
  clickedCoords: [number, number][];
  setClickedCoords: (coords: [number, number][]) => void;
  selectedArea: [number, number][][];
  setSelectedArea: (area: [number, number][][]) => void;
  radiusKm: number;
  setRadiusKm: (radius: number) => void;
  dataQuery: string;
  setDataQuery: (query: string) => void;
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
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [dataQuery, setDataQuery] = useState<string>('');
  const [viewExtent, setViewExtent] = useState<[number, number, number, number] | null>(null);
  const [viewSize, setViewSize] = useState<[number, number] | null>(null);

  const value = useMemo(() => ({
    clickedCoords,
    setClickedCoords,
    selectedArea,
    setSelectedArea,
    radiusKm,
    setRadiusKm,
    dataQuery,
    setDataQuery,
    viewExtent,
    setViewExtent,
    viewSize,
    setViewSize,
  }), [clickedCoords, selectedArea, radiusKm, dataQuery, viewExtent, viewSize]);

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
