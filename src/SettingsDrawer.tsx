import React, { useState } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Button from '@mui/material/Button';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';

import { CustomService } from './types/CustomService';
import { ServiceType } from './types/ServiceType';
import { SERVICE_TYPE_CONFIG, SERVICE_TYPE_ORDER } from './config/serviceTypeConfig';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
export type { CustomService };

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  themeMode: 'light' | 'dark' | 'system';
  onThemeModeChange: (mode: 'light' | 'dark' | 'system') => void;
  customServices: CustomService[];
  onAddService: (service: CustomService) => void;
  onUpdateService: (service: CustomService) => void;
  onRemoveService: (id: string) => void;
  onServiceSelect: (url: string) => void;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ 
  open, 
  onClose, 
  themeMode, 
  onThemeModeChange,
  customServices,
  onAddService,
  onUpdateService,
  onRemoveService,
  onServiceSelect
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [serviceUrl, setServiceUrl] = useState('');
  const [serviceUsername, setServiceUsername] = useState('');
  const [servicePassword, setServicePassword] = useState('');
  const [serviceApiKey, setServiceApiKey] = useState('');
  const [serviceApiKeyParam, setServiceApiKeyParam] = useState('api-key');
  const [serviceBearerToken, setServiceBearerToken] = useState('');
  const [serviceCustomAuthHeader, setServiceCustomAuthHeader] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType | ''>('');
  const [authMethod, setAuthMethod] = useState<'none' | 'basic' | 'apikey' | 'bearer' | 'custom'>('none');
  const [editingService, setEditingService] = useState<CustomService | null>(null);

  const handleModeClick = (mode: 'light' | 'dark' | 'system') => {
    onThemeModeChange(mode);
  };

  const handleOpenDialog = () => {
    setEditingService(null);
    setServiceName('');
    setServiceUrl('');
    setServiceType('');
    setServiceUsername('');
    setServicePassword('');
    setServiceApiKey('');
    setServiceApiKeyParam('api-key');
    setServiceBearerToken('');
    setServiceCustomAuthHeader('');
    setAuthMethod('none');
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (service: CustomService) => {
    setEditingService(service);
    setServiceName(service.name);
    setServiceUrl(service.url);
    setServiceType(service.type || '');
    setServiceUsername(service.username || '');
    setServicePassword(service.password || '');
    setServiceApiKey(service.apiKey || '');
    setServiceApiKeyParam(service.apiKeyParam || 'api-key');
    setServiceBearerToken(service.bearerToken || '');
    setServiceCustomAuthHeader(service.customAuthHeader || '');

    // Determine auth method based on what's set
    if (service.customAuthHeader) {
      setAuthMethod('custom');
    } else if (service.bearerToken) {
      setAuthMethod('bearer');
    } else if (service.apiKey) {
      setAuthMethod('apikey');
    } else if (service.username) {
      setAuthMethod('basic');
    } else {
      setAuthMethod('none');
    }
    
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setServiceName('');
    setServiceUrl('');
    setServiceType('');
    setServiceUsername('');
    setServicePassword('');
    setServiceApiKey('');
    setServiceApiKeyParam('api-key');
    setServiceBearerToken('');
    setServiceCustomAuthHeader('');
    setAuthMethod('none');
    setEditingService(null);
  };

  const handleSaveService = () => {
    if (serviceName.trim() && serviceUrl.trim()) {
      if (editingService) {
        // Update existing service
        const updatedService: CustomService = {
          ...editingService,
          name: serviceName.trim(),
          url: serviceUrl.trim(),
          type: serviceType || undefined,
          username: authMethod === 'basic' ? (serviceUsername.trim() || undefined) : undefined,
          password: authMethod === 'basic' ? (servicePassword.trim() || undefined) : undefined,
          apiKey: authMethod === 'apikey' ? (serviceApiKey.trim() || undefined) : undefined,
          apiKeyParam: authMethod === 'apikey' ? (serviceApiKeyParam.trim() || 'api-key') : undefined,
          bearerToken: authMethod === 'bearer' ? (serviceBearerToken.trim() || undefined) : undefined,
          customAuthHeader: authMethod === 'custom' ? (serviceCustomAuthHeader.trim() || undefined) : undefined
        };
        onUpdateService(updatedService);
      } else {
        // Add new service
        const newService: CustomService = {
          id: Date.now().toString(),
          name: serviceName.trim(),
          url: serviceUrl.trim(),
          type: serviceType || undefined,
          username: authMethod === 'basic' ? (serviceUsername.trim() || undefined) : undefined,
          password: authMethod === 'basic' ? (servicePassword.trim() || undefined) : undefined,
          apiKey: authMethod === 'apikey' ? (serviceApiKey.trim() || undefined) : undefined,
          apiKeyParam: authMethod === 'apikey' ? (serviceApiKeyParam.trim() || 'api-key') : undefined,
          bearerToken: authMethod === 'bearer' ? (serviceBearerToken.trim() || undefined) : undefined,
          customAuthHeader: authMethod === 'custom' ? (serviceCustomAuthHeader.trim() || undefined) : undefined
        };
        onAddService(newService);
        // Auto-select the newly added service
        onServiceSelect(newService.url);
      }
      handleCloseDialog();
    }
  };

  const modes = [
    { value: 'light', label: 'Light', icon: <LightModeIcon /> },
    { value: 'system', label: 'System', icon: <SettingsBrightnessIcon /> },
    { value: 'dark', label: 'Dark', icon: <DarkModeIcon /> },
  ];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
    >
      <Box
        sx={{
          width: 300,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        role="presentation"
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
          }}
        >
          <Typography variant="h6">Settings</Typography>
          <IconButton
            edge="end"
            onClick={onClose}
            aria-label="close settings"
          >
            <CloseIcon />
          </IconButton>
        </Box>
        
        <Divider />
        
        {/* Content */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, letterSpacing: '0.5px' }}>
            MODE
          </Typography>
          <ToggleButtonGroup
            value={themeMode}
            exclusive
            onChange={(_event, newMode) => {
              if (newMode !== null) {
                handleModeClick(newMode as 'light' | 'dark' | 'system');
              }
            }}
            fullWidth
            size="small"
            color="primary"
          >
            {modes.map((mode) => (
              <ToggleButton
                key={mode.value}
                value={mode.value}
                sx={{
                  textTransform: 'none',
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                {mode.icon}
                <Typography variant="caption">{mode.label}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Divider sx={{ my: 3 }} />

          {/* Services Section */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, letterSpacing: '0.5px' }}>
              SERVICES
            </Typography>
            <IconButton
              size="small"
              color="primary"
              onClick={handleOpenDialog}
              aria-label="add service"
            >
              <AddIcon />
            </IconButton>
          </Box>

          {customServices.length > 0 ? (
            <List dense sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
              {customServices.map((service) => (
                <ListItem
                  key={service.id}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        edge="end"
                        aria-label="edit"
                        size="small"
                        onClick={() => handleOpenEditDialog(service)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        size="small"
                        onClick={() => onRemoveService(service.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={service.name}
                    secondary={service.url}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ 
                      variant: 'caption',
                      sx: { 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }
                    }}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No custom services added
            </Typography>
          )}
        </Box>
      </Box>

      {/* Add/Edit Service Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingService ? 'Edit Custom Service' : 'Add Custom Service'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Service Name"
            type="text"
            fullWidth
            variant="outlined"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Service URL"
            type="url"
            fullWidth
            variant="outlined"
            value={serviceUrl}
            onChange={(e) => setServiceUrl(e.target.value)}
            placeholder="https://example.com/api"
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="service-type-label">Service Type (optional)</InputLabel>
            <Select
              labelId="service-type-label"
              value={serviceType}
              label="Service Type (optional)"
              onChange={(e: SelectChangeEvent) => setServiceType(e.target.value as ServiceType | '')}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {SERVICE_TYPE_ORDER.map(type => {
                const config = SERVICE_TYPE_CONFIG[type];
                return (
                  <MenuItem key={type} value={type}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={config.abbreviation}
                        size="small"
                        sx={{
                          bgcolor: config.color,
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          height: 20,
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                      {type}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend">Authentication Method</FormLabel>
            <RadioGroup
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value as 'none' | 'basic' | 'apikey' | 'bearer' | 'custom')}
            >
              <FormControlLabel value="none" control={<Radio />} label="None" />
              <FormControlLabel value="basic" control={<Radio />} label="HTTP Basic Auth" />
              <FormControlLabel value="bearer" control={<Radio />} label="Bearer Token" />
              <FormControlLabel value="apikey" control={<Radio />} label="API Key (Query Parameter)" />
              <FormControlLabel value="custom" control={<Radio />} label="Custom Authorization Header" />
            </RadioGroup>
          </FormControl>

          {authMethod === 'basic' && (
            <>
              <TextField
                margin="dense"
                label="Username"
                type="text"
                fullWidth
                variant="outlined"
                value={serviceUsername}
                onChange={(e) => setServiceUsername(e.target.value)}
                placeholder="Enter username for HTTP Basic Auth"
                sx={{ mb: 2 }}
              />
              <TextField
                margin="dense"
                label="Password"
                type="password"
                fullWidth
                variant="outlined"
                value={servicePassword}
                onChange={(e) => setServicePassword(e.target.value)}
                placeholder="Enter password for HTTP Basic Auth"
              />
            </>
          )}
          
          {authMethod === 'bearer' && (
            <TextField
              margin="dense"
              label="Bearer Token"
              type="text"
              fullWidth
              variant="outlined"
              value={serviceBearerToken}
              onChange={(e) => setServiceBearerToken(e.target.value)}
              placeholder="Enter your Bearer token"
              helperText="The token will be sent in the Authorization header as 'Bearer <token>'"
            />
          )}
          
          {authMethod === 'apikey' && (
            <>
              <TextField
                margin="dense"
                label="API Key"
                type="text"
                fullWidth
                variant="outlined"
                value={serviceApiKey}
                onChange={(e) => setServiceApiKey(e.target.value)}
                placeholder="Enter your API key"
                sx={{ mb: 2 }}
              />
              <TextField
                margin="dense"
                label="Query Parameter Name"
                type="text"
                fullWidth
                variant="outlined"
                value={serviceApiKeyParam}
                onChange={(e) => setServiceApiKeyParam(e.target.value)}
                placeholder="api-key"
                helperText="The query parameter name (e.g., 'api-key', 'apikey', 'key')"
              />
            </>
          )}
          
          {authMethod === 'custom' && (
            <TextField
              margin="dense"
              label="Authorization Header Value"
              type="text"
              fullWidth
              variant="outlined"
              value={serviceCustomAuthHeader}
              onChange={(e) => setServiceCustomAuthHeader(e.target.value)}
              placeholder="Bearer token123 or any custom value"
              helperText="The complete value for the Authorization header (e.g., 'Bearer xyz', 'Token abc', 'Custom value')"
              multiline
              rows={2}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveService} 
            variant="contained"
            disabled={!serviceName.trim() || !serviceUrl.trim()}
          >
            {editingService ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
};

export default SettingsDrawer;
