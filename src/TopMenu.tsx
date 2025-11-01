import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';

interface TopMenuProps {
  onMenuClick: () => void;
}

const TopMenu: React.FC<TopMenuProps> = ({ onMenuClick }) => {
  return (
    <AppBar position="static" >
      <Toolbar>
        <IconButton
          size="large"
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2 }}
          onClick={onMenuClick}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          OGC API Browser
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

export default TopMenu;
