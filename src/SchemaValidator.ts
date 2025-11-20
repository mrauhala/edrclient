import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Schema type definitions
type SchemaType = 'edr-1.0' | 'edr-1.1' | 'features-1.0' | 'common-1.0';

interface SchemaConfig {
  type: SchemaType;
  url: string;
  conformancePattern: string;
  displayName: string;
}

// Configuration for all supported schemas
const SCHEMA_CONFIGS: SchemaConfig[] = [
  {
    type: 'features-1.0',
    url: '/schemas/ogcapi/ogcapi-features-1-1.0-conf-core.json',
    conformancePattern: '/spec/ogcapi-features-1/1.0/conf/core',
    displayName: 'OGC API Features 1.0'
  },
  {
    type: 'edr-1.1',
    url: '/schemas/ogcapi/ogcapi-edr-1-1.1-conf-core.json',
    conformancePattern: '/spec/ogcapi-edr-1/1.1/conf/core',
    displayName: 'OGC API EDR 1.1'
  },
  {
    type: 'edr-1.0',
    url: '/schemas/ogcapi/ogcapi-edr-1-1.0-conf-core.json',
    conformancePattern: '/spec/ogcapi-edr-1/1.0/conf/core',
    displayName: 'OGC API EDR 1.0'
  },
  {
    type: 'common-1.0',
    url: '/schemas/ogcapi/ogcapi-common-1-1.0-conf-core.json',
    conformancePattern: '/spec/ogcapi-common-1/1.0/conf/core',
    displayName: 'OGC API Common 1.0'
  }
];

interface ValidatorSet {
  collections?: any;
  landingPage?: any;
  conformance?: any;
}

// This class handles validation against multiple OGC API OpenAPI schemas
export class SchemaValidator {
  private static instance: SchemaValidator;
  private loadedSchemas: Map<SchemaType, any> = new Map();
  private validators: Map<SchemaType, ValidatorSet> = new Map();
  private schemaLoadError: string | null = null;
  private ajv: Ajv;

