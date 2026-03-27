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
import { Collection, ValidationResult, normalizeBbox, hasLocationQuery, getLocationQueryUrl, executeLocationQuery, normalizeHref } from './DataRetrievalAPI';
import CollectionInfo, { LicenseInfo } from './CollectionInfo';
import LocationFeatureList from './LocationFeatureList';
import TemporalExtent from './TemporalExtent';
import VerticalExtent from './VerticalExtent';
import CollectionValidationErrors from './CollectionValidationErrors';
import ItemsTable from './ItemsTable';
import CollectionQueryBuilder from './CollectionQueryBuilder';
import { useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import { useMapInteraction } from './contexts/MapInteractionContext';
import { useCollection } from './contexts/CollectionContext';
import { useService } from './contexts/ServiceContext';
import { useValidation } from './contexts/ValidationContext';
import { detectEdrVersion, validateLocationsResponse } from './validation/locationsValidator';
import { UseQueryUrlReturn } from './hooks/useQueryUrl';

interface CollectionListItemHeaderProps {
  collection: Collection;
  index: number;
  isOpen: boolean;
  onToggle: (index: number, id: string) => void;
  validationErrors?: import('./DataRetrievalAPI').ValidationError[];
  hasErrors: boolean;
  fallbackLicense: LicenseInfo | null;
}

const CollectionListItemHeader = memo(function CollectionListItemHeader({
  collection,
  index,
  isOpen,
  onToggle,
  validationErrors,
  hasErrors,
  fallbackLicense,
}: CollectionListItemHeaderProps) {
  return (
    <ListItemButton
      onClick={() => onToggle(index, collection.id)}
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
        primaryTypographyProps={{ component: 'div' }}
      />
      {isOpen ? <ExpandLess /> : <ExpandMore />}
    </ListItemButton>
  );
});

interface CollectionsListProps {
  collections: Collection[];
  validationResult: ValidationResult;
  topLevelLicense: LicenseInfo | null;
  isLoading: boolean;
  currentApiUrl: string;
  queryState: UseQueryUrlReturn;
}

// Helper function to extract GeoJSON links from a collection
const getGeoJsonLinks = (
  collection: Collection,
  datetime?: string,
  mode?: 'individual' | 'range',
  startDt?: string,
  endDt?: string
): {url: string, title: string}[] => {
  if (!collection || !collection.links || !Array.isArray(collection.links)) {
    return [];
  }

  // Check if collection has temporal extent
  const hasTemporal = collection.extent?.temporal &&
                      (collection.extent.temporal.interval || collection.extent.temporal.values);

  return collection.links
    .filter(link => link.type === 'application/geo+json')
    .map(link => {
      const normalizedHref = normalizeHref(link.href);
      if (!normalizedHref) return null;

      let url = normalizedHref;

      // NOTE: Do NOT add bbox here - OpenLayers will handle it dynamically with bboxStrategy

      // Add datetime parameter if collection has temporal extent AND user has selected a datetime
      if (hasTemporal) {
        let datetimeParam = '';

        if (mode === 'range' && startDt && endDt) {
          datetimeParam = `${startDt}/${endDt}`;
        } else if (datetime) {
          datetimeParam = datetime;
        }

        if (datetimeParam) {
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}datetime=${datetimeParam}`;
        }
      }

      return {
        url: url,
        title: link.title || link.rel || 'GeoJSON Layer'
      };
    })
    .filter(item => item !== null) as {url: string, title: string}[];
};

const CollectionsList = ({
  collections,
  validationResult,
  topLevelLicense,
  isLoading,
  currentApiUrl,
  queryState,
}: CollectionsListProps) => {
  const { geoJsonLayers, setGeoJsonLayers } = useGeoJsonLayers();
  const { setClickedCoords, setDataQuery } = useMapInteraction();
  const { selectedCollection, setSelectedCollection, setSelectedCollectionExtents, locationFeatures, setLocationFeatures, setSelectedFeature, setCollectionUrl, selectCollectionByIndexRef } = useCollection();
  const { getAuthCredentials, conformsTo } = useService();
  const { setValidationResult, setEndpointUrls, setRawResponses } = useValidation();
  const {
    selectedDatetime,
    datetimeMode,
    startDatetime,
    endDatetime,
    resetQueryState,
    buildUrlWithParams,
  } = queryState;

  const [openCollectionIndex, setOpenCollectionIndex] = useState<number | null>(null);
  const [currentLocationCollection, setCurrentLocationCollection] = useState<string | null>(null);
  const [showCollectionValidation, setShowCollectionValidation] = useState<{[key: string]: boolean}>({});

  // Scroll selected collection into view after collapse/expand animations settle
  useEffect(() => {
    if (openCollectionIndex !== null) {
      const timer = setTimeout(() => {
        const el = document.querySelector(`[data-collection-index="${openCollectionIndex}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [openCollectionIndex]);

  // Effect to update GeoJSON layers when datetime values change
  useEffect(() => {
    if (selectedCollection && geoJsonLayers.length > 0) {
      const geoJsonLinks = getGeoJsonLinks(selectedCollection, selectedDatetime, datetimeMode, startDatetime, endDatetime);
      const auth = getAuthCredentials(currentApiUrl);
      const updatedLayers = geoJsonLinks.map((link, index) => {
        const existingLayer = geoJsonLayers[index];
        return {
          url: link.url,
          title: link.title,
          visible: existingLayer?.visible ?? false,
          labelProperty: existingLayer?.labelProperty,
          data: existingLayer?.data,
          apiKey: auth?.apiKey,
          apiKeyParam: auth?.apiKeyParam
        };
      });
      setGeoJsonLayers(updatedLayers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatetime, datetimeMode, startDatetime, endDatetime]);

  const handleItemClick = useCallback(async (index: number, key: string) => {
    const newIndex = openCollectionIndex === index ? null : index;
    setOpenCollectionIndex(newIndex);

    const collection = collections[index];
    const selectedColl = newIndex !== null ? collection : null;
    setSelectedCollection(selectedColl);

    // Initialize GeoJSON layers for the selected collection
    if (selectedColl) {
      const geoJsonLinks = getGeoJsonLinks(selectedColl, selectedDatetime, datetimeMode, startDatetime, endDatetime);
      const auth = getAuthCredentials(currentApiUrl);
      const initialLayers = geoJsonLinks.map(link => ({
        url: link.url,
        title: link.title,
        visible: false,
        apiKey: auth?.apiKey,
        apiKeyParam: auth?.apiKeyParam
      }));
      setGeoJsonLayers(initialLayers);
    } else {
      setGeoJsonLayers([]);
    }

    // Find the "data" link from collection links
    if (selectedColl) {
      const dataLink = selectedColl.links.find(link => link.rel === 'data');
      let baseUrl = '';
      if (dataLink?.href) {
        const normalizedHref = normalizeHref(dataLink.href);
        if (normalizedHref) {
          baseUrl = normalizedHref;
        }
      }

      if (!baseUrl) {
        baseUrl = currentApiUrl + "/collections/" + key;
      }
      setCollectionUrl(buildUrlWithParams(baseUrl, '', [], false));
      resetQueryState();
      setClickedCoords([]);
      setDataQuery('');
    } else {
      setCollectionUrl('');
      resetQueryState();
      setClickedCoords([]);
    }

    setSelectedCollection(selectedColl);

    if (newIndex !== null) {
      // Collection is being opened - show extent and location data
      if (collection &&
          collection.extent &&
          typeof collection.extent === 'object' &&
          collection.extent.spatial &&
          typeof collection.extent.spatial === 'object' &&
          collection.extent.spatial.bbox &&
          Array.isArray(collection.extent.spatial.bbox) &&
          collection.extent.spatial.bbox.length > 0) {

        try {
          const normalizedBboxes = normalizeBbox(collection.extent.spatial.bbox);
          if (normalizedBboxes) {
            setSelectedCollectionExtents(normalizedBboxes);
          } else {
            setSelectedCollectionExtents(null);
          }
        } catch (error) {
          console.warn('Error normalizing bbox:', error);
          setSelectedCollectionExtents(null);
        }
      } else {
        setSelectedCollectionExtents(null);
      }

      // Check for location query support and execute if available
      if (collection && hasLocationQuery(collection)) {
        const locationQueryUrl = getLocationQueryUrl(collection);

        if (locationQueryUrl) {
          try {
            const locationResult = await executeLocationQuery(locationQueryUrl, getAuthCredentials(currentApiUrl));
            if (locationResult && locationResult.features) {
              setLocationFeatures(locationResult.features);
              setCurrentLocationCollection(collection.id);

              // Validate locations response against EDR schema (non-blocking)
              const edrVersion = detectEdrVersion(conformsTo);
              if (edrVersion) {
                validateLocationsResponse(locationResult, edrVersion).then(locValidation => {
                  setValidationResult(prev => {
                    const mergedErrors = [
                      ...(prev.errors || []).filter(e => e.section !== 'Locations'),
                      ...locValidation.errors,
                    ];
                    return {
                      ...prev,
                      locationsValidation: {
                        isValid: locValidation.isValid,
                        errors: locValidation.errors.length > 0 ? locValidation.errors : null,
                        schemaResults: [{ schema: `EDR ${edrVersion} Locations`, isValid: locValidation.isValid }],
                      },
                      errors: mergedErrors.length > 0 ? mergedErrors : null,
                      isValid: prev.isValid && locValidation.isValid,
                    };
                  });
                  setEndpointUrls(prev => ({ ...prev, locations: locationQueryUrl }));
                  setRawResponses(prev => ({ ...prev, locations: locationResult }));
                });
              }
            } else {
              setLocationFeatures(null);
              setCurrentLocationCollection(null);
            }
          } catch (error) {
            console.error('Error executing location query:', error);
            setLocationFeatures(null);
            setCurrentLocationCollection(null);
          }
        }
      } else {
        setLocationFeatures(null);
        setCurrentLocationCollection(null);
      }
    } else {
      // Collection is being closed - clear all map data
      console.log('Collection being closed, clearing map data');
      setSelectedCollectionExtents(null);
      setLocationFeatures(null);
      setCurrentLocationCollection(null);
      setGeoJsonLayers([]);
      // Clear locations validation
      setValidationResult(prev => {
        const filteredErrors = (prev.errors || []).filter(e => e.section !== 'Locations');
        const { locationsValidation: _, ...rest } = prev;
        const sectionsValid = [
          prev.landingPageValidation?.isValid ?? true,
          prev.collectionsValidation?.isValid ?? true,
          prev.conformanceValidation?.isValid ?? true,
        ].every(Boolean);
        return {
          ...rest,
          errors: filteredErrors.length > 0 ? filteredErrors : null,
          isValid: sectionsValid && filteredErrors.length === 0,
        };
      });
      setEndpointUrls(prev => ({ ...prev, locations: undefined }));
      setRawResponses(prev => ({ ...prev, locations: undefined }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, currentApiUrl, selectedDatetime, datetimeMode, startDatetime, endDatetime]);

  // Register selection callback for keyboard navigation
  useEffect(() => {
    selectCollectionByIndexRef.current = (index: number) => {
      handleItemClick(index, collections[index].id);
    };
    return () => { selectCollectionByIndexRef.current = null; };
  });

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
                severity={error.type === 'cors' ? 'warning' : 'error'}
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
      {/* Conformance errors (missing link or failed fetch) — non-fatal but always visible */}
      {!isLoading && validationResult.errors?.some(err => err.section === 'conformance') &&
        validationResult.errors.filter(err => err.section === 'conformance').map((error, index) => (
          <Alert key={`conf-${index}`} severity="error" sx={{ mt: 1 }}>
            <AlertTitle>{error.title ?? 'Conformance Unavailable'}</AlertTitle>
            {error.message}
          </Alert>
        ))
      }
      {/* Data link errors (missing or multiple) — non-fatal but always visible */}
      {!isLoading && validationResult.errors?.some(err => err.section === 'data link') &&
        validationResult.errors.filter(err => err.section === 'data link').map((error, index) => (
          <Alert key={`data-${index}`} severity="error" sx={{ mt: 1 }}>
            <AlertTitle>{error.title ?? 'Collections Link Issue'}</AlertTitle>
            {error.message}
          </Alert>
        ))
      }
      {collections.map((collection, index) => (
        <Box
          key={collection.id || index}
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
            index={index}
            isOpen={openCollectionIndex === index}
            onToggle={handleItemClick}
            validationErrors={
              validationResult.collectionErrors
                ? (validationResult.collectionErrors[collection.id] ?? [])
                : undefined
            }
            hasErrors={!!(validationResult.collectionErrors && validationResult.collectionErrors[collection.id])}
            fallbackLicense={topLevelLicense}
          />

          <Collapse in={openCollectionIndex === index} timeout="auto" unmountOnExit>
            {/* Dropdowns Section - Always Visible */}
            <Box sx={{ p: 2 }}>
              <CollectionQueryBuilder collection={collection} queryState={queryState} />

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
                  {currentLocationCollection === collection.id && locationFeatures && (
                    <Box sx={{ mt: 1 }}>
                      <LocationFeatureList
                        features={locationFeatures}
                        onFeatureSelect={setSelectedFeature}
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
              ? <Alert severity="error"><AlertTitle>F: DATA_QUERIES</AlertTitle>Every collection within a collections array MUST have a data_queries parameter.</Alert>
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
              ? <Alert severity="error"><AlertTitle>I: OUTPUT_FORMATS</AlertTitle>Every collection within a collections array MUST have an output_formats parameter.</Alert>
              : (
                <Alert severity="success">
                  <AlertTitle>I: OUTPUT_FORMATS</AlertTitle>
                  {collection.output_formats.join(', ')}
                </Alert>
              )
            }

            { typeof collection.parameter_names == "undefined"
              ? <Alert severity="error"><AlertTitle>J: PARAMETER_NAMES</AlertTitle>Every collection within a collections array MUST have a parameter_names parameter.</Alert>
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
