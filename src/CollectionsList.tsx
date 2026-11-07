import { useCallback, useEffect, memo } from 'react';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import { Collection } from './DataRetrievalAPI';
import CollectionInfo, { LicenseInfo } from './CollectionInfo';
import { useApi } from './contexts/ApiContext';
import { useCollection } from './contexts/CollectionContext';
import { useOpenCollection } from './contexts/OpenCollectionContext';
import { usePanes } from './contexts/PanesContext';
import { useValidation } from './contexts/ValidationContext';
import { alertSeverity } from './validation/severity';

interface CollectionListItemHeaderProps {
  collection: Collection;
  isOpen: boolean;
  onOpen: (collection: Collection) => void;
  validationErrors?: import('./DataRetrievalAPI').ValidationError[];
  hasErrors: boolean;
  fallbackLicense: LicenseInfo | null;
}

const CollectionListItemHeader = memo(function CollectionListItemHeader({
  collection,
  isOpen,
  onOpen,
  validationErrors,
  hasErrors,
  fallbackLicense,
}: CollectionListItemHeaderProps) {
  return (
    <ListItemButton
      selected={isOpen}
      onClick={() => onOpen(collection)}
      sx={{
        borderLeft: '3px solid',
        borderColor: validationErrors === undefined
          ? 'transparent'
          : hasErrors
            ? 'warning.main'
            : 'success.main',
        pl: '10px',
        py: 0.5,
      }}
    >
      <ListItemText
        primary={
          <CollectionInfo
            collection={collection}
            fallbackLicense={fallbackLicense}
            clampDescription
            validationErrors={validationErrors}
          />
        }
        slotProps={{
          primary: { component: 'div' }
        }}
      />
      <ChevronRight />
    </ListItemButton>
  );
});

const CollectionsList = () => {
  const { showPane } = usePanes();
  const { collections, selectedCollection } = useCollection();
  const { status, license } = useApi();
  const isLoading = status === 'loading';
  const { validationResult } = useValidation();
  const { openCollection, closeCollection } = useOpenCollection();

  const openIndex = selectedCollection ? collections.indexOf(selectedCollection) : -1;

  // Opened from elsewhere, it's in view on coming back. A row already in view stays where it is.
  useEffect(() => {
    if (openIndex < 0) return;
    const row = document.querySelector(`[data-collection-index="${openIndex}"]`);
    const list = row?.closest('.sidebar-scrollable');
    if (!row || !list) return;
    const { top, bottom } = row.getBoundingClientRect();
    const view = list.getBoundingClientRect();
    if (top < view.top) list.scrollTop += top - view.top;
    else if (bottom > view.bottom) list.scrollTop += bottom - view.bottom;
  }, [openIndex]);

  // The open one is still as it was left
  const handleOpen = useCallback((collection: Collection) => {
    if (collection === selectedCollection) showPane('request');
    else openCollection(collection);
  }, [selectedCollection, showPane, openCollection]);

  return (
    <List component="nav">
      {isLoading ? (
        <Alert severity="info">Loading collections...</Alert>
      ) : (
        <>
          {/* Show fatal errors (landing page or collections failed) */}
          {collections.length === 0 && validationResult.errors && validationResult.errors.length > 0 && validationResult.errors.some(err => err.section !== 'conformance' && err.section !== 'data link') ? (
            validationResult.errors.filter(err => err.section !== 'conformance' && err.section !== 'data link').map((error, index) => (
              <Alert
                key={index}
                severity={error.type === 'cors' ? 'warning' : alertSeverity(error.severity)}
              >
                <AlertTitle>
                  {error.title ?? (error.type === 'cors' ? 'CORS Issue' : 'Error')}
                </AlertTitle>
                {error.message}
                {error.type === 'cors' && (
                  <div style={{ marginTop: '8px', fontSize: '0.875rem' }}>
                    <strong>Possible solutions:</strong>
                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                      <li>Use a CORS proxy service</li>
                      <li>Contact the service provider to enable CORS headers</li>
                      <li>Access the API from a server-side application instead</li>
                    </ul>
                  </div>
                )}
              </Alert>
            ))
          ) : collections.length === 0 ? (
            <Alert severity="warning">No collections found from this endpoint.</Alert>
          ) : (
            <Alert severity="success">Found {collections.length} collections</Alert>
          )}
        </>
      )}
      {/* Conformance problems (missing or misfiled link, failed fetch) — non-fatal but always visible */}
      {!isLoading && validationResult.errors?.some(err => err.section === 'conformance') &&
        validationResult.errors.filter(err => err.section === 'conformance').map((error, index) => (
          <Alert key={`conf-${index}`} severity={alertSeverity(error.severity)} sx={{ mt: 1 }}>
            <AlertTitle>{error.title ?? 'Conformance Unavailable'}</AlertTitle>
            {error.message}
          </Alert>
        ))
      }
      {/* Data link problems (missing, multiple or repaired links) — non-fatal but always visible */}
      {!isLoading && validationResult.errors?.some(err => err.section === 'data link') &&
        validationResult.errors.filter(err => err.section === 'data link').map((error, index) => (
          <Alert key={`data-${index}`} severity={alertSeverity(error.severity)} sx={{ mt: 1 }}>
            <AlertTitle>{error.title ?? 'Collections Link Issue'}</AlertTitle>
            {error.message}
          </Alert>
        ))
      }
      {collections.map((collection, index) => (
        <Box
          key={index}
          data-collection-index={index}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            mb: '4px',
            overflow: 'hidden',
          }}
        >
          <CollectionListItemHeader
            collection={collection}
            isOpen={openIndex === index}
            onOpen={handleOpen}
            validationErrors={
              validationResult.collectionErrors
                ? (validationResult.collectionErrors[collection.id] ?? [])
                : undefined
            }
            hasErrors={!!(validationResult.collectionErrors && validationResult.collectionErrors[collection.id])}
            fallbackLicense={license}
          />
          {/* Below the row's button rather than in it, since a button can't hold a button, and clear of a long title */}
          {openIndex === index && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 0.5, py: 0.25, bgcolor: theme => alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity) }}>
              <Button size="small" onClick={closeCollection} sx={{ py: 0, minWidth: 0 }}>
                Close
              </Button>
            </Box>
          )}
        </Box>
      ))}
    </List>
  );
};

export default CollectionsList;
