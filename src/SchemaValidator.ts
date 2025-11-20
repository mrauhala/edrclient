import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Schema type definitions
type SchemaType = 'edr-1.0' | 'edr-1.1' | 'features-1.0' | 'common-1.0';

interface SchemaConfig {
  type: SchemaType;
  conformancePattern: string;
  displayName: string;
  schemas: {
    landingPage?: string;
    collections?: string;
    conformance?: string;
  };
}

// Configuration for all supported schemas - using individual schema files
const SCHEMA_CONFIGS: SchemaConfig[] = [
  {
    type: 'features-1.0',
    conformancePattern: '/spec/ogcapi-features-1/1.0/conf/core',
    displayName: 'OGC API Features 1.0',
    schemas: {
      landingPage: '/schemas/individual/features-1.0/landingPage.json',
      collections: '/schemas/individual/features-1.0/collections.json',
      conformance: '/schemas/individual/features-1.0/confClasses.json'
    }
  },
  {
    type: 'edr-1.1',
    conformancePattern: '/spec/ogcapi-edr-1/1.1/conf/core',
    displayName: 'OGC API EDR 1.1',
    schemas: {
      landingPage: '/schemas/individual/edr-1.1/landingPage.json',
      collections: '/schemas/individual/edr-1.1/collections.json',
      conformance: '/schemas/individual/edr-1.1/confClasses.json'
    }
  },
  {
    type: 'edr-1.0',
    conformancePattern: '/spec/ogcapi-edr-1/1.0/conf/core',
    displayName: 'OGC API EDR 1.0',
    schemas: {
      landingPage: '/schemas/individual/edr-1.0/landingPage.json',
      collections: '/schemas/individual/edr-1.0/collections.json',
      conformance: '/schemas/individual/edr-1.0/confClasses.json'
    }
  },
  {
    type: 'common-1.0',
    conformancePattern: '/spec/ogcapi-common-1/1.0/conf/core',
    displayName: 'OGC API Common 1.0',
    schemas: {
      landingPage: '/schemas/individual/common-1.0/landingPage.json',
      conformance: '/schemas/individual/common-1.0/confClasses.json'
      // Note: Common doesn't define collections
    }
  }
];

interface ValidatorSet {
  collections?: any;
  landingPage?: any;
  conformance?: any;
}

interface SchemaSet {
  collections?: any;
  landingPage?: any;
  conformance?: any;
}

// This class handles validation against multiple OGC API individual schemas
export class SchemaValidator {
  private static instance: SchemaValidator;
  private loadedSchemas: Map<SchemaType, SchemaSet> = new Map();
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
   * Load individual schema files for a specific schema type
   */
  private async loadSingleSchema(schemaType: SchemaType): Promise<boolean> {
    const config = SCHEMA_CONFIGS.find(c => c.type === schemaType);
    if (!config) {
      console.error(`❌ Unknown schema type: ${schemaType}`);
      return false;
    }

    try {
      console.log(`   📥 Loading ${config.displayName} individual schemas...`);
      
      const schemaSet: SchemaSet = {};
      const validatorSet: ValidatorSet = {};
      let loadedCount = 0;

      // Load landing page schema if available
      if (config.schemas.landingPage) {
        try {
          const response = await fetch(config.schemas.landingPage);
          if (response.ok) {
            schemaSet.landingPage = await response.json();
            validatorSet.landingPage = this.ajv.compile(schemaSet.landingPage);
            console.log(`      ✓ Landing page schema loaded`);
            loadedCount++;
          }
        } catch (error) {
          console.warn(`      ⚠️  Failed to load landing page schema:`, error);
        }
      }

      // Load collections schema if available
      if (config.schemas.collections) {
        try {
          const response = await fetch(config.schemas.collections);
          if (response.ok) {
            schemaSet.collections = await response.json();
            validatorSet.collections = this.ajv.compile(schemaSet.collections);
            console.log(`      ✓ Collections schema loaded`);
            loadedCount++;
          }
        } catch (error) {
          console.warn(`      ⚠️  Failed to load collections schema:`, error);
        }
      }

      // Load conformance schema if available
      if (config.schemas.conformance) {
        try {
          const response = await fetch(config.schemas.conformance);
          if (response.ok) {
            schemaSet.conformance = await response.json();
            validatorSet.conformance = this.ajv.compile(schemaSet.conformance);
            console.log(`      ✓ Conformance schema loaded`);
            loadedCount++;
          }
        } catch (error) {
          console.warn(`      ⚠️  Failed to load conformance schema:`, error);
        }
      }

      if (loadedCount === 0) {
        throw new Error('No schemas could be loaded');
      }

      // Store the schemas and validators
      this.loadedSchemas.set(schemaType, schemaSet);
      this.validators.set(schemaType, validatorSet);

      console.log(`   ✅ ${config.displayName}: ${loadedCount} schema(s) loaded`);
      return true;

    } catch (error) {
      console.error(`   ❌ Error loading ${config.displayName}:`, error);
      this.schemaLoadError = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
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
    this.loadedSchemas.forEach((schemaSet, schemaType) => {
      const config = SCHEMA_CONFIGS.find(c => c.type === schemaType);
      if (config) {
        if (config.schemas.landingPage) urls.push(config.schemas.landingPage);
        if (config.schemas.collections) urls.push(config.schemas.collections);
        if (config.schemas.conformance) urls.push(config.schemas.conformance);
      }
    });
    return urls;
  }
}

export default SchemaValidator;
