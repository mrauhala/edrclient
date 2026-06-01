import { createContext, useContext, useState, useMemo, type ReactNode, type Dispatch, type SetStateAction } from 'react';

export interface MapsLayer {
  // Stable identity: collectionId + styleId + sourceType is unique per layer instance.
  id: string;
  collectionId: string;
  styleId?: string;
  title: string;
  visible: boolean;
  opacity: number;
  zIndex?: number;
  sourceType: 'tiles' | 'dynamic';
  // Style id to send as a `styles=` query param — set only as a fallback when the server exposes
  // no style-specific /map link (otherwise the style is applied via path routing, not a param).
  styleQuery?: string;
  // For sourceType === 'tiles': tile URL template with {z}/{y}/{x} placeholders.
  tileUrl?: string;
  // For sourceType === 'dynamic': base GET /map endpoint to which bbox/width/height get appended.
  dynamicEndpoint?: string;
  format: string;
  // OGC API Maps `datetime` parameter — instant ("2025-01-01T00:00:00Z") or interval ("a/b").
  // Frozen onto the layer at "Add" time so the layer doesn't drift when the user moves the
  // sidebar TimeControl elsewhere afterwards.
  datetime?: string;
  // Vertical dimension (OGC API Maps `elevation`) and additional (UAD) dimensions — frozen at
  // Add time alongside datetime, for the same reason.
  elevation?: string;
  dimensions?: Record<string, string>;
  attribution?: string;
  apiKey?: string;
  apiKeyParam?: string;
}

interface MapsLayerContextValue {
  mapsLayers: MapsLayer[];
  setMapsLayers: Dispatch<SetStateAction<MapsLayer[]>>;
}

const MapsLayerContext = createContext<MapsLayerContextValue | null>(null);

export function MapsLayerProvider({ children }: { children: ReactNode }) {
  const [mapsLayers, setMapsLayers] = useState<MapsLayer[]>([]);

  const value = useMemo(() => ({
    mapsLayers,
    setMapsLayers,
  }), [mapsLayers]);

  return (
    <MapsLayerContext.Provider value={value}>
      {children}
    </MapsLayerContext.Provider>
  );
}

export function useMapsLayers() {
  const context = useContext(MapsLayerContext);
  if (!context) {
    throw new Error('useMapsLayers must be used within a MapsLayerProvider');
  }
  return context;
}
