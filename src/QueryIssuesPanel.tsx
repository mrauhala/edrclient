import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Collapse from '@mui/material/Collapse';
import FormHelperText from '@mui/material/FormHelperText';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useQueryValidation } from './hooks/useQueryValidation';
import type { QueryIssue } from './query/types';

// Scroll a query builder field into view and focus it (fields carry id `query-field-<field>`)
function focusQueryField(field: string) {
  const element = document.getElementById(`query-field-${field}`);
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.querySelector<HTMLElement>('[role="combobox"], input:not([type="hidden"]), button')?.focus({ preventScroll: true });
}

function IssueIcon({ issue }: { issue: QueryIssue }) {
  const sx = { fontSize: 18, mt: '1px', flexShrink: 0 };
  if (issue.input === 'map') return <MapOutlinedIcon sx={{ ...sx, color: 'warning.main' }} />;
  if (issue.severity === 'missing') return <EditOutlinedIcon sx={{ ...sx, color: 'warning.main' }} />;
  if (issue.severity === 'error') return <ErrorOutlinedIcon sx={{ ...sx, color: 'error.main' }} />;
  if (issue.severity === 'warning') return <WarningAmberOutlinedIcon sx={{ ...sx, color: 'warning.main' }} />;
  return <InfoOutlinedIcon sx={{ ...sx, color: 'info.main' }} />;
}

function IssueRow({ issue }: { issue: QueryIssue }) {
  const content = (
    <>
      <IssueIcon issue={issue} />
      <Typography variant="body2" sx={{ textAlign: 'left' }}>{issue.message}</Typography>
    </>
  );
  const rowSx = { display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.25, width: '100%', justifyContent: 'flex-start' };
  // Form issues jump to their field; map issues are fixed on the map
  return issue.input === 'form' ? (
    <ButtonBase onClick={() => focusQueryField(issue.field)} sx={{ ...rowSx, borderRadius: 0.5 }}>{content}</ButtonBase>
  ) : (
    <Box sx={rowSx}>{content}</Box>
  );
}

function Notes({ notes }: { notes: QueryIssue[] }) {
  const [open, setOpen] = useState(false);
  if (notes.length === 0) return null;
  return (
    <>
      <Link component="button" variant="caption" onClick={() => setOpen(!open)} sx={{ display: 'block', mt: 0.5 }}>
        {open ? 'Hide' : 'Show'} {notes.length} note{notes.length > 1 ? 's' : ''}
      </Link>
      <Collapse in={open}>
        <Box sx={{ mt: 0.5 }}>
          {notes.map(issue => <IssueRow key={issue.id} issue={issue} />)}
        </Box>
      </Collapse>
    </>
  );
}

// What the data query is still missing or gets wrong, shown under the Data Query select
const QueryIssuesPanel: React.FC = () => {
  const { active, issues, summary } = useQueryValidation();
  if (!active) return null;

  const problems = issues.filter(issue => issue.severity !== 'info');
  const notes = issues.filter(issue => issue.severity === 'info');

  if (problems.length === 0) {
    return (
      <Box sx={{ mb: 2, mt: -1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <CheckCircleOutlinedIcon sx={{ fontSize: 18, color: 'success.main' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Query complete</Typography>
        </Box>
        <Notes notes={notes} />
      </Box>
    );
  }

  const title = summary.missing > 0 ? 'Query incomplete' : summary.error > 0 ? 'Query has problems' : 'Check the query';
  return (
    <Alert severity={summary.needsAttention ? 'warning' : 'info'} variant="outlined" icon={false} sx={{ mb: 2, py: 0.5 }}>
      <AlertTitle sx={{ mb: 0.5 }}>{title}</AlertTitle>
      {problems.map(issue => <IssueRow key={issue.id} issue={issue} />)}
      <Notes notes={notes} />
    </Alert>
  );
};

// A field's issue under the field, coloured by severity
export const FieldIssueText: React.FC<{ issue?: QueryIssue }> = ({ issue }) => {
  if (!issue) return null;
  return (
    <FormHelperText
      error={issue.severity === 'error'}
      sx={{ mx: 0, ...(issue.severity === 'warning' && { color: 'warning.main' }) }}
    >
      {issue.message}
    </FormHelperText>
  );
};

export default QueryIssuesPanel;
