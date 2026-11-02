import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { ValidationError } from '../types/api';
import { condenseAjvErrors, groupArrayItemErrors } from './ajvErrors';
import { publicUrl } from '../utils/publicUrl';

type EdrVersion = '1.0' | '1.1' | '1.2';

const SCHEMA_PATHS: Record<EdrVersion, string> = {
  '1.0': '/schemas/edr/1.0/edrFeatureCollectionGeoJSON.json',
  '1.1': '/schemas/edr/1.1/edrFeatureCollectionGeoJSON.json',
  '1.2': '/schemas/edr/1.2/edrFeatureCollectionGeoJSON.json',
};

// Newest first, so a server declaring several versions is validated against the latest
const EDR_VERSIONS: EdrVersion[] = ['1.2', '1.1', '1.0'];

const ajv = new Ajv({ allErrors: true, verbose: true, strict: false, validateFormats: true });
addFormats(ajv);

const compiledValidators = new Map<EdrVersion, ValidateFunction>();

/**
 * Detect EDR version from conformance classes.
 * Returns the highest declared version, or null if no EDR conformance detected (non-EDR service).
 */
export function detectEdrVersion(conformsTo: string[] | null): EdrVersion | null {
  if (!conformsTo) return null;
  return EDR_VERSIONS.find(version =>
    conformsTo.some(url => url.endsWith(`/spec/ogcapi-edr-1/${version}/conf/core`))
  ) ?? null;
}

async function getValidator(version: EdrVersion): Promise<ValidateFunction | null> {
  const cached = compiledValidators.get(version);
  if (cached) return cached;

  try {
    const response = await fetch(publicUrl(SCHEMA_PATHS[version]));
    if (!response.ok) return null;
    const schema = await response.json();
    const validator = ajv.compile(schema);
    compiledValidators.set(version, validator);
    return validator;
  } catch (error) {
    console.error(`Error loading EDR ${version} locations schema:`, error);
    return null;
  }
}

/**
 * Validate a locations response (parsed GeoJSON object) against the EDR schema.
 */
export async function validateLocationsResponse(
  data: unknown,
  edrVersion: EdrVersion
): Promise<{ isValid: boolean; errors: ValidationError[] }> {
  const displayName = `EDR ${edrVersion} Locations`;

  const validator = await getValidator(edrVersion);
  if (!validator) {
    return {
      isValid: false,
      errors: [{ message: `Failed to load schema: ${displayName}`, type: 'schema', section: 'Locations' }],
    };
  }

  const isValid = validator(data) as boolean;

  if (isValid) {
    console.log(`✅ ${displayName}: Valid`);
    return { isValid: true, errors: [] };
  }

  // One error per kind, with how many features have it: a large locations response would otherwise
  // give one error per feature and property (91,888 for a Meteogate collection)
  const features = (data as { features?: unknown } | null)?.features;
  const featureCount = Array.isArray(features) ? features.length : undefined;
  const groups = groupArrayItemErrors(condenseAjvErrors(validator.errors || [], Infinity));
  const errors: ValidationError[] = groups.map(({ error, genericPath, array, count }) => ({
    message: count > 1
      ? `${genericPath}: ${error.message} (${count.toLocaleString('en')}${array === 'features' && featureCount ? ` of ${featureCount.toLocaleString('en')}` : ''} ${array})`
      : `${error.instancePath || ''}: ${error.message}`,
    path: error.instancePath || 'root',
    keyword: error.keyword,
    schema: displayName,
    section: 'Locations',
    type: 'schema' as const,
  }));

  console.warn(`❌ ${displayName}: ${validator.errors?.length ?? 0} validation error(s) in ${errors.length} group(s)`);
  return { isValid: false, errors };
}
