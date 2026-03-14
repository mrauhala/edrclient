import { createContext, useContext, useState, useMemo, type ReactNode, type Dispatch, type SetStateAction } from 'react';

export interface GeoJsonLayer {
  url: string;
  title: string;
  visible: boolean;
  labelProperty?: string;
  data?: any;
  apiKey?: string;
  apiKeyParam?: string;
}

interface GeoJsonLayerContextValue {
  geoJsonLayers: GeoJsonLayer[];
  setGeoJsonLayers: Dispatch<SetStateAction<GeoJsonLayer[]>>;
  selectedGeoJsonFeature: any | null;
  setSelectedGeoJsonFeature: (feature: any | null) => void;
}

const GeoJsonLayerContext = createContext<GeoJsonLayerContextValue | null>(null);

export function GeoJsonLayerProvider({ children }: { children: ReactNode }) {
  const [geoJsonLayers, setGeoJsonLayers] = useState<GeoJsonLayer[]>([]);
  const [selectedGeoJsonFeature, setSelectedGeoJsonFeature] = useState<any | null>(null);

  const value = useMemo(() => ({
    geoJsonLayers,
    setGeoJsonLayers,
    selectedGeoJsonFeature,
    setSelectedGeoJsonFeature,
  }), [geoJsonLayers, selectedGeoJsonFeature]);

  return (
    <GeoJsonLayerContext.Provider value={value}>
      {children}
    </GeoJsonLayerContext.Provider>
  );
}

export function useGeoJsonLayers() {
  const context = useContext(GeoJsonLayerContext);
  if (!context) {
    throw new Error('useGeoJsonLayers must be used within a GeoJsonLayerProvider');
  }
  return context;
}
