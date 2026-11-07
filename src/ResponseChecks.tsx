import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { alpha, darken, lighten, type SxProps, type Theme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { checksCount } from './responseTabs';
import type { ValidationError } from './types/api';

// A long list says little more, and every finding is flagged in Raw anyway
const MOST_SHOWN = 100;

const SEVERITY_ICON = {
  error: <ErrorOutlineIcon fontSize="inherit" color="error" aria-label="Error" />,
  warning: <WarningAmberIcon fontSize="inherit" color="warning" aria-label="Issue" />,
  info: <InfoOutlinedIcon fontSize="inherit" color="info" aria-label="Note" />,
  pass: <CheckIcon fontSize="inherit" color="success" aria-label="Passed" />,
};
const WORST_FIRST = ['error', 'warning', 'info', 'pass'] as const;
// A finding about the data, and its line in Raw if it's about something there
type DataNote = { message: string; line?: number; severity?: ValidationError['severity']; source?: ValidationError['source'] };
const worstFirst = (notes: DataNote[]) => WORST_FIRST.flatMap(severity => notes.filter(note => (note.severity ?? 'info') === severity));

const Item = ({ icon, children, line, onClick }: { icon: ReactNode; children: ReactNode; line?: number; onClick?: () => void }) => (
  <Box component="li" sx={{ display: 'flex', gap: 1, alignItems: 'baseline', py: 0.25, fontSize: '0.8125rem', lineHeight: '18px' }}>
    <Box component="span" sx={{ flexShrink: 0, fontSize: '0.9rem', alignSelf: 'center', display: 'inline-flex' }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</Box>
    {line !== undefined && (
      <Link component="button" type="button" onClick={onClick} sx={{ flexShrink: 0, fontFamily: 'monospace', fontSize: '0.75rem' }}>
        line {line}
      </Link>
    )}
  </Box>
);

const Heading = ({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) => (
  <Typography component="h3" variant="caption" sx={[{ display: 'block', color: 'text.secondary', fontWeight: 500, mb: 0.5 }, ...(Array.isArray(sx) ? sx : [sx])]}>{children}</Typography>
);

// The tab's name, with how many of the worst kind of finding there are
export function ChecksTabLabel({ findings }: { findings: Pick<ValidationError, 'severity'>[] }) {
  const count = checksCount(findings);
  return (
    // One element, since a tab stacks what's in it
    <span>
      Checks
      {count && (
        <Box
          component="span"
          sx={theme => {
            const colour = theme.palette[count.color].main;
            return {
              ml: 0.75,
              px: 0.75,
              borderRadius: 2,
              fontSize: '0.72rem',
              backgroundColor: alpha(colour, 0.16),
              color: theme.palette.mode === 'dark' ? lighten(colour, 0.4) : darken(colour, 0.4),
            };
          }}
        >
          {count.label}
        </Box>
      )}
    </span>
  );
}

// A finding's message starts with its path, which is shown apart. One at the root has only the colon
export function findingMessage({ path, message }: ValidationError): string {
  const rest = path && message.startsWith(path) ? message.slice(path.length) : message;
  return rest.replace(/^:\s*/, '');
}

interface ResponseChecksProps {
  // The schema the response was checked against, if one applies
  schemaName: string | null;
  findings: ValidationError[];
  // Each line with findings on it, in the order Raw steps through them
  lines: { line: number; errors: ValidationError[] }[];
  onGoToLine: (lineIndex: number) => void;
  // What's worth knowing about the data itself, each where it is in Raw: what's wrong with it, and what's right
  dataNotes?: DataNote[];
  onGoToNote?: (line: number) => void;
  // The collection the response was checked against, if it was
  collectionId?: string | null;
}

// What was checked about this response, and what that found
export default function ResponseChecks({ schemaName, findings, lines, onGoToLine, dataNotes = [], onGoToNote, collectionId }: ResponseChecksProps) {
  if (!schemaName && findings.length === 0 && dataNotes.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
        No schema applies to this response, so there was nothing to check it against.
      </Typography>
    );
  }

  const count = checksCount(findings);
  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
      {(schemaName || findings.length > 0) && <Heading>The format</Heading>}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {schemaName && (
          <Item icon={count ? SEVERITY_ICON[count.color] : <CheckIcon fontSize="inherit" color="success" aria-label="Passed" />}>
            {schemaName} schema: {count ? count.label : '0 errors'}
          </Item>
        )}
        {findings.slice(0, MOST_SHOWN).map((finding, index) => {
          const lineIndex = lines.findIndex(entry => entry.errors.includes(finding));
          return (
            <Item
              key={index}
              icon={SEVERITY_ICON[finding.severity ?? 'error']}
              line={lineIndex >= 0 ? lines[lineIndex].line : undefined}
              onClick={() => onGoToLine(lineIndex)}
            >
              {finding.path && <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary', mr: 1 }}>{finding.path}</Box>}
              {findingMessage(finding)}
            </Item>
          );
        })}
      </Box>
      {findings.length > MOST_SHOWN && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1 }}>
          And {findings.length - MOST_SHOWN} more, flagged in Raw.
        </Typography>
      )}
      {[
        { heading: 'The data', notes: worstFirst(dataNotes.filter(note => note.source !== 'collection')) },
        { heading: `Against the collection${collectionId ? `: ${collectionId}` : ''}`, notes: worstFirst(dataNotes.filter(note => note.source === 'collection')) },
      ].filter(section => section.notes.length > 0).map((section, index) => (
        <Box key={section.heading}>
          <Heading sx={{ mt: index > 0 || schemaName || findings.length > 0 ? 2 : 0 }}>{section.heading}</Heading>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {section.notes.map(note => (
              <Item key={note.message} icon={SEVERITY_ICON[note.severity ?? 'info']} line={note.line} onClick={() => note.line !== undefined && onGoToNote?.(note.line)}>
                {note.message}
              </Item>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
