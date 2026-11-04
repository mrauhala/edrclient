import React, { useId, useState } from 'react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import type { QueryIssue } from './query/types';
import type { IssueSummary } from './query/validateQuery';

const titleOf = (summary: IssueSummary) => summary.missing > 0 ? 'Query incomplete' : 'Query has problems';

const problemsOf = (issues: QueryIssue[]) => issues.filter(issue => issue.severity === 'missing' || issue.severity === 'error');

interface FetchButtonProps {
  issues: QueryIssue[];
  summary: IssueSummary;
  onFetch: () => void;
}

// What the query lacks, and sending it anyway: a server's error can be what's being tested
export const QueryProblems: React.FC<FetchButtonProps & { titleId?: string }> = ({ issues, summary, onFetch, titleId }) => (
  <Box sx={{ p: 2, maxWidth: 320 }}>
    <Typography id={titleId} variant="subtitle2">{titleOf(summary)}</Typography>
    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5, typography: 'body2' }}>
      {problemsOf(issues).map(issue => <li key={issue.id}>{issue.message}</li>)}
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
      <Button color="warning" onClick={onFetch}>Fetch anyway</Button>
    </Box>
  </Box>
);

// An incomplete query can still be sent (e.g. to see the server's error), but says so: in a tooltip
// for a mouse, one click from sending, and on the tap for a finger, which can't hover
const FetchButton: React.FC<FetchButtonProps> = ({ issues, summary, onFetch }) => {
  const touch = useMediaQuery('(pointer: coarse)', { noSsr: true });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const problems = problemsOf(issues);
  const tooltip = summary.needsAttention ? (
    <>
      {titleOf(summary)}, fetch anyway:
      {problems.slice(0, 3).map(issue => <div key={issue.id}>• {issue.message}</div>)}
      {problems.length > 3 && <div>+{problems.length - 3} more</div>}
    </>
  ) : summary.warning > 0 ? `Fetch Data (${summary.warning} warning${summary.warning > 1 ? 's' : ''})` : 'Fetch Data';
  return (
    <>
      <Tooltip title={tooltip}>
        <Badge badgeContent={problems.length} color="warning" overlap="rectangular">
          <Button
            variant="contained"
            color={summary.needsAttention ? 'warning' : 'primary'}
            onClick={(event) => {
              if (touch && summary.needsAttention) setAnchor(event.currentTarget);
              else onFetch();
            }}
            startIcon={summary.needsAttention ? <WarningAmberIcon /> : <CloudDownloadIcon />}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Fetch
          </Button>
        </Badge>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{ paper: { role: 'dialog', 'aria-labelledby': titleId } }}
      >
        <QueryProblems
          titleId={titleId}
          issues={issues}
          summary={summary}
          onFetch={() => {
            setAnchor(null);
            onFetch();
          }}
        />
      </Popover>
    </>
  );
};

export default FetchButton;
