// Barrel re-export — backward compatibility
export type { AuthCredentials, DataQuery, DataQueries, QueryVariables, Link, Spatial, Temporal, Vertical, CustomDimension, Extent, parameterNames, ParameterDefinition, Collection, ValidationError, ValidationResult, LandingPage, GetCollectionsResult, LocationQueryResult } from './types/api';
export { normalizeHref } from './utils/href';
export { formatConformanceClass } from './utils/conformance';
export { normalizeBbox, getOverallExtent } from './utils/extents/bbox';
export { normalizeTemporal, formatTemporalInterval, formatDateString, getOverallTemporalExtent, expandTemporalValues, parseDuration, computeStepMs } from './utils/extents/temporal';
export { normalizeVertical, expandVerticalValues, formatVerticalInterval, formatVerticalValue, getOverallVerticalExtent, getVerticalUnit } from './utils/extents/vertical';
export { expandCustomDimensionValues, getEffectiveCustomDimensions } from './utils/extents/custom';
export { getSupportedDataQueries, hasLocationQuery, getLocationQueryUrl, executeLocationQuery } from './api/queries';
export { getCollections } from './api/client';
