import React, { useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Box } from '@mui/material';
import ApiIcon from '@mui/icons-material/Api';
import CloseIcon from '@mui/icons-material/Close';

interface SwaggerUIViewerProps {
  serviceDescUrl?: string | null;
  serviceName?: string;
}

const SwaggerUIViewer: React.FC<SwaggerUIViewerProps> = ({ serviceDescUrl, serviceName }) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  // If no service description URL is available, don't render the button
  if (!serviceDescUrl) {
    return null;
  }

  return (
    <>
      <Button
        variant="outlined"
        color="primary"
        startIcon={<ApiIcon />}
        onClick={handleOpen}
        sx={{ mt: 1, mr: 1 }}
        size="small"
      >
        View API Docs
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>API Documentation{serviceName ? ` - ${serviceName}` : ''}</span>
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleClose}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, height: 'calc(100% - 64px)' }}>
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <SwaggerUI url={serviceDescUrl} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SwaggerUIViewer;
