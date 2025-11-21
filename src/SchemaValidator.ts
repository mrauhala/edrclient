import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Schema type definitions
type SchemaType = 'edr-p1-v1.0' | 'edr-p1-v1.1' | 'features-p1-v1.0' | 'features-p2-v1.0' | 'common-p1-v1.0' | 'records-p1-v1.0';

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
    type: 'features-p1-v1.0',
    conformancePattern: '/spec/ogcapi-features-1/1.0/conf/core',
    displayName: 'OGC API Features Part 1 v1.0',
    schemas: {
      landingPage: '/schemas/individual/features-p1-v1.0/landingPage.json',
      collections: '/schemas/individual/features-p1-v1.0/collections.json',
      conformance: '/schemas/individual/features-p1-v1.0/confClasses.json'
    }
  },
  {
    type: 'features-p2-v1.0',
    conformancePattern: '/spec/ogcapi-features-2/1.0/conf/crs',
    displayName: 'OGC API Features Part 2 v1.0 (CRS)',
    schemas: {
      // Features Part 2 only defines CRS extensions for collections, no landing page or conformance
      collections: '/schemas/individual/features-p2-v1.0/collections.json'
    }
  },
  {
    type: 'edr-p1-v1.1',
    conformancePattern: '/spec/ogcapi-edr-1/1.1/conf/core',
    displayName: 'OGC API EDR Part 1 v1.1',
    schemas: {
      landingPage: '/schemas/individual/edr-p1-v1.1/landingPage.json',
      collections: '/schemas/individual/edr-p1-v1.1/collections.json',
      conformance: '/schemas/individual/edr-p1-v1.1/confClasses.json'
    }
  },
  {
    type: 'edr-p1-v1.0',
    conformancePattern: '/spec/ogcapi-edr-1/1.0/conf/core',
    displayName: 'OGC API EDR Part 1 v1.0',
    schemas: {
      landingPage: '/schemas/individual/edr-p1-v1.0/landingPage.json',
      collections: '/schemas/individual/edr-p1-v1.0/collections.json',
      conformance: '/schemas/individual/edr-p1-v1.0/confClasses.json'
    }
  },
  {
    type: 'common-p1-v1.0',
    conformancePattern: '/spec/ogcapi-common-1/1.0/conf/core',
    displayName: 'OGC API Common Part 1 v1.0',
    schemas: {
      landingPage: '/schemas/individual/common-p1-v1.0/landingPage.json',
      conformance: '/schemas/individual/common-p1-v1.0/confClasses.json'
      // Note: Common doesn't define collections
    }
  },
  {
    type: 'records-p1-v1.0',
    conformancePattern: '/spec/ogcapi-records-1/1.0/conf/core',
    displayName: 'OGC API Records Part 1 v1.0',
    schemas: {
      landingPage: '/schemas/individual/records-p1-v1.0/landingPage.json',
      collections: '/schemas/individual/records-p1-v1.0/catalogs.json'
      // Note: Records doesn't have a conformance schema
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
   * Clears previously loaded schemas to ensure only matching schemas are used
   */
  public async loadSchemaBasedOnConformance(conformsTo?: string[]): Promise<boolean> {
    if (!conformsTo || conformsTo.length === 0) {
      console.log('🎯 No conformance classes provided, defaulting to EDR Part 1 v1.1 schema');
      // Clear existing schemas before loading default
      this.loadedSchemas.clear();
      this.validators.clear();
      return this.loadSingleSchema('edr-p1-v1.1');
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
      console.log('🎯 No matching conformance classes found, defaulting to EDR Part 1 v1.1 schema');
      // Clear existing schemas before loading default
      this.loadedSchemas.clear();
      this.validators.clear();
      return this.loadSingleSchema('edr-p1-v1.1');
    }

    // Clear existing schemas to ensure only matching schemas are loaded
    console.log(`🧹 Clearing previously loaded schemas...`);
    this.loadedSchemas.clear();
    this.validators.clear();

    // Load all matching schemas
    console.log(`📥 Loading ${matchingSchemas.length} schema(s)...`);
    let allSuccess = true;
    
    for (const config of matchingSchemas) {
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
  public async validateCollections(data: any): Promise<{ 
    valid: boolean; 
    errors: any[] | null; 
    collectionErrors?: { [collectionId: string]: any[] };
    schemaResults?: Array<{ schema: string; isValid: boolean }>;
  }> {
    if (this.validators.size === 0) {
      return {
        valid: true,
        errors: [{ message: 'No schemas loaded. Validation skipped.' }]
      };
    }

    console.log(`\n🔍 Validating collections against ${this.validators.size} schema(s)...`);
    const schemaNames = Array.from(this.validators.keys()).map(type => {
      const config = SCHEMA_CONFIGS.find(c => c.type === type);
      return config?.displayName || type;
    }).join(', ');
    console.log(`   Schemas: ${schemaNames}\n`);
    
    let overallValid = true;
    const allErrors: any[] = [];
    const collectionErrors: { [collectionId: string]: any[] } = {};
    const schemaResults: Array<{ schema: string; isValid: boolean }> = [];

    // Extract collection IDs from the data for mapping errors
    const collections = data?.collections || [];
    const collectionIndexMap: { [index: number]: string } = {};
    collections.forEach((col: any, index: number) => {
      if (col.id) {
        collectionIndexMap[index] = col.id;
      }
    });

    // Validate against each loaded schema
    this.validators.forEach((validatorSet, schemaType) => {
      if (!validatorSet.collections) {
        return;
      }

      const config = SCHEMA_CONFIGS.find(c => c.type === schemaType);
      const displayName = config?.displayName || schemaType;

      try {
        const isValid = validatorSet.collections(data);
        
        // Record this schema's result
        schemaResults.push({
          schema: displayName,
          isValid: isValid
        });
        
        if (isValid) {
          console.log(`   ✅ ${displayName}: Valid`);
        } else {
          console.warn(`   ❌ ${displayName}: Validation FAILED`);
          overallValid = false;
          
          // Add schema-specific errors
          if (validatorSet.collections.errors) {
            const errors = validatorSet.collections.errors.map((error: any) => ({
              schema: displayName,
              schemaType: schemaType,
              path: error.instancePath || error.dataPath || 'root',
              message: `${error.instancePath || error.dataPath || ''}: ${error.message}`,
              keyword: error.keyword
            }));
            
            // Group errors by collection
            errors.forEach((err: any) => {
              // Parse path to extract collection index: /collections/0/... or /collections/1/...
              const pathMatch = err.path.match(/^\/collections\/(\d+)/);
              if (pathMatch) {
                const collectionIndex = parseInt(pathMatch[1], 10);
                const collectionId = collectionIndexMap[collectionIndex];
                if (collectionId) {
                  if (!collectionErrors[collectionId]) {
                    collectionErrors[collectionId] = [];
                  }
                  collectionErrors[collectionId].push(err);
                }
              }
            });
            
            // Log first few errors for this schema
            console.warn(`      Errors from ${displayName}:`);
            errors.slice(0, 3).forEach((err: any) => {
              console.warn(`        • ${err.message}`);
            });
            if (errors.length > 3) {
              console.warn(`        ... and ${errors.length - 3} more errors`);
            }
            
            allErrors.push(...errors);
          }
        }
      } catch (error) {
        console.error(`   ❌ ${displayName}: Validation error:`, error);
        overallValid = false;
        schemaResults.push({
          schema: displayName,
          isValid: false
        });
        allErrors.push({
          schema: displayName,
          schemaType: schemaType,
          message: error instanceof Error ? error.message : 'Unknown validation error'
        });
      }
    });

    if (overallValid) {
      console.log(`\n✅ All validations passed!\n`);
    } else {
      console.warn(`\n⚠️  Validation completed with ${allErrors.length} error(s) across ${this.validators.size} schema(s)\n`);
    }

    return {
      valid: overallValid,
      errors: allErrors.length > 0 ? allErrors : null,
      collectionErrors: Object.keys(collectionErrors).length > 0 ? collectionErrors : undefined,
      schemaResults: schemaResults.length > 0 ? schemaResults : undefined
    };
  }

  /**
   * Validate landing page data against all loaded schemas
   */
  public async validateLandingPage(data: any): Promise<{ 
    valid: boolean; 
    errors: any[] | null;
    schemaResults?: Array<{ schema: string; isValid: boolean }>;
  }> {
    if (this.validators.size === 0) {
      return {
        valid: true,
        errors: [{ message: 'No schemas loaded. Validation skipped.' }]
      };
    }

    console.log(`🔍 Validating landing page against ${this.validators.size} schema(s)...`);
    
    let overallValid = true;
    const allErrors: any[] = [];
    const schemaResults: Array<{ schema: string; isValid: boolean }> = [];

    this.validators.forEach((validatorSet, schemaType) => {
      if (!validatorSet.landingPage) {
        return;
      }

      const config = SCHEMA_CONFIGS.find(c => c.type === schemaType);
      const displayName = config?.displayName || schemaType;

      try {
        const isValid = validatorSet.landingPage(data);
        
        // Record this schema's result
        schemaResults.push({
          schema: displayName,
          isValid: isValid
        });
        
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
        schemaResults.push({
          schema: displayName,
          isValid: false
        });
        allErrors.push({
          schema: displayName,
          message: error instanceof Error ? error.message : 'Unknown validation error'
        });
      }
    });

    return {
      valid: overallValid,
      errors: allErrors.length > 0 ? allErrors : null,
      schemaResults: schemaResults.length > 0 ? schemaResults : undefined
    };
  }

  /**
   * Validate conformance data against all loaded schemas
   */
  public async validateConformance(data: any): Promise<{ 
    valid: boolean; 
    errors: any[] | null;
    schemaResults?: Array<{ schema: string; isValid: boolean }>;
  }> {
    if (this.validators.size === 0) {
      return {
        valid: true,
        errors: [{ message: 'No schemas loaded. Validation skipped.' }]
      };
    }

    console.log(`🔍 Validating conformance against ${this.validators.size} schema(s)...`);
    
    let overallValid = true;
    const allErrors: any[] = [];
    const schemaResults: Array<{ schema: string; isValid: boolean }> = [];

    this.validators.forEach((validatorSet, schemaType) => {
      if (!validatorSet.conformance) {
        return;
      }

      const config = SCHEMA_CONFIGS.find(c => c.type === schemaType);
      const displayName = config?.displayName || schemaType;

      try {
        const isValid = validatorSet.conformance(data);
        
        // Record this schema's result
        schemaResults.push({
          schema: displayName,
          isValid: isValid
        });
        
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
        schemaResults.push({
          schema: displayName,
          isValid: false
        });
        allErrors.push({
          schema: displayName,
          message: error instanceof Error ? error.message : 'Unknown validation error'
        });
      }
    });

    return {
      valid: overallValid,
      errors: allErrors.length > 0 ? allErrors : null,
      schemaResults: schemaResults.length > 0 ? schemaResults : undefined
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
