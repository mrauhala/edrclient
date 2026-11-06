import { useLayoutEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import { adjacentCollection } from './collections/openingCollection';
import CollectionChecks from './CollectionChecks';
import { CollectionAbout, CollectionDescription, aboutCollection, aboutSummary } from './CollectionInfo';
import CollectionQueryBuilder from './CollectionQueryBuilder';
import ItemsTable from './ItemsTable';
import LocationFeatureList from './LocationFeatureList';
import MapsPanel from './MapsPanel';
import { Collection, hasLocationQuery, normalizeHref } from './DataRetrievalAPI';
import { hasMapsSupport } from './api/maps';
import { useApi } from './contexts/ApiContext';
import { useCollection } from './contexts/CollectionContext';
import { useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import { useOpenCollection } from './contexts/OpenCollectionContext';
import { usePanes } from './contexts/PanesContext';
import { useQueryBuilder } from './contexts/QueryBuilderContext';
import { useValidation } from './contexts/ValidationContext';

function StepButton({ label, keyName, hint, Icon, target }: {
  label: string;
  keyName: string;
  hint: string;
  Icon: typeof KeyboardArrowUp;
  target: Collection | null;
}) {
  const { openCollection } = useOpenCollection();
  const { isMobile } = usePanes();
  return (
    <Tooltip title={isMobile ? label : `${label} (${keyName})`}>
      {/* A disabled button takes no pointer events, so the tooltip hangs on this */}
      <span>
        <Button
          size="small"
          color="inherit"
          disabled={!target}
          aria-label={label}
          aria-keyshortcuts={keyName}
          onClick={() => target && openCollection(target)}
          sx={{ gap: 0.5, px: 0.75, minWidth: isMobile ? 44 : 0, minHeight: isMobile ? 40 : 0 }}
        >
          <Icon fontSize="small" />
          {!isMobile && (
            <Box
              component="kbd"
              sx={{
                px: 0.5,
                borderRadius: 0.5,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'action.hover',
                fontFamily: 'inherit',
                fontSize: '0.65rem',
                lineHeight: 1.4,
                textTransform: 'none',
              }}
            >
              {hint}
            </Box>
          )}
        </Button>
      </span>
    </Tooltip>
  );
}

// Back to the list, and on to the collections beside this one. Outside what starts afresh for each open, so that the
// buttons stay where they are, under the pointer and with the focus, for going on to the next.
function CollectionNav({ collection }: { collection: Collection }) {
  const { collections } = useCollection();
  const { showPane } = usePanes();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 2, pt: 2, mb: 1 }}>
      <Button size="small" startIcon={<ArrowBack />} onClick={() => showPane('api')} sx={{ ml: -0.5 }}>
        All collections
      </Button>
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, mr: -0.75 }}>
        <StepButton
          label="Previous collection"
          keyName="PageUp"
          hint="PgUp"
          Icon={KeyboardArrowUp}
          target={adjacentCollection(collections, collection, -1)}
        />
        <StepButton
          label="Next collection"
          keyName="PageDown"
          hint="PgDn"
          Icon={KeyboardArrowDown}
          target={adjacentCollection(collections, collection, 1)}
        />
      </Box>
    </Box>
  );
}

