import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import CollectionValidationErrors from './CollectionValidationErrors';
import { hasMapsSupport } from './api/maps';
import TemporalExtent from './TemporalExtent';
import VerticalExtent from './VerticalExtent';
import { Collection, ValidationResult, normalizeHref } from './DataRetrievalAPI';

// A collection, checked against what the standard asks of it, field by field
export default function CollectionChecks({ collection, validationResult }: { collection: Collection; validationResult: ValidationResult }) {
  return (
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
  );
}
