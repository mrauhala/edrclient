import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

const TopMenu = () => {
  return (
    <AppBar position="static" >
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            OGC API Browser
          </Typography>

      </Toolbar>
    </AppBar>
  );
};

export default TopMenu;
