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
  disabled?: boolean;
  onFetch: () => void;
}

const issueLines = (issues: QueryIssue[]) => (
  <>
    {issues.slice(0, 3).map(issue => <div key={issue.id}>• {issue.message}</div>)}
    {issues.length > 3 && <div>+{issues.length - 3} more</div>}
  </>
);

// The button's tooltip: what's wrong, or else what the checks noticed. For a URL typed by hand this
// is the only place that says so, like a parameter the API docs don't declare.
export function fetchTooltip(issues: QueryIssue[], summary: IssueSummary): React.ReactNode {
  if (summary.needsAttention) return <>{titleOf(summary)}, fetch anyway:{issueLines(problemsOf(issues))}</>;
  const noticed = [...issues.filter(issue => issue.severity === 'warning'), ...issues.filter(issue => issue.severity === 'info')];
  if (noticed.length === 0) return 'Fetch Data';
  return <>Fetch Data, but note:{issueLines(noticed)}</>;
}

// What the query lacks, and sending it anyway: a server's error can be what's being tested
export const QueryProblems: React.FC<Omit<FetchButtonProps, 'disabled'> & { titleId?: string }> = ({ issues, summary, onFetch, titleId }) => (
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
const FetchButton: React.FC<FetchButtonProps> = ({ issues, summary, disabled = false, onFetch }) => {
  const touch = useMediaQuery('(pointer: coarse)', { noSsr: true });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const problems = problemsOf(issues);
  return (
    <>
      <Tooltip title={fetchTooltip(issues, summary)}>
        <Badge badgeContent={problems.length} color="warning" overlap="rectangular">
          <Button
            variant="contained"
            disabled={disabled}
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
