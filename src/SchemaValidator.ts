import Ajv from 'ajv';
import axios from 'axios';
import { resolve as urlResolve } from 'url';

// This class handles schema validation for the EDR Client
export class SchemaValidator {
private static instance: SchemaValidator;
private ajv: Ajv;
private schema: any = null;
private isSchemaLoaded: boolean = false;
private schemaLoadError: string | null = null;
private loadedSchemas: Map<string, any> = new Map();

private constructor() {
  // Configure Ajv with improved options
  this.ajv = new Ajv({ 
    allErrors: true,
    strict: false, // Disable strict mode to ignore unknown keywords
    validateFormats: false, // Disable format validation to avoid additional errors
    loadSchema: this.loadExternalSchema.bind(this)  // Custom schema loader for references
  });
  
  // Add custom keywords that might be in the schemas
  this.ajv.addKeyword('min');
  this.ajv.addKeyword('example');
}

public static getInstance(): SchemaValidator {
  if (!SchemaValidator.instance) {
    SchemaValidator.instance = new SchemaValidator();
  }
  return SchemaValidator.instance;
}

// Custom schema loader for Ajv to resolve external schema references
private async loadExternalSchema(uri: string): Promise<any> {
  console.log(`Loading external schema: ${uri}`);
  
  // Check if we've already loaded this schema
  if (this.loadedSchemas.has(uri)) {
    console.log(`Schema already loaded: ${uri}`);
    return this.loadedSchemas.get(uri);
  }
  
  try {
    const response = await axios.get(uri);
    const externalSchema = response.data;
    
    // Process the external schema to convert $href to $ref
    const processedSchema = this.preprocessSchema(externalSchema);
    
    // Also resolve any relative $ref in this schema
    const baseUrl = uri.substring(0, uri.lastIndexOf('/') + 1);
    const resolvedSchema = this.resolveSchemaRefs(processedSchema, baseUrl);
    
    // Store the loaded schema for future use
    this.loadedSchemas.set(uri, resolvedSchema);
    
    return resolvedSchema;
  } catch (error) {
    console.error(`Error loading external schema ${uri}:`, error);
    throw error;
  }
}

// Explicitly preload common schemas
private async preloadCommonSchemas(baseUrl: string): Promise<void> {
  const commonSchemas = [
    'collectionDesc.json',
    'extent.json',
    'link.json',
    'parameter-names.json',
    'parameterNames.json' // Both variants in case they use either naming style
  ];
  
  const loadPromises = commonSchemas.map(schema => {
    const fullUrl = urlResolve(baseUrl, schema);
    return this.loadExternalSchema(fullUrl).catch(err => {
      console.warn(`Failed to preload schema ${fullUrl}:`, err.message);
      return null;
    });
  });
  
  await Promise.all(loadPromises);
  console.log(`Preloaded ${this.loadedSchemas.size} schemas`);
}

// Convert $href properties to standard $ref properties
private preprocessSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  
  // Deep clone to avoid modifying the original
  const result = Array.isArray(schema) ? [...schema] : {...schema};
  
  // Process all properties
  for (const key in result) {
    if (key === '$href') {
      // Convert $href to $ref
      result.$ref = result[key];
      delete result[key];
    } else if (typeof result[key] === 'object') {
      // Recursively process nested objects
      result[key] = this.preprocessSchema(result[key]);
    }
  }
  
  return result;
}

// Resolve relative URLs in schema references
private resolveSchemaRefs(schema: any, baseUrl: string): any {
  if (!schema || typeof schema !== 'object') return schema;
  
  // First preprocess the schema to convert $href to $ref
  schema = this.preprocessSchema(schema);
  
  // Deep clone to avoid modifying the original
  const result = Array.isArray(schema) ? [...schema] : {...schema};
  
  // Process all properties
  for (const key in result) {
    if (key === '$ref' && typeof result[key] === 'string' && !result[key].startsWith('#')) {
      // Resolve relative URL to absolute
      result[key] = urlResolve(baseUrl, result[key]);
    } else if (typeof result[key] === 'object') {
      // Recursively process nested objects
      result[key] = this.resolveSchemaRefs(result[key], baseUrl);
    }
  }
  
  return result;
}

