import React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Tooltip from '@mui/material/Tooltip';
import { getOverlayAlpha, lighten, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CommandPalette from './CommandPalette';
import LayerManager from './LayerManager';
import ValidationPopover from './ValidationPopover';
import { useApi } from './contexts/ApiContext';
import { useService } from './contexts/ServiceContext';
import { useCollection } from './contexts/CollectionContext';
import { usePanes } from './contexts/PanesContext';
import PaneToggles from './PaneToggles';
import systemServices from './config/services.json';
import { ServiceDefinition } from './types/ServiceType';

const typedSystemServices: ServiceDefinition[] = systemServices as ServiceDefinition[];

// MUI's default for an AppBar
const BAR_ELEVATION = 4;

// The bar's own colours, whatever the theme's mode: it's blue in the light one
const paneTogglesOnBarSx = {
  mr: 2,
  '& .MuiToggleButton-root': {
    py: 0.25,
    px: 0.75,
    color: 'rgba(255,255,255,0.6)',
    borderColor: 'rgba(255,255,255,0.3)',
    '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)' },
    '&.Mui-selected, &.Mui-selected:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.24)' },
  },
};

interface TopMenuProps {
  onSettingsClick: () => void;
}

const TopMenu: React.FC<TopMenuProps> = ({ onSettingsClick }) => {
  const theme = useTheme();
  const showBreadcrumb = useMediaQuery(theme.breakpoints.up('md'));
  const { customServices } = useService();
  const { apiUrl: activeServiceUrl, title: landingPageTitle } = useApi();
  const { selectedCollection } = useCollection();
  const { isOpen, isMobile, togglePane } = usePanes();

  const systemService = typedSystemServices.find(s => s.url === activeServiceUrl);
  const customService = customServices.find(s => s.url === activeServiceUrl);
  const serviceName = systemService?.label ?? customService?.name ?? landingPageTitle;
  const collectionName = selectedCollection?.title ?? selectedCollection?.id;

  return (
    <>
    {/* Under the status bar iOS 26 blurs the page's top edge, so the bar's top looked blurred. It fills the
        status bar with a colour instead when a fixed, opaque, full-width box covers that edge, taking the
        box's background-color. So the bar is fixed, and in dark mode its elevation overlay (a background
        image) is part of that colour. The padding keeps its content clear of the notch and status bar */}
    <AppBar
      position="fixed"
      elevation={BAR_ELEVATION}
      sx={{
        pt: 'var(--safe-top)',
        pl: 'var(--safe-left)',
        pr: 'var(--safe-right)',
        ...(theme.palette.mode === 'dark' && {
          backgroundColor: lighten(theme.palette.background.paper, getOverlayAlpha(BAR_ELEVATION)),
          backgroundImage: 'none',
        }),
      }}
    >
      <Toolbar variant="dense">
        {isMobile ? (
          <IconButton
            size="small"
            edge="start"
            color="inherit"
            aria-label="Side panel"
            aria-controls="sidebar"
            aria-expanded={isOpen.request}
            sx={{ mr: 2 }}
            onClick={() => togglePane('request')}
          >
            <MenuIcon />
          </IconButton>
        ) : (
          <PaneToggles sx={paneTogglesOnBarSx} />
        )}
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
        <CommandPalette />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
          <ValidationPopover />
          <LayerManager />
          <Tooltip title="Settings">
            <IconButton
              size="small"
              edge="end"
              color="inherit"
              aria-label="open settings"
              onClick={onSettingsClick}
            >
            <SettingsIcon />
          </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
    {/* Holds the fixed bar's place in the layout */}
    <Box aria-hidden sx={{ flexShrink: 0, pt: 'var(--safe-top)' }}>
      <Toolbar variant="dense" />
    </Box>
    </>
  );
};

export default TopMenu;
