import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { ValidationError } from '../../types/api';
import { ajvErrorToValidationError, condenseAjvErrors } from '../ajvErrors';

export type OasVersion = '3.0' | '3.1';

// Loads the official OpenAPI schema for a version. The app serves them from /schemas/openapi;
// download-schemas-deref.js writes them, adapted for AJV (see SCHEMA_UPDATE.md).
export type OasSchemaLoader = (version: OasVersion) => Promise<object>;

const fetchSchema: OasSchemaLoader = async version => {
  const response = await fetch(`/schemas/openapi/${version}/schema.json`);
  if (!response.ok) throw new Error(`OpenAPI ${version} schema not available (${response.status})`);
  return response.json();
};

const validators = new Map<OasVersion, Promise<ValidateFunction>>();

async function compile(version: OasVersion, loadSchema: OasSchemaLoader): Promise<ValidateFunction> {
  const schema = await loadSchema(version);
  if (version === '3.1') {
    // The 2020-12 draft only ships with 3.1 documents: load it on demand (ajv itself is in the main bundle)
    const { default: Ajv2020 } = await import('ajv/dist/2020');
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    ajv.addFormat('media-range', true); // used by the 3.1 schema, not in ajv-formats
    return ajv.compile(schema);
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

export function oasVersionOf(doc: Record<string, unknown>): OasVersion | null {
  const version = typeof doc.openapi === 'string' ? doc.openapi : '';
  if (version.startsWith('3.0')) return '3.0';
  if (version.startsWith('3.1')) return '3.1';
  return null;
}

// Validate an API definition against the official OpenAPI schema of its version
export async function validateOpenApiStructure(
  doc: Record<string, unknown>,
  loadSchema: OasSchemaLoader = fetchSchema,
): Promise<{ schemaName: string; errors: ValidationError[] }> {
  const version = oasVersionOf(doc);
  if (!version) {
    const declared = doc.openapi ?? doc.swagger ?? 'unknown';
    return {
      schemaName: 'OpenAPI',
      errors: [{
        message: `Only OpenAPI 3.0 and 3.1 can be validated; this document declares version ${declared}`,
        section: 'OpenAPI', schema: 'OpenAPI', keyword: 'version', severity: 'info', type: 'schema',
      }],
    };
  }
  const schemaName = `OpenAPI ${version} schema`;
  if (!validators.has(version)) {
    const pending = compile(version, loadSchema);
    validators.set(version, pending);
    pending.catch(() => validators.delete(version));
  }
  const validate = await validators.get(version)!;
  if (validate(doc)) return { schemaName, errors: [] };
  return {
    schemaName,
    errors: condenseAjvErrors(validate.errors ?? []).map(error =>
      ajvErrorToValidationError(error, { section: 'OpenAPI', schema: schemaName, severity: 'error' })),
  };
}
