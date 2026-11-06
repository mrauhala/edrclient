import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { isSuccessStatus } from '../api/httpErrors';
import { useApi } from '../contexts/ApiContext';
import { useCollection } from '../contexts/CollectionContext';
import { useOpenApi } from '../contexts/OpenApiContext';
import { useValidation } from '../contexts/ValidationContext';
import { apiResources, type ApiResource } from './apiResources';

const MONOSPACE = { fontFamily: 'monospace', fontSize: '0.75rem' };

// Shows what really came back for it, with its tabs. What it checked comes along for Raw and Checks
function openResource({ captured, findings, schemaName }: ApiResource) {
  if (!captured) return;
  document.dispatchEvent(new CustomEvent('open-validation-response', {
    detail: { url: captured.url, data: captured.text, response: captured.response, failure: captured.failure, errors: findings, schemaName },
  }));
}

function Resource({ resource }: { resource: ApiResource }) {
  const { name, path, status, facts, issues, note, captured } = resource;
  // The list always says how it stands, and the others only if something's wrong
  const showIssues = issues !== null && (issues > 0 || resource.key === 'collections') && !!captured?.response;
  return (
    <ButtonBase
      disabled={!captured}
      onClick={() => openResource(resource)}
      sx={{
        display: 'block',
        textAlign: 'left',
        minWidth: 0,
        px: 1.75,
        py: 1,
        bgcolor: 'background.paper',
        color: 'text.primary',
        '&:hover': { bgcolor: 'action.hover' },
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
      }}
    >
      <Box component="span" sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Box component="span" sx={{ fontSize: '0.84rem', fontWeight: 500, flexShrink: 0 }}>{name}</Box>
        {path && (
          <Box component="span" title={captured?.url ?? path} sx={{ ...MONOSPACE, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {path}
          </Box>
        )}
      </Box>
      <Box component="span" sx={{ ...MONOSPACE, display: 'block', mt: 0.375, color: 'text.secondary' }}>
        {status !== null && (
          <Box component="span" sx={{ color: isSuccessStatus(status) ? 'success.main' : 'error.main', fontWeight: 'bold' }}>{status}</Box>
        )}
        {facts.map(fact => <span key={fact}>{status !== null || fact !== facts[0] ? ' · ' : ''}<Box component="span" sx={{ whiteSpace: 'nowrap' }}>{fact}</Box></span>)}
        {showIssues && (
          <>
            {' · '}
            <Box component="span" sx={issues > 0 ? { color: 'warning.main', fontWeight: 500 } : undefined}>
              {issues} {issues === 1 ? 'issue' : 'issues'}
            </Box>
          </>
        )}
        {note && <span>{status !== null || facts.length > 0 ? ' · ' : ''}{note}</span>}
      </Box>
    </ButtonBase>
  );
}

// What the API was loaded from: each resource's status, time and key figure, and through them what really came back
export default function ApiResourceStrip() {
  const { apiUrl, status, captured, conformsTo } = useApi();
  const { collections } = useCollection();
  const openApi = useOpenApi();
  const { validationResult } = useValidation();

  const resources = apiResources({
    apiUrl,
    loading: status === 'loading',
    captured,
    conformsTo,
    collectionCount: collections.length,
    openApi,
    validation: validationResult,
  });

  return (
    <Box
      component="nav"
      aria-label="The API's resources"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1px',
        bgcolor: 'divider',
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        mb: 2,
      }}
    >
      {resources.map(resource => <Resource key={resource.key} resource={resource} />)}
    </Box>
  );
}
