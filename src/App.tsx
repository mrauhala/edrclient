import Sidebar from './Sidebar';
import TopMenu from './TopMenu';
import { useState } from 'react';
import Grid from '@mui/material/Grid';
import OpenLayersMap from './Map';
import { Collection } from './DataRetrievalAPI';


function App() {

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [boundingBox, setBoundingBox] = useState<[number, number, number, number]>([-180, -90, 180, 90]);
  const [selectedCollectionExtents, setSelectedCollectionExtents] = useState<[number, number, number, number][] | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [locationFeatures, setLocationFeatures] = useState<any[] | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
  const [clickedCoords, setClickedCoords] = useState<[number, number] | null>(null);
  const [dataQuery, setDataQuery] = useState<string>('');

  const handleUpdateBoundingBox = (newBoundingBox: [number, number, number, number]) => {
    setBoundingBox(newBoundingBox);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  const handleFeatureSelect = (feature: any | null) => {
    setSelectedFeature(feature);
    
    // If a feature is selected and it has coordinates, update the bounding box to zoom to it
    if (feature && feature.geometry && feature.geometry.coordinates) {
      const coords = feature.geometry.coordinates;
      if (feature.geometry.type === 'Point') {
        const [lon, lat] = coords;
        // Create a small bounding box around the point for zooming
        const margin = 0.01; // Small margin around the point
        setBoundingBox([lon - margin, lat - margin, lon + margin, lat + margin]);
      }
    }
  };

  return (
    <div>
      <Grid container spacing={0}>
      <Grid item xs={12}><TopMenu /></Grid>
      <Grid item xs={12} md={5}><Sidebar open={sidebarOpen} onClose={handleSidebarClose} boundingBox={boundingBox} setBoundingBox={setBoundingBox} onCollectionExtentChange={setSelectedCollectionExtents} onLocationFeaturesChange={setLocationFeatures} onFeatureSelect={handleFeatureSelect} onSelectedCollectionChange={setSelectedCollection} onMapClick={setClickedCoords} onDataQueryChange={setDataQuery} clickedCoords={clickedCoords} locationFeatures={locationFeatures}/></Grid>
      <Grid item xs={12} md={7}><OpenLayersMap zoomLevel={2} boundingBox={boundingBox} selectedCollectionExtents={selectedCollectionExtents} selectedCollection={selectedCollection} locationFeatures={locationFeatures} selectedFeature={selectedFeature} onUpdateBoundingBox={handleUpdateBoundingBox} onFeatureSelect={handleFeatureSelect} clickedCoords={clickedCoords} dataQuery={dataQuery} onMapClick={setClickedCoords} /></Grid>
      </Grid>
    </div>
  );
}

export default App;
