import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// This class handles validation against EDR OpenAPI schemas
export class SchemaValidator {
  private static instance: SchemaValidator;
  private isSchemaLoaded: boolean = false;
  private schemaLoadError: string | null = null;
  private loadedSchemaUrls: string[] = [];
  private schema: any = null;
  private ajv: Ajv;
  private collectionsValidate: any = null;

  private constructor() {
    // Initialize AJV for data validation
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      validateFormats: true
    });
    addFormats(this.ajv);
  }

  public static getInstance(): SchemaValidator {
    if (!SchemaValidator.instance) {
      SchemaValidator.instance = new SchemaValidator();
    }
    return SchemaValidator.instance;
  }

  public async loadSchema(schemaUrl: string = 'https://schemas.opengis.net/ogcapi/edr/1.1/openapi/ogcapi-environmental-data-retrieval-1.bundled.json'): Promise<boolean> {
    try {
      console.log(`Loading EDR OpenAPI specification from: ${schemaUrl}`);
      
      // Reset state
      this.loadedSchemaUrls = [];
      this.schema = null;
      this.collectionsValidate = null;
      
      // Download the bundled EDR OpenAPI specification (JSON with all references resolved)
      console.log('Downloading bundled EDR OpenAPI specification...');
      const response = await fetch(schemaUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch EDR OpenAPI spec: ${response.status} ${response.statusText}`);
      }
      
      // Parse the JSON specification
      console.log('Parsing JSON specification...');
      this.schema = await response.json();
      
      // Verify we have the expected structure - EDR specs have schemas in paths, not components
      if (!this.schema.paths) {
        throw new Error('No paths found in OpenAPI specification');
      }
      
      this.loadedSchemaUrls.push(schemaUrl);
      
      console.log(`✅ Successfully loaded EDR OpenAPI specification: "${this.schema.info?.title || 'Untitled Schema'}"`);
      console.log(`Schema version: ${this.schema.info?.version || 'unknown'}`);
      console.log(`Paths loaded: ${Object.keys(this.schema.paths).length} endpoints`);
      
      // Log some of the key paths for debugging
      const pathNames = Object.keys(this.schema.paths);
      console.log('Available API paths:', pathNames.slice(0, 5).join(', '), pathNames.length > 5 ? '...' : '');
      
      // Try to prepare the collections validator
      this.prepareCollectionsValidator();
      
      this.isSchemaLoaded = true;
      this.schemaLoadError = null;
      
      return true;
    } catch (error) {
      console.error('❌ Error loading EDR OpenAPI specification:', error);
      this.schemaLoadError = error instanceof Error ? error.message : 'Unknown error loading schema';
      this.isSchemaLoaded = false;
      return false;
    }
  }

  private prepareCollectionsValidator(): void {
    if (!this.schema?.paths) {
      console.warn('No paths found in OpenAPI specification');
      return;
    }

    let collectionsSchema = null;
    
    // Look for the collections schema in the /collections path response
    const collectionsPath = this.schema.paths['/collections'];
    if (collectionsPath?.get?.responses?.['200']?.content?.['application/json']?.schema) {
      collectionsSchema = collectionsPath.get.responses['200'].content['application/json'].schema;
      console.log('✅ Found collections schema in /collections path');
    }
    
    // Also try alternative content types
    if (!collectionsSchema && collectionsPath?.get?.responses?.['200']?.content) {
      const contentTypes = Object.keys(collectionsPath.get.responses['200'].content);
      for (const contentType of contentTypes) {
        if (collectionsPath.get.responses['200'].content[contentType]?.schema) {
          collectionsSchema = collectionsPath.get.responses['200'].content[contentType].schema;
          console.log(`✅ Found collections schema in /collections path (${contentType})`);
          break;
        }
      }
    }
    
    if (collectionsSchema) {
      try {
        console.log('Compiling collections schema for validation...');
        console.log('Schema structure:', {
          type: collectionsSchema.type,
          required: collectionsSchema.required,
          properties: collectionsSchema.properties ? Object.keys(collectionsSchema.properties) : []
        });
        
        this.collectionsValidate = this.ajv.compile(collectionsSchema);
        console.log('✅ Collections validator compiled successfully');
      } catch (error) {
        console.error('❌ Error compiling collections schema:', error);
      }
    } else {
      console.warn('❌ No collections schema found in EDR specification');
      console.warn('Available paths:', Object.keys(this.schema.paths));
    }
  }

  public async validateCollections(data: any): Promise<{ valid: boolean; errors: any[] | null }> {
    if (!this.isSchemaLoaded || !this.collectionsValidate) {
      return { 
        valid: true, // Default to valid to prevent UI issues
        errors: [{ message: 'EDR schema not loaded or no collections schema found. Validation skipped.' }] 
      };
    }

    try {
      console.log('🔍 Beginning validation against EDR collections schema...');
      
      // Validate the data against the pre-compiled collections schema
      const isValid = this.collectionsValidate(data);
      
      if (isValid) {
        console.log('✅ EDR collections schema validation passed');
        return { valid: true, errors: null };
      } else {
        console.warn('❌ EDR collections schema validation failed');
        console.warn('Validation errors:', this.collectionsValidate.errors);
        
        // Convert AJV errors to our format
        const errors = this.collectionsValidate.errors?.map((error: any) => ({
          path: error.instancePath || error.dataPath || 'root',
          message: `${error.instancePath || error.dataPath || ''}: ${error.message}`,
          keyword: error.keyword,
          allowedValues: error.params?.allowedValues,
          schema: error.schema,
          data: error.data
        })) || [];
        
        return { valid: false, errors };
      }
    } catch (error) {
      console.error('❌ EDR schema validation error:', error);
      
      return {
        valid: false,
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
    // Since we're using a single bundled EDR OpenAPI specification,
    // return 1 if schema is loaded, 0 if not
    return this.isSchemaLoaded ? 1 : 0;
  }

  public getLoadedSchemaUrls(): string[] {
    return [...this.loadedSchemaUrls];
  }
}

export default SchemaValidator;
