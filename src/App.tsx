import Sidebar from './Sidebar';
import TopMenu from './TopMenu';
import { useState } from 'react';
import Grid from '@mui/material/Grid';
import OpenLayersMap from './Map';


function App() {

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [boundingBox, setBoundingBox] = useState<[number, number, number, number]>([-180, -90, 180, 90]);
  const [selectedCollectionExtents, setSelectedCollectionExtents] = useState<[number, number, number, number][] | null>(null);

  const handleUpdateBoundingBox = (newBoundingBox: [number, number, number, number]) => {
    setBoundingBox(newBoundingBox);
  };

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  return (
    <div>
      <Grid container spacing={0}>
      <Grid item xs={12}><TopMenu onMenuClick={handleMenuClick} /></Grid>
      <Grid item xs={12} md={5}><Sidebar open={sidebarOpen} onClose={handleSidebarClose} boundingBox={boundingBox} setBoundingBox={setBoundingBox} onCollectionExtentChange={setSelectedCollectionExtents}/></Grid>
      <Grid item xs={12} md={7}><OpenLayersMap zoomLevel={2} boundingBox={boundingBox} selectedCollectionExtents={selectedCollectionExtents} onUpdateBoundingBox={handleUpdateBoundingBox} /></Grid>
      </Grid>
    </div>
  );
}

export default App;
