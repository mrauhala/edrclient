import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RequestNotice from './RequestNotice';
import { curlCommand, requestLink } from './query/requestLink';
import { encodedUrl, isSendableUrl } from './query/requestUrl';
import type { AuthCredentials } from './types/api';

interface CopyMenuProps {
  url: string;
  auth?: AuthCredentials;
  // No room for words: one icon, with the link in its menu
  compact?: boolean;
  atBottom?: boolean;
}

const OUTLINED_SX = { height: 36, flexShrink: 0, px: 1.5, fontSize: 13, textTransform: 'none', whiteSpace: 'nowrap', borderColor: 'divider' };

// The request to take elsewhere: as a URL or a command, or shared as a link that reopens it here
const CopyMenu: React.FC<CopyMenuProps> = ({ url, auth, compact = false, atBottom = false }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [notice, setNotice] = useState<{ message: string; failed: boolean } | null>(null);
  const disabled = !isSendableUrl(url);

  const copy = (what: string, text: string) => {
    setAnchor(null);
    navigator.clipboard.writeText(text).then(
      () => setNotice({ message: `${what} copied`, failed: false }),
      () => setNotice({ message: `Couldn't copy the ${what.toLowerCase()}`, failed: true }),
    );
  };
  const copyLink = () => copy('Link', requestLink(url, window.location.href));

  return (
    <>
      {compact ? (
        <Tooltip title="Copy the request">
          {/* A disabled button gives a tooltip no events */}
          <Box component="span" sx={{ flexShrink: 0 }}>
            <IconButton color="primary" aria-label="Copy the request" aria-haspopup="menu" disabled={disabled} onClick={event => setAnchor(event.currentTarget)}>
              <ContentCopyIcon />
            </IconButton>
          </Box>
        </Tooltip>
      ) : (
        <>
          <Button
            variant="outlined"
            color="inherit"
            aria-haspopup="menu"
            disabled={disabled}
            endIcon={<ArrowDropDownIcon />}
            onClick={event => setAnchor(event.currentTarget)}
            sx={{ ...OUTLINED_SX, pr: 0.75, '& .MuiButton-endIcon': { ml: 0.25 } }}
          >
            Copy as
          </Button>
          {/* Not while saying it's done: the pointer's still here, and this would cover the message */}
          <Tooltip title={notice ? '' : 'Copy a link that reopens this request'}>
            <Box component="span" sx={{ flexShrink: 0 }}>
              <Button variant="outlined" color="inherit" disabled={disabled} onClick={copyLink} sx={OUTLINED_SX}>
                Share
              </Button>
            </Box>
          </Tooltip>
        </>
      )}
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => copy('URL', encodedUrl(url))}>URL</MenuItem>
        <MenuItem onClick={() => copy('curl command', curlCommand(url, auth))}>curl command</MenuItem>
        {compact && <MenuItem onClick={copyLink}>Link to this request</MenuItem>}
      </Menu>
      <RequestNotice
        message={notice?.message ?? null}
        severity={notice?.failed ? 'error' : 'success'}
        onClose={() => setNotice(null)}
        autoHideMs={2500}
        horizontal="right"
        atBottom={atBottom}
      />
    </>
  );
};

export default CopyMenu;
