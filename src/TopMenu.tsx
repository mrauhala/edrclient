import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import Tooltip from '@mui/material/Tooltip';
import LayerManager from './LayerManager';

interface TopMenuProps {
  onMenuClick: () => void;
  onSettingsClick: () => void;
}

const TopMenu: React.FC<TopMenuProps> = ({ onMenuClick, onSettingsClick }) => {
  return (
    <AppBar position="static" >
      <Toolbar variant="dense">
        <IconButton
          size="small"
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2 }}
          onClick={onMenuClick}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontSize: '1.1rem' }}>
          OGC API Browser
        </Typography>
        <LayerManager />
        <Tooltip title="Settings">
          <IconButton
            size="small"
            edge="end"
            color="inherit"
            aria-label="open settings"
            onClick={onSettingsClick}
            sx={{ ml: 1 }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};

export default TopMenu;
