import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface ConformanceViewerProps {
  conformanceUrl: string | null;
  onClose: () => void;
}

const ConformanceViewer: React.FC<ConformanceViewerProps> = ({ conformanceUrl, onClose }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!!conformanceUrl);
  }, [conformanceUrl]);

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  const handleOpenInNewTab = () => {
    if (conformanceUrl) {
      window.open(conformanceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!conformanceUrl) {
    return null;
  }

  return (
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
          <span>Conformance Class Specification</span>
          <Box>
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleOpenInNewTab}
              aria-label="open in new tab"
              sx={{ mr: 1 }}
            >
              <OpenInNewIcon />
            </IconButton>
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleClose}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, height: 'calc(100% - 64px)' }}>
        <Box sx={{ height: '100%', width: '100%' }}>
          <iframe
            src={conformanceUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            title="Conformance Specification"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleOpenInNewTab} startIcon={<OpenInNewIcon />}>
          Open in New Tab
        </Button>
        <Button onClick={handleClose} color="primary" variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConformanceViewer;
