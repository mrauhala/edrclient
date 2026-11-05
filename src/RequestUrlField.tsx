import React, { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useRequestUrl } from './contexts/RequestUrlContext';
import { isSendableUrl, shortUrl } from './query/requestUrl';

const FIELD_HEIGHT = 40;
const ROWS_WHILE_EDITING = 6;
const PLACEHOLDER = 'Select a collection and query, or paste a request URL';
// Where the text starts, past GET
const TEXT_LEFT = 48;

interface RequestUrlFieldProps {
  onSend: () => void;
  // Editing is done: on Enter, or on leaving the field with something changed
  onCommit?: (url: string) => void;
  // In a bar at the bottom of the window it opens upwards
  expandUp?: boolean;
  // On a phone one line holds little more than the host, so at rest it shows the part that matters
  compact?: boolean;
}

// The request as it will be sent, for reading and editing. One line at rest; while editing it opens
// over what's below, so the panes keep their size and a point clicked on the map lands where aimed.
const RequestUrlField: React.FC<RequestUrlFieldProps> = ({ onSend, onCommit, expandUp = false, compact = false }) => {
  const { requestUrl, isEdited, editUrl, discardEdits } = useRequestUrl();
  const touch = useMediaQuery('(pointer: coarse)', { noSsr: true });
  const [editing, setEditing] = useState(false);
  const textBeforeEditing = useRef('');
  const undoing = useRef(false);
  const refused = !!requestUrl.trim() && !isSendableUrl(requestUrl);
  const showShort = compact && !editing;

  const commit = () => {
    if (requestUrl === textBeforeEditing.current) return;
    textBeforeEditing.current = requestUrl;
    onCommit?.(requestUrl);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement | HTMLDivElement>) => {
    const field = event.target as HTMLElement;
    if (event.key === 'Escape') {
      undoing.current = true;
      editUrl(textBeforeEditing.current);
      field.blur();
    } else if (event.key === 'Enter') {
      // Always the one line, whatever wrapping shows
      event.preventDefault();
      if (!isSendableUrl(requestUrl)) return;
      commit();
      onSend();
      // Puts the keyboard away, so the response can be seen
      if (touch) field.blur();
    }
  };

  return (
    <Box sx={{ position: 'relative', flex: 1, minWidth: 0, height: FIELD_HEIGHT }}>
      <TextField
        fullWidth
        multiline
        size="small"
        maxRows={editing ? ROWS_WHILE_EDITING : 1}
        value={requestUrl}
        placeholder={PLACEHOLDER}
        error={refused}
        helperText={refused ? 'A request URL starts with http:// or https://' : undefined}
        // A pasted URL can come with line breaks
        onChange={event => editUrl(event.target.value.replace(/[\r\n]+/g, ''))}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          textBeforeEditing.current = requestUrl;
          setEditing(true);
        }}
        onBlur={event => {
          setEditing(false);
          if (undoing.current) undoing.current = false;
          else commit();
          // Back to reading from the start
          event.target.scrollLeft = 0;
        }}
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          ...(expandUp ? { bottom: 0 } : { top: 0 }),
          bgcolor: 'background.paper',
          borderRadius: 1,
          // Everything lines up with the text's first line, at rest and while editing
          '& .MuiInputBase-root': { alignItems: 'flex-start', py: 0, pr: 0.5 },
          '& .MuiInputAdornment-root': { height: FIELD_HEIGHT, maxHeight: FIELD_HEIGHT, flexShrink: 0 },
          '& textarea': {
            py: '10px',
            lineHeight: '20px',
            ...(editing
              ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }
              : { whiteSpace: 'nowrap', overflow: 'hidden !important' }),
            ...(showShort && { color: 'transparent', '&::placeholder': { opacity: 0 } }),
          },
          '& .MuiFormHelperText-root': { m: 0, px: 1, py: 0.25 },
        }}
        slotProps={{
          htmlInput: {
            'aria-label': 'Request URL',
            spellCheck: false,
            autoCapitalize: 'off',
            autoCorrect: 'off',
            sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
          },
          input: {
            startAdornment: (
              <InputAdornment position="start" disableTypography sx={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 500, color: 'primary.main', mr: 1 }}>
                GET
              </InputAdornment>
            ),
            endAdornment: isEdited ? (
              <InputAdornment position="end">
                <Tooltip title="Discard your edits, back to what the form built">
                  <IconButton
                    size="small"
                    edge="end"
                    aria-label="Discard URL edits"
                    // Stays in the field if it's being edited
                    onMouseDown={event => event.preventDefault()}
                    onClick={discardEdits}
                  >
                    <RestartAltIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
      {/* Over the field, which still takes the tap */}
      {showShort && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: TEXT_LEFT,
            right: isEdited ? FIELD_HEIGHT : 8,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
            color: requestUrl ? 'text.primary' : 'text.secondary',
          }}
        >
          <Box
            sx={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: '17px',
            }}
          >
            {requestUrl ? shortUrl(requestUrl) : PLACEHOLDER}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default RequestUrlField;
