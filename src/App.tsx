import Sidebar from './Sidebar';
import TopMenu from './TopMenu';
import { useState } from 'react';
import Box from '@mui/material/Box';
import OpenLayersMap from './Map';
import { Collection } from './DataRetrievalAPI';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';


function App() {

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collectionUrl, setCollectionUrl] = useState<string>('');

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

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
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

  const handleCopyUrl = () => {
    if (collectionUrl) {
      navigator.clipboard.writeText(collectionUrl);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopMenu onMenuClick={handleSidebarToggle} />
      
      <Box 
        sx={{ 
          display: 'flex', 
          flex: 1, 
          overflow: 'hidden',
          paddingBottom: '56px', // Height of the bottom bar
        }}
      >
        <Sidebar 
          open={sidebarOpen} 
          onClose={handleSidebarToggle} 
          boundingBox={boundingBox} 
          setBoundingBox={setBoundingBox} 
          onCollectionExtentChange={setSelectedCollectionExtents} 
          onLocationFeaturesChange={setLocationFeatures} 
          onFeatureSelect={handleFeatureSelect} 
          onSelectedCollectionChange={setSelectedCollection} 
          onMapClick={setClickedCoords} 
          onDataQueryChange={setDataQuery} 
          clickedCoords={clickedCoords} 
          locationFeatures={locationFeatures}
          onCollectionUrlChange={setCollectionUrl}
        />
        
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <OpenLayersMap 
            zoomLevel={2} 
            boundingBox={boundingBox} 
            selectedCollectionExtents={selectedCollectionExtents} 
            selectedCollection={selectedCollection} 
            locationFeatures={locationFeatures} 
            selectedFeature={selectedFeature} 
            onUpdateBoundingBox={handleUpdateBoundingBox} 
            onFeatureSelect={handleFeatureSelect} 
            clickedCoords={clickedCoords} 
            dataQuery={dataQuery} 
            onMapClick={setClickedCoords} 
          />
        </Box>
      </Box>
      
      {/* Fixed Bottom Query Bar - Always Visible */}
      <Paper 
        elevation={8}
        sx={{ 
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          borderRadius: 0,
          borderTop: '1px solid rgba(0, 0, 0, 0.12)',
          height: '56px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1, gap: 1, height: '100%' }}>
          {collectionUrl ? (
            <>
              <TextField
                fullWidth
                size="small"
                value={collectionUrl}
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                }}
                variant="outlined"
              />
              <Tooltip title="Copy URL">
                <IconButton 
                  color="primary" 
                  onClick={handleCopyUrl}
                  sx={{ flexShrink: 0 }}
                >
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
              Select a collection and query to generate URL
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default App;
