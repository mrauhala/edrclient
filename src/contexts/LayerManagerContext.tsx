import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react';
import type { GeoJsonLayer } from './GeoJsonLayerContext';

interface LayerManagerContextValue {
  allMapLayers: GeoJsonLayer[];
  setAllMapLayers: (layers: GeoJsonLayer[]) => void;
  handleLayerManagerChange: (layers: GeoJsonLayer[]) => void;
  setHandleLayerManagerChange: (handler: (layers: GeoJsonLayer[]) => void) => void;
}

const LayerManagerContext = createContext<LayerManagerContextValue | null>(null);

export function LayerManagerProvider({ children }: { children: ReactNode }) {
  const [allMapLayers, setAllMapLayers] = useState<GeoJsonLayer[]>([]);
  const [handler, setHandler] = useState<{ fn: (layers: GeoJsonLayer[]) => void }>({ fn: () => {} });

  const setHandleLayerManagerChange = useCallback((fn: (layers: GeoJsonLayer[]) => void) => {
    setHandler({ fn });
  }, []);

  const handleLayerManagerChange = useCallback((layers: GeoJsonLayer[]) => {
    handler.fn(layers);
  }, [handler]);

  const value = useMemo(() => ({
    allMapLayers,
    setAllMapLayers,
    handleLayerManagerChange,
    setHandleLayerManagerChange,
  }), [allMapLayers, handleLayerManagerChange, setHandleLayerManagerChange]);

  return (
    <LayerManagerContext.Provider value={value}>
      {children}
    </LayerManagerContext.Provider>
  );
}

export function useLayerManager() {
  const context = useContext(LayerManagerContext);
  if (!context) {
    throw new Error('useLayerManager must be used within a LayerManagerProvider');
  }
  return context;
}
