import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import { Collection } from '../DataRetrievalAPI';
import { LicenseInfo } from '../CollectionInfo';

interface CollectionContextValue {
  selectedCollection: Collection | null;
  setSelectedCollection: (collection: Collection | null) => void;
  selectedCollectionExtents: [number, number, number, number][] | null;
  setSelectedCollectionExtents: (extents: [number, number, number, number][] | null) => void;
  locationFeatures: any[] | null;
  setLocationFeatures: (features: any[] | null) => void;
  selectedFeature: any | null;
  setSelectedFeature: (feature: any | null) => void;
  landingPageLicense: LicenseInfo | null;
  setLandingPageLicense: (license: LicenseInfo | null) => void;
  collectionUrl: string;
  setCollectionUrl: (url: string) => void;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedCollectionExtents, setSelectedCollectionExtents] = useState<[number, number, number, number][] | null>(null);
  const [locationFeatures, setLocationFeatures] = useState<any[] | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
  const [landingPageLicense, setLandingPageLicense] = useState<LicenseInfo | null>(null);
  const [collectionUrl, setCollectionUrl] = useState<string>('');

  const value = useMemo(() => ({
    selectedCollection,
    setSelectedCollection,
    selectedCollectionExtents,
    setSelectedCollectionExtents,
    locationFeatures,
    setLocationFeatures,
    selectedFeature,
    setSelectedFeature,
    landingPageLicense,
    setLandingPageLicense,
    collectionUrl,
    setCollectionUrl,
  }), [selectedCollection, selectedCollectionExtents, locationFeatures, selectedFeature, landingPageLicense, collectionUrl]);

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
