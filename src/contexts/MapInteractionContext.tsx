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
}

const MapInteractionContext = createContext<MapInteractionContextValue | null>(null);

export function MapInteractionProvider({ children }: { children: ReactNode }) {
  const [clickedCoords, setClickedCoords] = useState<[number, number][]>([]);
  const [selectedArea, setSelectedArea] = useState<[number, number][][]>([]);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [dataQuery, setDataQuery] = useState<string>('');

  const value = useMemo(() => ({
    clickedCoords,
    setClickedCoords,
    selectedArea,
    setSelectedArea,
    radiusKm,
    setRadiusKm,
    dataQuery,
    setDataQuery,
  }), [clickedCoords, selectedArea, radiusKm, dataQuery]);

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
