import Sidebar from './Sidebar';
import TopMenu from './TopMenu';
import React, { useState } from 'react';
import Grid from '@mui/material/Grid';
import OpenLayersMap from './Map';


function App() {

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [boundingBox, setBoundingBox] = useState<[number, number, number, number]>([0, 0, 0, 0]);

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
      <button onClick={() => setBoundingBox([-180, -90, 180, 90])}>Reset Bounding Box</button>
      <Grid container spacing={0}>
      <Grid item xs={12}><TopMenu onMenuClick={handleMenuClick} /></Grid>
      <Grid item xs={12} md={5}><Sidebar open={sidebarOpen} onClose={handleSidebarClose} boundingBox={boundingBox} setBoundingBox={setBoundingBox}/></Grid>
      <Grid item xs={12} md={7}><OpenLayersMap zoomLevel={10} boundingBox={boundingBox} onUpdateBoundingBox={handleUpdateBoundingBox} /></Grid>
      </Grid>
    </div>
  );
}

export default App;
