import { useEffect, useState, useCallback, memo } from 'react';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import { Collection, hasLocationQuery, normalizeHref } from './DataRetrievalAPI';
import CollectionInfo, { LicenseInfo } from './CollectionInfo';
import LocationFeatureList from './LocationFeatureList';
import TemporalExtent from './TemporalExtent';
import VerticalExtent from './VerticalExtent';
import CollectionValidationErrors from './CollectionValidationErrors';
import ItemsTable from './ItemsTable';
import CollectionQueryBuilder from './CollectionQueryBuilder';
import MapsPanel from './MapsPanel';
import { hasMapsSupport } from './api/maps';
import { useApi } from './contexts/ApiContext';
import { useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import { useCollection } from './contexts/CollectionContext';
import { useOpenCollection } from './contexts/OpenCollectionContext';
import { usePanes } from './contexts/PanesContext';
import { useQueryBuilder } from './contexts/QueryBuilderContext';
import { useValidation } from './contexts/ValidationContext';

interface CollectionListItemHeaderProps {
  collection: Collection;
  isOpen: boolean;
  onToggle: (collection: Collection) => void;
  validationErrors?: import('./DataRetrievalAPI').ValidationError[];
  hasErrors: boolean;
  fallbackLicense: LicenseInfo | null;
}

const CollectionListItemHeader = memo(function CollectionListItemHeader({
  collection,
  isOpen,
  onToggle,
  validationErrors,
  hasErrors,
  fallbackLicense,
}: CollectionListItemHeaderProps) {
  return (
    <ListItemButton
      onClick={() => onToggle(collection)}
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
            clampDescription={!isOpen}
            validationErrors={validationErrors}
          />
        }
        slotProps={{
          primary: { component: 'div' }
        }}
      />
      {isOpen ? <ExpandLess /> : <ExpandMore />}
    </ListItemButton>
  );
});