  private constructor() {
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

  /**
   * Detect and load all schemas that match the conformance classes
   */
  public async loadSchemaBasedOnConformance(conformsTo?: string[]): Promise<boolean> {
    if (!conformsTo || conformsTo.length === 0) {
      console.log('🎯 No conformance classes provided, defaulting to EDR 1.1 schema');
      return this.loadSingleSchema('edr-1.1');
    }

    console.log(`🎯 Analyzing ${conformsTo.length} conformance classes...`);
    
    // Find all matching schemas
    const matchingSchemas: SchemaConfig[] = [];
    for (const config of SCHEMA_CONFIGS) {
      if (conformsTo.some(url => url.endsWith(config.conformancePattern))) {
        matchingSchemas.push(config);
        console.log(`   ✓ Found: ${config.displayName}`);
      }
    }

    if (matchingSchemas.length === 0) {
      console.log('🎯 No matching conformance classes found, defaulting to EDR 1.1 schema');
      return this.loadSingleSchema('edr-1.1');
    }

    // Load all matching schemas
    console.log(`📥 Loading ${matchingSchemas.length} schema(s)...`);
    let allSuccess = true;
    
    for (const config of matchingSchemas) {
      // Skip if already loaded
      if (this.loadedSchemas.has(config.type)) {
        console.log(`   ✅ ${config.displayName} already loaded`);
        continue;
      }

      const success = await this.loadSingleSchema(config.type);
      if (!success) {
        console.warn(`   ⚠️  Failed to load ${config.displayName}`);
        allSuccess = false;
      }
    }

    console.log(`✅ Schema loading complete. ${this.loadedSchemas.size} schema(s) ready for validation.`);
    return allSuccess;
  }

  /**
   * Load a single schema by type
   */
  private async loadSingleSchema(schemaType: SchemaType): Promise<boolean> {
    const config = SCHEMA_CONFIGS.find(c => c.type === schemaType);
    if (!config) {
      console.error(`❌ Unknown schema type: ${schemaType}`);
      return false;
    }

    try {
      console.log(`   📥 Loading ${config.displayName} from: ${config.url}`);
      
      const response = await fetch(config.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
      }

      const schema = await response.json();

      // Verify structure
      if (!schema.paths && !schema.components) {
        throw new Error('Invalid OpenAPI specification structure');
      }

      // Store the schema
      this.loadedSchemas.set(schemaType, schema);
      
      // Prepare validators for this schema
      this.prepareValidators(schemaType, schema);

      console.log(`   ✅ ${config.displayName} loaded successfully`);
      return true;

    } catch (error) {
      console.error(`   ❌ Error loading ${config.displayName}:`, error);
      this.schemaLoadError = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  /**
   * Prepare validators (collections, landing page, conformance) for a schema
   */
  private prepareValidators(schemaType: SchemaType, schema: any): void {
    const validatorSet: ValidatorSet = {};

    // Try to prepare collections validator
    const collectionsSchema = this.extractCollectionsSchema(schema);
    if (collectionsSchema) {
      try {
        validatorSet.collections = this.ajv.compile(collectionsSchema);
        console.log(`      ✓ Collections validator ready`);
      } catch (error) {
        console.warn(`      ⚠️  Failed to compile collections validator:`, error);
      }
    }

    // Try to prepare landing page validator
    const landingPageSchema = this.extractLandingPageSchema(schema);
    if (landingPageSchema) {
      try {
        validatorSet.landingPage = this.ajv.compile(landingPageSchema);
        console.log(`      ✓ Landing page validator ready`);
      } catch (error) {
        console.warn(`      ⚠️  Failed to compile landing page validator:`, error);
      }
    }

    // Try to prepare conformance validator
    const conformanceSchema = this.extractConformanceSchema(schema);
    if (conformanceSchema) {
      try {
        validatorSet.conformance = this.ajv.compile(conformanceSchema);
        console.log(`      ✓ Conformance validator ready`);
      } catch (error) {
        console.warn(`      ⚠️  Failed to compile conformance validator:`, error);
      }
    }

    this.validators.set(schemaType, validatorSet);
  }

  /**
   * Extract collections schema from OpenAPI spec
   */
  private extractCollectionsSchema(schema: any): any {
    // Try paths first (EDR style)
    if (schema.paths?.['/collections']?.get?.responses?.['200']?.content) {
      const content = schema.paths['/collections'].get.responses['200'].content;
      if (content['application/json']?.schema) {
        return content['application/json'].schema;
      }
      // Try any available content type
      for (const contentType of Object.keys(content)) {
        if (content[contentType]?.schema) {
          return content[contentType].schema;
        }
      }
    }

    // Try components/schemas (OGC Features style)
    if (schema.components?.schemas?.collections) {
      return schema.components.schemas.collections;
    }

    return null;
  }

  /**
   * Extract landing page schema from OpenAPI spec
   */
  private extractLandingPageSchema(schema: any): any {
    // Try paths first
    if (schema.paths?.['/']?.get?.responses?.['200']?.content) {
      const content = schema.paths['/'].get.responses['200'].content;
      if (content['application/json']?.schema) {
        return content['application/json'].schema;
      }
      // Try any available content type
      for (const contentType of Object.keys(content)) {
        if (content[contentType]?.schema) {
          return content[contentType].schema;
        }
      }
    }

    // Try components/schemas
    if (schema.components?.schemas?.landingPage) {
      return schema.components.schemas.landingPage;
    }

    return null;
  }

  /**
   * Extract conformance schema from OpenAPI spec
   */
  private extractConformanceSchema(schema: any): any {
    // Try paths first
    if (schema.paths?.['/conformance']?.get?.responses?.['200']?.content) {
      const content = schema.paths['/conformance'].get.responses['200'].content;
      if (content['application/json']?.schema) {
        return content['application/json'].schema;
      }
      // Try any available content type
      for (const contentType of Object.keys(content)) {
        if (content[contentType]?.schema) {
          return content[contentType].schema;
        }
      }
    }

    // Try components/schemas
    if (schema.components?.schemas?.confClasses) {
      return schema.components.schemas.confClasses;
    }

    return null;
  }

  /**
   * Validate collections data against all loaded schemas
   */
  public async validateCollections(data: any): Promise<{ valid: boolean; errors: any[] | null; collectionErrors?: { [collectionId: string]: any[] } }> {
    if (this.validators.size === 0) {
      return {
        valid: true,
        errors: [{ message: 'No schemas loaded. Validation skipped.' }]
      };
    }

    console.log(`🔍 Validating collections against ${this.validators.size} schema(s)...`);
    
    let overallValid = true;
    const allErrors: any[] = [];

    // Validate against each loaded schema
    this.validators.forEach((validatorSet, schemaType) => {
      if (!validatorSet.collections) {
        return;
      }

      const config = SCHEMA_CONFIGS.find(c => c.type === schemaType);
      const displayName = config?.displayName || schemaType;

      try {
        const isValid = validatorSet.collections(data);
        
        if (isValid) {
          console.log(`   ✅ ${displayName}: Valid`);
        } else {
          console.warn(`   ⚠️  ${displayName}: Validation issues found`);
          overallValid = false;
          
          // Add schema-specific errors
          if (validatorSet.collections.errors) {
            const errors = validatorSet.collections.errors.map((error: any) => ({
              schema: displayName,
              path: error.instancePath || error.dataPath || 'root',
              message: `${error.instancePath || error.dataPath || ''}: ${error.message}`,
              keyword: error.keyword
            }));
            allErrors.push(...errors);
          }
        }
      } catch (error) {
        console.error(`   ❌ ${displayName}: Validation error:`, error);
        overallValid = false;
        allErrors.push({
          schema: displayName,
          message: error instanceof Error ? error.message : 'Unknown validation error'
        });
      }
    });

    return {
      valid: overallValid,
      errors: allErrors.length > 0 ? allErrors : null
    };
  }

  /**
   * Validate landing page data against all loaded schemas
   */
  public async validateLandingPage(data: any): Promise<{ valid: boolean; errors: any[] | null }> {
    if (this.validators.size === 0) {
      return {
        valid: true,
        errors: [{ message: 'No schemas loaded. Validation skipped.' }]
      };
    }

    console.log(`🔍 Validating landing page against ${this.validators.size} schema(s)...`);
    
    let overallValid = true;
    const allErrors: any[] = [];

    this.validators.forEach((validatorSet, schemaType) => {
      if (!validatorSet.landingPage) {
        return;
      }

      const config = SCHEMA_CONFIGS.find(c => c.type === schemaType);
      const displayName = config?.displayName || schemaType;

      try {
        const isValid = validatorSet.landingPage(data);
        
        if (isValid) {
          console.log(`   ✅ ${displayName}: Valid`);
        } else {
          console.warn(`   ⚠️  ${displayName}: Validation issues found`);
          overallValid = false;
          
          if (validatorSet.landingPage.errors) {
            const errors = validatorSet.landingPage.errors.map((error: any) => ({
              schema: displayName,
              path: error.instancePath || error.dataPath || 'root',
              message: `${error.instancePath || error.dataPath || ''}: ${error.message}`,
              keyword: error.keyword
            }));
            allErrors.push(...errors);
          }
        }
      } catch (error) {
        console.error(`   ❌ ${displayName}: Validation error:`, error);
        overallValid = false;
        allErrors.push({
          schema: displayName,
          message: error instanceof Error ? error.message : 'Unknown validation error'
        });
      }
    });

    return {
      valid: overallValid,
      errors: allErrors.length > 0 ? allErrors : null
    };
  }

  /**
   * Validate conformance data against all loaded schemas
   */
  public async validateConformance(data: any): Promise<{ valid: boolean; errors: any[] | null }> {
    if (this.validators.size === 0) {
      return {
        valid: true,
        errors: [{ message: 'No schemas loaded. Validation skipped.' }]
      };
    }

    console.log(`🔍 Validating conformance against ${this.validators.size} schema(s)...`);
    
    let overallValid = true;
    const allErrors: any[] = [];

    this.validators.forEach((validatorSet, schemaType) => {
      if (!validatorSet.conformance) {
        return;
      }

      const config = SCHEMA_CONFIGS.find(c => c.type === schemaType);
      const displayName = config?.displayName || schemaType;

      try {
        const isValid = validatorSet.conformance(data);
        
        if (isValid) {
          console.log(`   ✅ ${displayName}: Valid`);
        } else {
          console.warn(`   ⚠️  ${displayName}: Validation issues found`);
          overallValid = false;
          
          if (validatorSet.conformance.errors) {
            const errors = validatorSet.conformance.errors.map((error: any) => ({
              schema: displayName,
              path: error.instancePath || error.dataPath || 'root',
              message: `${error.instancePath || error.dataPath || ''}: ${error.message}`,
              keyword: error.keyword
            }));
            allErrors.push(...errors);
          }
        }
      } catch (error) {
        console.error(`   ❌ ${displayName}: Validation error:`, error);
        overallValid = false;
        allErrors.push({
          schema: displayName,
          message: error instanceof Error ? error.message : 'Unknown validation error'
        });
      }
    });

    return {
      valid: overallValid,
      errors: allErrors.length > 0 ? allErrors : null
    };
  }

  public isLoaded(): boolean {
    return this.loadedSchemas.size > 0;
  }

  public getLoadError(): string | null {
    return this.schemaLoadError;
  }

  public getLoadedSchemaCount(): number {
    return this.loadedSchemas.size;
  }

  public getLoadedSchemaUrls(): string[] {
    const urls: string[] = [];
    this.loadedSchemas.forEach((schema, schemaType) => {
      const config = SCHEMA_CONFIGS.find(c => c.type === schemaType);
      if (config) {
        urls.push(config.url);
      }
    });
    return urls;
  }
}

export default SchemaValidator;