function OpenCollection({ collection }: { collection: Collection }) {
  const { apiUrl, license } = useApi();
  const { locationFeatures, setSelectedFeature } = useCollection();
  const { geoJsonLayers, setGeoJsonLayers } = useGeoJsonLayers();
  const { showMap } = usePanes();
  const { validationResult } = useValidation();
  const queryState = useQueryBuilder();
  const [showAbout, setShowAbout] = useState(false);
  const [showChecks, setShowChecks] = useState(false);

  const about = aboutCollection(collection, license);
  const summary = aboutSummary(about);
  const issues = validationResult.collectionErrors?.[collection.id];
  const itemLinks = (collection.links ?? []).filter(link => link.rel === 'items' && link.type?.includes('geo+json'));

  const showItemOnMap = (feature: any) => {
    const featureName = feature.properties?.name || feature.properties?.title || `Feature ${feature.id || ''}`;
    const featureLayer = {
      url: `selected-item-${Date.now()}`,
      title: `Selected: ${featureName}`,
      visible: true,
      data: {
        type: 'FeatureCollection',
        features: [feature],
      },
    };
    setGeoJsonLayers([...geoJsonLayers.filter(layer => !layer.title.startsWith('Selected: ')), featureLayer]);
    // Where it's shown
    showMap();
  };

  return (
    <>
      <Box sx={{ px: 2, pb: 2 }}>
        {validationResult.collectionErrors && (
          <Box sx={{ fontSize: '0.7rem', fontWeight: 500, mb: 0.5, color: issues ? 'warning.main' : 'success.main' }}>
            {issues ? `⚠ ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}` : '✓ Valid'}
          </Box>
        )}
        <Typography variant="subtitle1" component="h1" sx={{ fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
          {collection.title || collection.id || 'Untitled collection'}
        </Typography>
        {collection.title && collection.id !== undefined && (
          <Box sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'text.secondary', mb: 0.75, overflowWrap: 'anywhere' }}>
            {collection.id}
          </Box>
        )}
        <CollectionDescription collection={collection} />

        {summary && (
          <>
            <Link
              component="button"
              type="button"
              variant="body2"
              aria-expanded={showAbout}
              onClick={() => setShowAbout(!showAbout)}
              sx={{ display: 'flex', alignItems: 'center', textAlign: 'left', mb: 0.5 }}
            >
              About: {summary}
              {showAbout ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </Link>
            <Collapse in={showAbout} timeout="auto" unmountOnExit>
              <Box sx={{ pt: 0.5, pb: 1 }}>
                <CollectionAbout about={about} />
              </Box>
            </Collapse>
          </>
        )}

        <Box sx={{ mt: 2 }}>
          {/* A collection served some other way than EDR has no queries to choose from */}
          {Object.keys(collection.data_queries ?? {}).length > 0 && (
            <CollectionQueryBuilder collection={collection} queryState={queryState} />
          )}

          {/* Mounted whether or not it's showing, since it writes the request line */}
          {hasMapsSupport(collection) && (
            <MapsPanel collection={collection} apiUrl={apiUrl} queryState={queryState} />
          )}

          {itemLinks.length > 0 && (
            <Box sx={{ mb: 2 }}>
              {itemLinks.map(link => {
                const href = normalizeHref(link.href);
                return href ? (
                  <ItemsTable key={href} url={href} title={link.title || 'Items'} onFeatureClick={showItemOnMap} />
                ) : null;
              })}
            </Box>
          )}

          {hasLocationQuery(collection) && locationFeatures && (
            <Box sx={{ mt: 1 }}>
              <LocationFeatureList
                features={locationFeatures}
                onFeatureSelect={feature => {
                  setSelectedFeature(feature);
                  showMap();
                }}
              />
            </Box>
          )}
        </Box>

        <Button
          fullWidth
          variant="outlined"
          onClick={() => setShowChecks(!showChecks)}
          endIcon={showChecks ? <ExpandLess /> : <ExpandMore />}
          sx={{ mt: 2 }}
        >
          {showChecks ? 'Hide Validation' : 'Show Validation'}
        </Button>
      </Box>

      <Collapse in={showChecks} timeout="auto" unmountOnExit>
        <CollectionChecks collection={collection} validationResult={validationResult} />
      </Collapse>
    </>
  );
}

// The request pane: what's open, starting afresh for each open. ItemsTable, for one, only fetches when mounted.
export default function CollectionPane() {
  const { selectedCollection } = useCollection();
  const { openSerial } = useOpenCollection();
  const { showPane } = usePanes();

  // At its top, wherever the last one was left. Only for an open: going to the list and back keeps the place.
  useLayoutEffect(() => {
    document.getElementById('request-pane')?.scrollTo({ top: 0 });
  }, [openSerial]);

  if (!selectedCollection) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ mb: 0.5 }}>No collection is open.</Typography>
        <Link component="button" type="button" variant="body2" onClick={() => showPane('api')}>
          Choose one from the API's list
        </Link>
      </Box>
    );
  }
  return (
    <>
      <CollectionNav collection={selectedCollection} />
      <OpenCollection key={openSerial} collection={selectedCollection} />
    </>
  );
}
