export interface AuthCredentials {
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyParam?: string;
    bearerToken?: string;
    customAuthHeader?: string;
}

export interface DataQuery {
    link: Link;
}

export interface DataQueries {
    [key: string]: DataQuery;
}

export interface QueryVariables {
    default_output_format?: string;
    output_formats?: string[];
    [key: string]: any; // Allow other query-specific variables
}

export interface Link {
    title?: string;
    href?: string | { [lang: string]: string }; // Can be string or object with language codes (e.g., {en: "...", fr: "..."})
    rel?: string; // Optional to handle missing rel
    type?: string; // Optional to handle missing type
    variables?: QueryVariables;
}

export interface Spatial {
    bbox?: number[][] | number[]; // EDR standard: array of bbox arrays, or legacy flat array - now optional
    crs?: string; // Also optional since some extents might be empty
}

export interface Temporal {
    interval?: (string | null)[][]; // Array of ISO 8601 date interval arrays, null values indicate open intervals
    values?: string[]; // Array of ISO 8601 datestrings for specific time points/intervals
    trs?: string; // Temporal reference system, defaults to Gregorian
}

export interface Vertical {
    interval?: (number | string | null)[][]; // Array of level value arrays, can be strings or numbers for min/max vertical levels
    values?: (number | string)[]; // Array of height values supported by the collection, can be strings or numbers
    vrs?: string; // Vertical reference system, follows Well Known Text standard
}

export interface CustomDimension {
    id: string; // Dimension name/identifier
    interval?: (number | string | null)[]; // Min/max values for the dimension
    reference?: string; // Reference/unit for the dimension (e.g., "minutes")
    values?: (number | string)[]; // Specific values supported by the dimension
}

export interface Extent {
    spatial?: Spatial; // Made optional to handle empty extent objects
    temporal?: Temporal; // Made optional to handle missing temporal extent
    vertical?: Vertical; // Made optional to handle missing vertical extent
    custom?: CustomDimension[]; // Custom dimensions array
}

export interface parameterNames {
    id: string;
    type: string;
    label?: string;
    description?: string;
    observedProperty: any;
}

// Aviation Weather specific parameter structure
export interface ParameterDefinition {
    id?: string;
    type?: string;
    description?: string;
    unit?: any;
    observedProperty?: any;
}

export interface Collection {
  id: string;
  title?: string;
  description?: string;
  keywords?: string[];
  links: Link[];
  data_queries: DataQueries;
  extent?: Extent; // Made optional to handle missing or empty extent
  crs: string[];
  output_formats: string[] | null; // Can be null in non-conforming APIs
  parameter_names?: parameterNames[] | { [key: string]: ParameterDefinition }; // Support both formats
  itemType?: string; // Optional item type field
  assets?: {
    thumbnail?: {
      href: string;
      type?: string;
      roles?: string[];
      title?: string;
    };
    [key: string]: any; // Allow other asset types
  };
}

export interface ValidationError {
  message: string;
  title?: string;
  type?: 'cors' | 'network' | 'schema' | 'unknown';
  path?: string;
  keyword?: string;
  allowedValues?: any;
  schema?: any;
  data?: any;
  params?: Record<string, any>;
  collectionId?: string;
  section?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[] | null;
  schemaCount?: number;
  schemaUrls?: string[];
  collectionErrors?: { [collectionId: string]: ValidationError[] };
  landingPageValidation?: {
    isValid: boolean;
    errors: ValidationError[] | null;
    schemaResults?: Array<{ schema: string; isValid: boolean }>;
  };
  collectionsValidation?: {
    isValid: boolean;
    errors: ValidationError[] | null;
    schemaResults?: Array<{ schema: string; isValid: boolean }>;
  };
  conformanceValidation?: {
    isValid: boolean;
    errors: ValidationError[] | null;
    schemaResults?: Array<{ schema: string; isValid: boolean }>;
  };
  locationsValidation?: {
    isValid: boolean;
    errors: ValidationError[] | null;
    schemaResults?: Array<{ schema: string; isValid: boolean }>;
  };
}

export interface CollectionsResponse {
  collections: Collection[];
  links?: Link[]; // Top-level links (may include license, self, etc.)
}

export interface LandingPage {
  title?: string;
  description?: string;
  keywords?: string[];
  links: Link[];
}

export interface GetCollectionsResult {
  collections: Collection[];
  validation: ValidationResult;
  landingPageUrl?: string;
  collectionsUrl?: string;
  conformanceUrl?: string;
  landingPageTitle?: string;
  landingPageDescription?: string;
  serviceDescUrl?: string;
  conformsTo?: string[]; // OGC API conformance classes
  landingPageLinks?: Link[]; // Links from the landing page
  landingPageKeywords?: string[]; // Keywords from the landing page
  collectionsLinks?: Link[]; // Top-level links from the /collections endpoint response
  // Raw API responses for validation error inspection
  rawResponses?: {
    landingPage?: unknown;
    collections?: unknown;
    conformance?: unknown;
  };
}

export interface LocationQueryResult {
  type: string;
  features: any[];
}
