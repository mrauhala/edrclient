import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import type { InputBaseComponentProps } from '@mui/material/InputBase';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha } from '@mui/material/styles';
import { useForkRef } from '@mui/material/utils';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useRequestUrl } from './contexts/RequestUrlContext';
import { isSendableUrl, shortUrl, urlTokens } from './query/requestUrl';

const FIELD_HEIGHT = 40;
const LINE_HEIGHT = 20;
const ROWS_WHILE_EDITING = 6;
const PLACEHOLDER = 'Select a collection and query, or paste a request URL';
// Where the text starts, past GET
const TEXT_LEFT = 48;

// Parameter names stand out, and the parts that aren't the request itself step back
const COLOURS_SX = {
  color: 'text.primary',
  '& .url-base, & .url-punctuation': { color: 'text.secondary' },
  '& .url-name': { color: 'primary.main' },
};

const ColouredUrl: React.FC<{ text: string }> = ({ text }) => (
  <>
    {urlTokens(text).map((token, index) => <span key={index} className={`url-${token.kind}`}>{token.text}</span>)}
  </>
);

interface UrlInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  editing: boolean;
  hideText: boolean;
}

// A textarea can't colour its text. So its own is transparent, keeping the caret and selection, over a
// coloured copy with the same box and the same wrapping. The copy sets the height, up to a limit, so
// that the field grows with its text. Neither shows a scrollbar, which would narrow only the one and
// so wrap them differently, but a wheel or the caret still scrolls it, and the copy follows. MUI's class
// for an input stays off the textarea, since merged with these styles it would override them.
const UrlInput = forwardRef<HTMLTextAreaElement, UrlInputProps>(({ editing, hideText, value, onScroll, type: _type, className: _inputClass, ...props }: UrlInputProps & { type?: string }, ref) => {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const handleRef = useForkRef(ref, textarea);
  const copy = useRef<HTMLDivElement>(null);
  const follow = () => {
    if (!copy.current || !textarea.current) return;
    copy.current.scrollTop = textarea.current.scrollTop;
    copy.current.scrollLeft = textarea.current.scrollLeft;
  };
  useLayoutEffect(follow, [value, editing]);
  // Back to reading from the start
  useEffect(() => {
    if (editing || !textarea.current) return;
    textarea.current.scrollTop = 0;
    textarea.current.scrollLeft = 0;
    follow();
  }, [editing]);

  const box = {
    gridArea: '1 / 1',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    m: 0,
    px: 0,
    py: `${(FIELD_HEIGHT - LINE_HEIGHT) / 2}px`,
    border: 0,
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: `${LINE_HEIGHT}px`,
    letterSpacing: 'normal',
    // As index.css has it for the textarea, which iOS would otherwise zoom in on
    '@media (pointer: coarse)': { fontSize: '16px' },
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
    ...(editing ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } : { whiteSpace: 'nowrap', overflowWrap: 'normal' }),
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', flex: 1, minWidth: 0 }}>
      <Box
        ref={copy}
        aria-hidden
        data-url-copy
        sx={{
          ...box,
          ...COLOURS_SX,
          overflow: 'hidden',
          maxHeight: ROWS_WHILE_EDITING * LINE_HEIGHT + FIELD_HEIGHT - LINE_HEIGHT,
          visibility: hideText ? 'hidden' : 'visible',
        }}
      >
        <ColouredUrl text={String(value ?? '')} />
        {/* Keeps a trailing space as tall in the copy as in the textarea. Only while wrapping: on one line it would start a second */}
        {editing && '\u200b'}
      </Box>
      <Box
        component="textarea"
        ref={handleRef}
        {...props}
        // After the rest: MUI passes rows, undefined, which would leave the default of two
        rows={1}
        value={value}
        onScroll={(event: React.UIEvent<HTMLTextAreaElement>) => {
          follow();
          onScroll?.(event);
        }}
        sx={{
          ...box,
          height: '100%',
          display: 'block',
          resize: 'none',
          outline: 0,
          background: 'none',
          color: 'transparent',
          caretColor: theme => theme.palette.text.primary,
          overflow: editing ? 'auto' : 'hidden',
          '&::placeholder': { color: 'text.secondary', opacity: hideText ? 0 : 1 },
          '&::selection': { color: 'transparent', backgroundColor: theme => alpha(theme.palette.primary.main, 0.35) },
        }}
      />
    </Box>
  );
});
UrlInput.displayName = 'UrlInput';

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
      // Sending takes the app there too, so there's nothing left to do on leaving the field
      textBeforeEditing.current = requestUrl;
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
          '& .MuiFormHelperText-root': { m: 0, px: 1, py: 0.25 },
        }}
        slotProps={{
          htmlInput: {
            'aria-label': 'Request URL',
            spellCheck: false,
            autoCapitalize: 'off',
            autoCorrect: 'off',
            editing,
            hideText: showShort,
          },
          input: {
            inputComponent: UrlInput as unknown as React.ElementType<InputBaseComponentProps>,
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
          data-url-short
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: TEXT_LEFT,
            right: isEdited ? FIELD_HEIGHT : 8,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
            ...COLOURS_SX,
            ...(!requestUrl && { color: 'text.secondary' }),
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
            {requestUrl ? <ColouredUrl text={shortUrl(requestUrl)} /> : PLACEHOLDER}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default RequestUrlField;
