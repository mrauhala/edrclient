import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import LayerManager from './LayerManager';
import ValidationPopover from './ValidationPopover';
import { useService } from './contexts/ServiceContext';
import { useCollection } from './contexts/CollectionContext';
import systemServices from './config/services.json';
import { ServiceDefinition } from './types/ServiceType';

const typedSystemServices: ServiceDefinition[] = systemServices as ServiceDefinition[];

interface TopMenuProps {
  onMenuClick: () => void;
  onSettingsClick: () => void;
}

const TopMenu: React.FC<TopMenuProps> = ({ onMenuClick, onSettingsClick }) => {
  const theme = useTheme();
  const showBreadcrumb = useMediaQuery(theme.breakpoints.up('md'));
  const { activeServiceUrl, customServices, landingPageTitle } = useService();
  const { selectedCollection } = useCollection();

  const systemService = typedSystemServices.find(s => s.url === activeServiceUrl);
  const customService = customServices.find(s => s.url === activeServiceUrl);
  const serviceName = systemService?.label ?? customService?.name ?? landingPageTitle;
  const collectionName = selectedCollection?.title ?? selectedCollection?.id;

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
        <Typography variant="h6" component="div" sx={{ fontSize: '1.1rem', flexShrink: 0 }}>
          OGC API Browser
        </Typography>
        {showBreadcrumb && serviceName && (
          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />}
            sx={{
              ml: 2,
              flexGrow: 1,
              minWidth: 0,
              overflow: 'hidden',
              '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
              '& .MuiBreadcrumbs-li': { minWidth: 0 },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.85)',
                maxWidth: 250,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {serviceName}
            </Typography>
            {collectionName && (
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,1)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {collectionName}
              </Typography>
            )}
          </Breadcrumbs>
        )}
        {(!showBreadcrumb || !serviceName) && <div style={{ flexGrow: 1 }} />}
        <ValidationPopover />
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
