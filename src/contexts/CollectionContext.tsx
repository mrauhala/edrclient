import React, { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import { Collection } from '../DataRetrievalAPI';

interface CollectionContextValue {
  collections: Collection[];
  setCollections: React.Dispatch<React.SetStateAction<Collection[]>>;
  selectedCollection: Collection | null;
  setSelectedCollection: (collection: Collection | null) => void;
  selectedCollectionExtents: [number, number, number, number][] | null;
  setSelectedCollectionExtents: (extents: [number, number, number, number][] | null) => void;
  locationFeatures: any[] | null;
  setLocationFeatures: (features: any[] | null) => void;
  selectedFeature: any | null;
  setSelectedFeature: (feature: any | null) => void;
  collectionUrl: string;
  setCollectionUrl: (url: string) => void;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedCollectionExtents, setSelectedCollectionExtents] = useState<[number, number, number, number][] | null>(null);
  const [locationFeatures, setLocationFeatures] = useState<any[] | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
  const [collectionUrl, setCollectionUrl] = useState<string>('');

  const value = useMemo(() => ({
    collections,
    setCollections,
    selectedCollection,
    setSelectedCollection,
    selectedCollectionExtents,
    setSelectedCollectionExtents,
    locationFeatures,
    setLocationFeatures,
    selectedFeature,
    setSelectedFeature,
    collectionUrl,
    setCollectionUrl,
  }), [collections, selectedCollection, selectedCollectionExtents, locationFeatures, selectedFeature, collectionUrl]);

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error('useCollection must be used within a CollectionProvider');
  }
  return context;
}
