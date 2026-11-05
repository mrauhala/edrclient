import React, { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { curlCommand, requestLink } from './query/requestLink';
import { encodedUrl, isSendableUrl } from './query/requestUrl';
import type { AuthCredentials } from './types/api';

interface CopyMenuProps {
  url: string;
  auth?: AuthCredentials;
}

// The request to take elsewhere: as a URL, a command, or a link that reopens it here
const CopyMenu: React.FC<CopyMenuProps> = ({ url, auth }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const copy = (what: string, text: string) => {
    setAnchor(null);
    navigator.clipboard.writeText(text).then(
      () => setMessage(`${what} copied`),
      () => setMessage(`Couldn't copy the ${what.toLowerCase()}`),
    );
  };

  return (
    <>
      <Tooltip title="Copy the request">
        {/* A disabled button gives a tooltip no events */}
        <Box component="span" sx={{ flexShrink: 0 }}>
          <IconButton
            color="primary"
            aria-label="Copy the request"
            aria-haspopup="menu"
            disabled={!isSendableUrl(url)}
            onClick={event => setAnchor(event.currentTarget)}
          >
            <ContentCopyIcon />
          </IconButton>
        </Box>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => copy('URL', encodedUrl(url))}>URL</MenuItem>
        <MenuItem onClick={() => copy('curl command', curlCommand(url, auth))}>curl command</MenuItem>
        <MenuItem onClick={() => copy('Link', requestLink(url, window.location.href))}>Link to this request</MenuItem>
      </Menu>
      <Snackbar open={!!message} autoHideDuration={2500} onClose={() => setMessage(null)} message={message} />
    </>
  );
};

export default CopyMenu;
