import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ValidationError } from './types/api';

// --- Registry types ---

interface QueryResultSchema {
  id: string;
  displayName: string;
  schemaType: 'json-schema';
  schemaPath: string;
  detect: (data: string, contentType: string, url?: string) => boolean;
}

export interface QueryResultValidation {
  matched: boolean;
  schemaName?: string;
  valid?: boolean;
  errors?: ValidationError[];
}

// --- Detection helpers ---

const COVJSON_TYPES = ['Coverage', 'CoverageCollection', 'Domain', 'NdArray', 'TiledNdArray'];

function detectCoverageJson(data: string, contentType: string): boolean {
  // Content-type check
  if (contentType.includes('covjson') || contentType.includes('coverage+json')) {
    return true;
  }
  // Structural check – look for CoverageJSON type values in the raw string
  // (avoids parsing JSON twice; the validator will parse it properly)
  try {
    const parsed = JSON.parse(data);
    return typeof parsed.type === 'string' && COVJSON_TYPES.includes(parsed.type);
  } catch {
    return false;
  }
}

function detectEdrLocations(data: string, contentType: string, url?: string): boolean {
  // URL must contain /locations (not deeper like /locations/id/position)
  if (!url || !/\/locations\/?(\?|$)/.test(url)) return false;
  if (!contentType.includes('json')) return false;
  try {
    const parsed = JSON.parse(data);
    return parsed.type === 'FeatureCollection';
  } catch {
    return false;
  }
}

// --- Schema registry ---

const SCHEMAS: QueryResultSchema[] = [
  {
    id: 'covjson',
    displayName: 'CoverageJSON 1.0',
    schemaType: 'json-schema',
    schemaPath: '/schemas/covjson/1.0/coveragejson.json',
    detect: detectCoverageJson,
  },
  {
    id: 'edr-locations',
    displayName: 'EDR Locations FeatureCollection',
    schemaType: 'json-schema',
    schemaPath: '/schemas/edr/1.1/edrFeatureCollectionGeoJSON.json',
    detect: detectEdrLocations,
  },
];

// --- Validator class ---

export class QueryResultValidator {
  private static instance: QueryResultValidator;
  private ajv: Ajv;
  private compiledValidators: Map<string, ValidateFunction> = new Map();

  private constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      validateFormats: true,
    });
    addFormats(this.ajv);
  }

  public static getInstance(): QueryResultValidator {
    if (!QueryResultValidator.instance) {
      QueryResultValidator.instance = new QueryResultValidator();
    }
    return QueryResultValidator.instance;
  }

  /**
   * Validate query result data against the first matching schema in the registry.
   */
  public async validate(data: string, contentType: string, url?: string): Promise<QueryResultValidation> {
    const schema = SCHEMAS.find(s => s.detect(data, contentType, url));
    if (!schema) {
      return { matched: false };
    }

    console.log(`🔍 Query result matched schema: ${schema.displayName}`);

    // Parse JSON data
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return {
        matched: true,
        schemaName: schema.displayName,
        valid: false,
        errors: [{ message: 'Failed to parse response as JSON', type: 'schema' }],
      };
    }

    // Get or compile validator
    const validator = await this.getValidator(schema);
    if (!validator) {
      return {
        matched: true,
        schemaName: schema.displayName,
        valid: false,
        errors: [{ message: `Failed to load schema: ${schema.displayName}`, type: 'schema' }],
      };
    }

    const isValid = validator(parsed);

    if (isValid) {
      console.log(`✅ ${schema.displayName}: Valid`);
      return { matched: true, schemaName: schema.displayName, valid: true, errors: [] };
    }

    const errors: ValidationError[] = (validator.errors || []).map(err => ({
      message: `${err.instancePath || ''}: ${err.message}`,
      path: err.instancePath || 'root',
      keyword: err.keyword,
      schema: schema.displayName,
      section: 'Query Result',
      type: 'schema' as const,
    }));

    console.warn(`❌ ${schema.displayName}: ${errors.length} validation error(s)`);
    return { matched: true, schemaName: schema.displayName, valid: false, errors };
  }

  private async getValidator(schema: QueryResultSchema): Promise<ValidateFunction | null> {
    const cached = this.compiledValidators.get(schema.id);
    if (cached) return cached;

    try {
      const response = await fetch(schema.schemaPath);
      if (!response.ok) {
        console.error(`Failed to fetch schema ${schema.schemaPath}: ${response.status}`);
        return null;
      }
      const schemaJson = await response.json();
      const validator = this.ajv.compile(schemaJson);
      this.compiledValidators.set(schema.id, validator);
      return validator;
    } catch (error) {
      console.error(`Error loading schema ${schema.id}:`, error);
      return null;
    }
  }
}

export default QueryResultValidator;
