import React from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

interface RequestNoticeProps {
  message: string | null;
  severity: 'success' | 'info' | 'error';
  onClose: () => void;
  // Gone by itself after this long; otherwise it stays until closed
  autoHideMs?: number;
  horizontal: 'center' | 'right';
  // With the request line in the bottom bar (a phone on its side), above that instead of below
  atBottom?: boolean;
}

// What the request line has to say, right by it: on a big screen a corner of the window is far from
// where the eye is after using the line
const RequestNotice: React.FC<RequestNoticeProps> = ({ message, severity, onClose, autoHideMs, horizontal, atBottom = false }) => (
  <Snackbar
    open={!!message}
    autoHideDuration={autoHideMs}
    onClose={(_, reason) => {
      if (reason !== 'clickaway') onClose();
    }}
    anchorOrigin={{ vertical: atBottom ? 'bottom' : 'top', horizontal }}
    // Past the menu and the request line, or the bottom bar
    sx={{ '&.MuiSnackbar-root': atBottom ? { bottom: 'calc(var(--safe-bottom) + 64px)' } : { top: 'calc(var(--safe-top) + 108px)' } }}
  >
    <Alert severity={severity} variant="filled" onClose={autoHideMs ? undefined : onClose} sx={{ maxWidth: 560 }}>
      {message}
    </Alert>
  </Snackbar>
);

export default RequestNotice;