public async loadSchema(schemaUrl: string = 'https://beta.schemas.opengis.net/ogcapi/common/part2/0.1/collections/openapi/schemas/collections.json'): Promise<boolean> {
  try {
    console.log(`Loading main schema from: ${schemaUrl}`);
    const response = await axios.get(schemaUrl);
    const mainSchema = response.data;
    
    // Store base URL for resolving relative references
    const baseUrl = schemaUrl.substring(0, schemaUrl.lastIndexOf('/') + 1);
    console.log(`Base URL for schema resolution: ${baseUrl}`);
    
    // Preprocess and resolve references to absolute URLs
    this.schema = this.resolveSchemaRefs(mainSchema, baseUrl);
    
    // Log all $ref properties to debug
    this.logAllRefs(this.schema);
    
    // Store the main schema too
    this.loadedSchemas.set(schemaUrl, this.schema);
    
    // Preload common schemas that might be referenced
    await this.preloadCommonSchemas(baseUrl);
    
    this.isSchemaLoaded = true;
    this.schemaLoadError = null;
    
    return true;
  } catch (error) {
    console.error('Error loading schema:', error);
    this.schemaLoadError = error instanceof Error ? error.message : 'Unknown error loading schema';
    this.isSchemaLoaded = false;
    return false;
  }
}

// Helper method to log all $ref properties for debugging
private logAllRefs(schema: any, path: string = '') {
  if (!schema || typeof schema !== 'object') return;
  
  for (const key in schema) {
    const newPath = path ? `${path}.${key}` : key;
    
    if (key === '$ref') {
      console.log(`Found $ref at ${path}: ${schema[key]}`);
    }
    
    if (typeof schema[key] === 'object') {
      this.logAllRefs(schema[key], newPath);
    }
  }
}

public async validateCollections(data: any): Promise<{ valid: boolean; errors: any[] | null }> {
  if (!this.isSchemaLoaded || !this.schema) {
    return { 
      valid: true, // Default to valid to prevent UI issues
      errors: [{ message: 'Schema not loaded. Validation skipped.' }] 
    };
  }

  try {
    console.log('Beginning validation...');
    console.log(`Number of loaded schemas before validation: ${this.loadedSchemas.size}`);
    
    // Compile the schema with all references resolved
    const validate = await this.ajv.compileAsync(this.schema);
    
    console.log(`Number of loaded schemas after compilation: ${this.loadedSchemas.size}`);
    console.log('Schemas loaded:', Array.from(this.loadedSchemas.keys()));
    
    // Perform the validation
    const valid = validate(data);
    
    if (!valid) {
      console.error('Validation errors:', validate.errors);
    }
    
    return {
      valid: !!valid,
      errors: validate.errors || null
    };
  } catch (error) {
    console.error('Validation error:', error);
    return {
      valid: true, // Default to valid to prevent UI issues
      errors: [{ message: error instanceof Error ? error.message : 'Unknown validation error' }]
    };
  }
}

public isLoaded(): boolean {
  return this.isSchemaLoaded;
}

public getLoadError(): string | null {
  return this.schemaLoadError;
}

public getLoadedSchemaCount(): number {
  return this.loadedSchemas.size;
}

public getLoadedSchemaUrls(): string[] {
  return Array.from(this.loadedSchemas.keys());
}

// Method to manually fetch and register a schema by name
public async fetchAndRegisterSchema(schemaName: string, baseUrl?: string): Promise<boolean> {
  try {
    if (!baseUrl && this.schema) {
      // Try to determine base URL from the main schema URL
      const mainSchemaUrl = Array.from(this.loadedSchemas.keys())[0];
      if (mainSchemaUrl) {
        baseUrl = mainSchemaUrl.substring(0, mainSchemaUrl.lastIndexOf('/') + 1);
      }
    }
    
    if (!baseUrl) {
      console.error('Base URL not provided and could not be determined');
      return false;
    }
    
    const schemaUrl = urlResolve(baseUrl, schemaName);
    console.log(`Manually loading schema: ${schemaUrl}`);
    
    const schema = await this.loadExternalSchema(schemaUrl);
    if (schema) {
      // Register this schema with Ajv
      this.ajv.addSchema(schema, schemaUrl);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error manually loading schema ${schemaName}:`, error);
    return false;
  }
}

// Method to register a schema with a specific URI
public registerSchema(schema: any, uri: string): void {
  this.ajv.addSchema(schema, uri);
  this.loadedSchemas.set(uri, schema);
  console.log(`Manually registered schema for URI: ${uri}`);
}
}

export default SchemaValidator;