const CollectionsList = () => {
  const { geoJsonLayers, setGeoJsonLayers } = useGeoJsonLayers();
  const { showMap } = usePanes();
  const { collections, selectedCollection, locationFeatures, setSelectedFeature } = useCollection();
  const { apiUrl, status, license } = useApi();
  const isLoading = status === 'loading';
  const { validationResult } = useValidation();
  const queryState = useQueryBuilder();
  const { openCollection, closeCollection } = useOpenCollection();
  const [showCollectionValidation, setShowCollectionValidation] = useState<{[key: string]: boolean}>({});

  const openIndex = selectedCollection ? collections.indexOf(selectedCollection) : -1;

  // Scroll selected collection into view after collapse/expand animations settle
  useEffect(() => {
    if (openIndex < 0) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-collection-index="${openIndex}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    return () => clearTimeout(timer);
  }, [openIndex]);

  const handleToggle = useCallback((collection: Collection) => {
    if (collection === selectedCollection) closeCollection();
    else openCollection(collection);
  }, [selectedCollection, openCollection, closeCollection]);

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
                severity={error.type === 'cors' ? 'warning' : (error.severity ?? 'error')}
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
          <Alert key={`conf-${index}`} severity={error.severity ?? 'error'} sx={{ mt: 1 }}>
            <AlertTitle>{error.title ?? 'Conformance Unavailable'}</AlertTitle>
            {error.message}
          </Alert>
        ))
      }
      {/* Data link problems (missing, multiple or repaired links) — non-fatal but always visible */}
      {!isLoading && validationResult.errors?.some(err => err.section === 'data link') &&
        validationResult.errors.filter(err => err.section === 'data link').map((error, index) => (
          <Alert key={`data-${index}`} severity={error.severity ?? 'error'} sx={{ mt: 1 }}>
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
            onToggle={handleToggle}
            validationErrors={
              validationResult.collectionErrors
                ? (validationResult.collectionErrors[collection.id] ?? [])
                : undefined
            }
            hasErrors={!!(validationResult.collectionErrors && validationResult.collectionErrors[collection.id])}
            fallbackLicense={license}
          />

          <Collapse in={openIndex === index} timeout="auto" unmountOnExit>
            {/* Dropdowns Section - Always Visible */}
            <Box sx={{ p: 2 }}>
              <CollectionQueryBuilder collection={collection} queryState={queryState} />

              {hasMapsSupport(collection) && (
                <MapsPanel collection={collection} apiUrl={apiUrl} queryState={queryState} />
              )}

              {/* Items Table for collections with items links */}
              {collection.links && collection.links.some(link => link.rel === 'items' && link.type?.includes('geo+json')) && (
                <Box sx={{ mb: 2 }}>
                  {collection.links.map((link, idx) => {
                    if (link.rel === 'items' && link.type?.includes('geo+json')) {
                      const normalizedHref = normalizeHref(link.href);
                      if (!normalizedHref) return null;

                      const handleItemFeatureClick = (feature: any) => {
                        const featureName = feature.properties?.name || feature.properties?.title || `Feature ${feature.id || ''}`;
                        const featureLayer = {
                          url: `selected-item-${Date.now()}`,
                          title: `Selected: ${featureName}`,
                          visible: true,
                          data: {
                            type: 'FeatureCollection',
                            features: [feature]
                          }
                        };

                        const nonSelectedLayers = geoJsonLayers.filter(l => !l.title.startsWith('Selected: '));
                        const updatedLayers = [...nonSelectedLayers, featureLayer];
                        setGeoJsonLayers(updatedLayers);
                        // Where it's shown
                        showMap();
                      };

                      return (
                        <ItemsTable
                          key={idx}
                          url={normalizedHref}
                          title={link.title || 'Items'}
                          onFeatureClick={handleItemFeatureClick}
                        />
                      );
                    }
                    return null;
                  })}
                </Box>
              )}

              {/* Location Query Info */}
              {hasLocationQuery(collection) && (
                <>
                  {openIndex === index && locationFeatures && (
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
                </>
              )}

              {/* Show Validation Button */}
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setShowCollectionValidation({
                  ...showCollectionValidation,
                  [collection.id]: !showCollectionValidation[collection.id]
                })}
                endIcon={showCollectionValidation[collection.id] ? <ExpandLess /> : <ExpandMore />}
                sx={{ mt: 2 }}
              >
                {showCollectionValidation[collection.id] ? 'Hide Validation' : 'Show Validation'}
              </Button>
            </Box>

            {/* Validation Section - Collapsible */}
            <Collapse in={showCollectionValidation[collection.id]} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2 }}>
            {/* Schema validation errors for this collection */}
            {validationResult.collectionErrors && validationResult.collectionErrors[collection.id] && (
              <CollectionValidationErrors
                collectionId={collection.id}
                errors={validationResult.collectionErrors[collection.id]}
                expanded={false}
              />
            )}

            {typeof collection.id == "undefined"
              ? <Alert severity="error"><AlertTitle>A: ID</AlertTitle>"Every Collection within a collections array MUST have a unique (within the array) id parameter.</Alert>
              : <Alert severity="success"><AlertTitle>A: ID</AlertTitle>{collection.id}</Alert>
            }

            { typeof collection.title == "undefined"
              ? <Alert severity="warning"><AlertTitle>B: TITLE</AlertTitle>Every Collection within a collections array SHOULD have a title parameter.</Alert>
              : <Alert severity="success"><AlertTitle>B: TITLE</AlertTitle>{collection.title}</Alert>
            }

            { typeof collection.description == "undefined"
              ? <Alert severity="warning"><AlertTitle>C: DESCRIPTION</AlertTitle>Every Collection within a collections array SHOULD have a description parameter.</Alert>
              : <Alert severity="success"><AlertTitle>C: DESCRIPTION</AlertTitle>{collection.description}</Alert>
            }

            { typeof collection.keywords == "undefined"
              ? <Alert severity="warning"><AlertTitle>D: KEYWORDS</AlertTitle>Every Collection within a collections array SHOULD have a keywords parameter.</Alert>
              : <Alert severity="success"><AlertTitle>D: KEYWORDS</AlertTitle>{collection.keywords.join(', ')}</Alert>
            }

            { typeof collection.links == "undefined"
              ? <Alert severity="error"><AlertTitle>E: LINKS</AlertTitle>Every Collection within a collections array MUST have a links parameter.</Alert>
              : <Alert severity="success"><AlertTitle>E: LINKS</AlertTitle>{collection.links.map((link, i) => {
                  const normalizedHref = normalizeHref(link.href);
                  return normalizedHref ? (<div key={i}><Link href={normalizedHref}>{link.title ? link.title : link.rel}</Link> ({link.rel})</div>) : null;
                })}</Alert>
            }

            { typeof collection.data_queries == "undefined"
              ? (hasMapsSupport(collection)
                  ? <Alert severity="info"><AlertTitle>F: DATA_QUERIES</AlertTitle>Not applicable — this collection is served via OGC API Maps, which uses link relations instead of data_queries.</Alert>
                  : <Alert severity="error"><AlertTitle>F: DATA_QUERIES</AlertTitle>Every collection within a collections array MUST have a data_queries parameter.</Alert>)
              : (
                <Alert severity="success">
                  <AlertTitle>F: DATA_QUERIES</AlertTitle>
                  {Object.keys(collection.data_queries).map((key) => {
                    const normalizedHref = normalizeHref(collection.data_queries[key]?.link?.href);
                    return normalizedHref ? (
                      <div key={key}>
                        <Link href={normalizedHref}>
                          {collection.data_queries[key].link.title ? collection.data_queries[key].link.title : collection.data_queries[key].link.rel}
                        </Link> ({collection.data_queries[key].link.rel})
                      </div>
                    ) : null;
                  })}
                </Alert>
              )
            }

            {/* Main Extent Section */}
            {typeof collection.extent !== "undefined" ? (
              <Box sx={{ padding: 0, minWidth: 120 }}>
                <Alert severity="success">
                  <AlertTitle>G: EXTENT</AlertTitle>
                  Collection extent information with spatial (mandatory), temporal and vertical components (optional).
                </Alert>

                {/* Spatial Extent Subsection (Mandatory) */}
                {collection.extent.spatial &&
                 typeof collection.extent.spatial === 'object' &&
                 collection.extent.spatial.bbox &&
                 Array.isArray(collection.extent.spatial.bbox) &&
                 collection.extent.spatial.bbox.length > 0 &&
                 collection.extent.spatial.crs ? (
                  <Box sx={{ ml: 2, mt: 1 }}>
                    <Alert severity="success">
                      <AlertTitle>G.1: Spatial Extent (Mandatory)</AlertTitle>
                      <strong>CRS:</strong> {collection.extent.spatial.crs}<br/>
                      <strong>Bounding Box{Array.isArray(collection.extent.spatial.bbox[0]) && collection.extent.spatial.bbox.length > 1 ? 'es' : ''}:</strong><br/>
                      {Array.isArray(collection.extent.spatial.bbox[0])
                        ? (collection.extent.spatial.bbox as number[][]).map((bbox, idx) => (
                            <div key={idx} style={{ marginLeft: '10px' }}>
                              Bbox {idx + 1}: [{bbox.join(', ')}]
                            </div>
                          ))
                        : <div style={{ marginLeft: '10px' }}>[{(collection.extent.spatial.bbox as number[]).join(', ')}]</div>
                      }
                    </Alert>
                    {!Array.isArray(collection.extent.spatial.bbox[0]) && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        <AlertTitle>Legacy bbox format</AlertTitle>
                        This collection uses a flat array format instead of the EDR standard array-of-bbox-arrays format.
                      </Alert>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ ml: 2, mt: 1 }}>
                    <Alert severity="error">
                      <AlertTitle>G.1: Spatial Extent (Mandatory)</AlertTitle>
                      Missing or invalid spatial extent. Spatial extent with bounding box and CRS is required.
                    </Alert>
                  </Box>
                )}

                {/* Temporal Extent Subsection (Optional) */}
                <Box sx={{ ml: 2, mt: 1 }}>
                  <TemporalExtent
                    temporal={collection.extent.temporal}
                    collectionId={collection.id}
                    isSubsection={true}
                  />
                </Box>

                {/* Vertical Extent Subsection (Optional) */}
                {collection.extent?.vertical && (
                  <Box sx={{ ml: 2, mt: 1 }}>
                    <VerticalExtent
                      vertical={collection.extent.vertical}
                      collectionId={collection.id}
                      isSubsection={true}
                    />
                  </Box>
                )}
              </Box>
            ) : (
              <Alert severity="error">
                <AlertTitle>G: EXTENT</AlertTitle>
                Every collection within a collections array MUST have an extent parameter.
              </Alert>
            )}

            { typeof collection.crs == "undefined"
              ? <Alert severity="error"><AlertTitle>H: CRS</AlertTitle>Every collection within a collections array MUST have a crs parameter.</Alert>
              : <Alert severity="success"><AlertTitle>H: CRS</AlertTitle>{collection.crs}</Alert>
            }

            { (!collection.output_formats || !Array.isArray(collection.output_formats))
              ? (hasMapsSupport(collection)
                  ? <Alert severity="info"><AlertTitle>I: OUTPUT_FORMATS</AlertTitle>Not applicable — OGC API Maps collections advertise image formats via conformance classes rather than output_formats.</Alert>
                  : <Alert severity="error"><AlertTitle>I: OUTPUT_FORMATS</AlertTitle>Every collection within a collections array MUST have an output_formats parameter.</Alert>)
              : (
                <Alert severity="success">
                  <AlertTitle>I: OUTPUT_FORMATS</AlertTitle>
                  {collection.output_formats.join(', ')}
                </Alert>
              )
            }

            { typeof collection.parameter_names == "undefined"
              ? (hasMapsSupport(collection)
                  ? <Alert severity="info"><AlertTitle>J: PARAMETER_NAMES</AlertTitle>Not applicable — OGC API Maps collections do not declare parameter_names.</Alert>
                  : <Alert severity="error"><AlertTitle>J: PARAMETER_NAMES</AlertTitle>Every collection within a collections array MUST have a parameter_names parameter.</Alert>)
              : (
                <Alert severity="success">
                  <AlertTitle>J: PARAMETER_NAMES</AlertTitle>
                  {Array.isArray(collection.parameter_names)
                    ? collection.parameter_names.map((param) => (
                        <div key={param.id}>
                          {param.label || param.id} ({param.type || 'unknown'})
                        </div>
                      ))
                    : Object.keys(collection.parameter_names).map((paramKey) => {
                        const params = collection.parameter_names as { [key: string]: any };
                        return (
                          <div key={paramKey}>
                            {params[paramKey]?.description || paramKey} ({params[paramKey]?.type || 'unknown'})
                          </div>
                        );
                      })
                  }
                </Alert>
              )
            }
            </Box>
            </Collapse>
          </Collapse>
        </Box>
      ))}
    </List>
  );
};

export default CollectionsList;
