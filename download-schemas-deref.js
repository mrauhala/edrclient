const fs = require('fs');
const path = require('path');
const $RefParser = require('@apidevtools/json-schema-ref-parser');

// EDR 1.2 is not on schemas.opengis.net yet; its schemas are extracted from the
// upstream OpenAPI 3.1 bundle (entries with `component` pick components.schemas[component]).
const EDR_1_2_BUNDLE = 'https://raw.githubusercontent.com/opengeospatial/ogcapi-environmental-data-retrieval/refs/heads/master/ogcapi-environmental-data-retrieval-1-oas31.bundled.json';

// Schema definitions with correct paths and Part/Version naming
const schemas = [
  // OGC API Features Part 1 v1.0
  {
    name: 'Features Part 1 v1.0 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/landingPage.yaml',
    output: 'public/schemas/individual/features-p1-v1.0/landingPage.json'
  },
  {
    name: 'Features Part 1 v1.0 - Collections',
    url: 'https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/collections.yaml',
    output: 'public/schemas/individual/features-p1-v1.0/collections.json'
  },
  {
    name: 'Features Part 1 v1.0 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/confClasses.yaml',
    output: 'public/schemas/individual/features-p1-v1.0/confClasses.json'
  },
  
  // OGC API Features Part 2 v1.0 (CRS extension - only collections schema available)
  {
    name: 'Features Part 2 v1.0 - Collections',
    url: 'https://schemas.opengis.net/ogcapi/features/part2/1.0/openapi/schemas/collectionsExtensionCrs.yaml',
    output: 'public/schemas/individual/features-p2-v1.0/collections.json'
  },
  
  // OGC API EDR Part 1 v1.0 - flat structure
  {
    name: 'EDR Part 1 v1.0 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/landingPage.yaml',
    output: 'public/schemas/individual/edr-p1-v1.0/landingPage.json'
  },
  {
    name: 'EDR Part 1 v1.0 - Collections',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/collections.yaml',
    output: 'public/schemas/individual/edr-p1-v1.0/collections.json',
    skip: true,  // Manual fixes on top of upstream — see git history. Do not regenerate.
  },
  {
    name: 'EDR Part 1 v1.0 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/confClasses.yaml',
    output: 'public/schemas/individual/edr-p1-v1.0/confClasses.json'
  },
  
  // OGC API EDR Part 1 v1.1 - subdirectory structure
  {
    name: 'EDR Part 1 v1.1 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/core/landingPage.yaml',
    output: 'public/schemas/individual/edr-p1-v1.1/landingPage.json'
  },
  {
    name: 'EDR Part 1 v1.1 - Collections',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/collections/collections.yaml',
    output: 'public/schemas/individual/edr-p1-v1.1/collections.json',
    skip: true,  // Manual fixes on top of upstream — see git history. Do not regenerate.
  },
  {
    name: 'EDR Part 1 v1.1 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/core/confClasses.yaml',
    output: 'public/schemas/individual/edr-p1-v1.1/confClasses.json'
  },

  // OGC API EDR Part 1 v1.2 - extracted from the OpenAPI 3.1 bundle
  {
    name: 'EDR Part 1 v1.2 - Landing Page',
    url: EDR_1_2_BUNDLE,
    component: 'landingPage',
    output: 'public/schemas/individual/edr-p1-v1.2/landingPage.json'
  },
  {
    name: 'EDR Part 1 v1.2 - Collections',
    url: EDR_1_2_BUNDLE,
    component: 'collections',
    output: 'public/schemas/individual/edr-p1-v1.2/collections.json'
  },
  {
    name: 'EDR Part 1 v1.2 - Conformance',
    url: EDR_1_2_BUNDLE,
    component: 'confClasses',
    output: 'public/schemas/individual/edr-p1-v1.2/confClasses.json'
  },

  // OGC API Common Part 1 v1.0
  {
    name: 'Common Part 1 v1.0 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/common/part1/1.0/openapi/schemas/landingPage.yaml',
    output: 'public/schemas/individual/common-p1-v1.0/landingPage.json'
  },
  {
    name: 'Common Part 1 v1.0 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/common/part1/1.0/openapi/schemas/confClasses.yaml',
    output: 'public/schemas/individual/common-p1-v1.0/confClasses.json'
  },

  // OGC API Common Part 2 v1.0
  {
    name: 'Common Part 2 v1.0 - Landing Page',
    url: 'https://raw.githubusercontent.com/opengeospatial/ogcapi-common/refs/heads/master/collections/openapi/schemas/common-core/landingPage.yaml',
    output: 'public/schemas/individual/common-p2-v1.0/landingPage.json'
  },
  {
    name: 'Common Part 2 v1.0 - Conformance',
    url: 'https://raw.githubusercontent.com/opengeospatial/ogcapi-common/refs/heads/master/collections/openapi/schemas/common-core/confClasses.yaml',
    output: 'public/schemas/individual/common-p2-v1.0/confClasses.json'
  },
  {
    name: 'Common Part 2 v1.0 - Collections',
    url: 'https://raw.githubusercontent.com/opengeospatial/ogcapi-common/refs/heads/master/collections/openapi/schemas/common-geodata/collections.yaml',
    output: 'public/schemas/individual/common-p2-v1.0/collections.json'
  },
  
  // OGC API EDR Part 1 v1.0 - Locations FeatureCollection
  {
    name: 'EDR Part 1 v1.0 - Locations FeatureCollection',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/edrFeatureCollectionGeoJSON.yaml',
    output: 'public/schemas/edr/1.0/edrFeatureCollectionGeoJSON.json'
  },

  // OGC API EDR Part 1 v1.1 - Locations FeatureCollection
  {
    name: 'EDR Part 1 v1.1 - Locations FeatureCollection',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/edr-geojson/edrFeatureCollectionGeoJSON.yaml',
    output: 'public/schemas/edr/1.1/edrFeatureCollectionGeoJSON.json'
  },

  // OGC API EDR Part 1 v1.2 - Locations FeatureCollection
  {
    name: 'EDR Part 1 v1.2 - Locations FeatureCollection',
    url: EDR_1_2_BUNDLE,
    component: 'edrFeatureCollectionGeoJSON',
    output: 'public/schemas/edr/1.2/edrFeatureCollectionGeoJSON.json'
  },

  // OGC API Records Part 1 v1.0 - top level structure (no conformance schema available)
  {
    name: 'Records Part 1 v1.0 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/records/part1/1.0/openapi/schemas/landingPage.yaml',
    output: 'public/schemas/individual/records-p1-v1.0/landingPage.json'
  },
  {
    name: 'Records Part 1 v1.0 - Catalogs',
    url: 'https://schemas.opengis.net/ogcapi/records/part1/1.0/openapi/schemas/catalogs.yaml',
    output: 'public/schemas/individual/records-p1-v1.0/catalogs.json'
  },

  // OGC API Maps Part 1 v1.0 - reuses common-core/common-geodata shapes; only adds conformance + link rels.
  {
    name: 'Maps Part 1 v1.0 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/maps/part1/1.0/openapi/schemas/common-core/landingPage.yaml',
    output: 'public/schemas/individual/maps-p1-v1.0/landingPage.json'
  },
  {
    name: 'Maps Part 1 v1.0 - Collections',
    url: 'https://schemas.opengis.net/ogcapi/maps/part1/1.0/openapi/schemas/common-geodata/collections.yaml',
    output: 'public/schemas/individual/maps-p1-v1.0/collections.json',
    // Manual fix on top of upstream: the UAD extent's allOf[1] omits spatial/temporal from
    // its `properties`, causing additionalProperties to misclassify them. We declare them
    // as known properties (value `true`) so they're excluded from the dimension oneOf.
    skip: true,
  },
  {
    name: 'Maps Part 1 v1.0 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/maps/part1/1.0/openapi/schemas/common-core/confClasses.yaml',
    output: 'public/schemas/individual/maps-p1-v1.0/confClasses.json'
  },

  // OpenAPI 3.0 and 3.1 schemas, used to validate servers' API definitions (service-desc).
  // Kept as published, with the small transforms below so AJV can run them.
  {
    name: 'OpenAPI 3.0 - Schema',
    url: 'https://spec.openapis.org/oas/3.0/schema/2021-09-28',
    output: 'public/schemas/openapi/3.0/schema.json',
    raw: true,
    transform: openApi30ForAjv,
  },
  {
    name: 'OpenAPI 3.1 - Schema',
    url: 'https://spec.openapis.org/oas/3.1/schema/2022-10-07',
    output: 'public/schemas/openapi/3.1/schema.json',
    raw: true,
    transform: openApi31ForAjv,
  }
];

// The OpenAPI 3.0 schema is draft-04; AJV runs draft-07+. Drop $schema, use $id, and turn
// the one draft-04 boolean exclusiveMinimum (Schema.multipleOf) into its numeric form.
function openApi30ForAjv(schema) {
  delete schema.$schema;
  schema.$id = schema.id;
  delete schema.id;
  let fixed = 0;
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.exclusiveMinimum === true) {
      node.exclusiveMinimum = node.minimum;
      delete node.minimum;
      fixed++;
    }
    Object.values(node).forEach(visit);
  };
  visit(schema);
  if (fixed !== 1) throw new Error(`Expected 1 boolean exclusiveMinimum, found ${fixed}: the schema changed, review the transform`);
  return schema;
}

// AJV's $dynamicRef support can't handle the 3.1 schema's "#meta" anchor (every document fails).
// In the base dialect it points at #/$defs/schema, so use a plain $ref.
function openApi31ForAjv(schema) {
  const text = JSON.stringify(schema);
  const count = (text.match(/"\$dynamicRef":"#meta"/g) || []).length;
  if (count !== 4) throw new Error(`Expected 4 $dynamicRef "#meta", found ${count}: the schema changed, review the transform`);
  return JSON.parse(text.replace(/"\$dynamicRef":"#meta"/g, '"$ref":"#/$defs/schema"'));
}

// Bundles are downloaded once and shared by all entries that extract from them
const parsedBundles = new Map();

function parseBundle(url) {
  if (!parsedBundles.has(url)) {
    parsedBundles.set(url, $RefParser.parse(url));
  }
  return parsedBundles.get(url);
}

const COMPONENT_REF_PREFIX = '#/components/schemas/';

// Build a standalone document for one bundle component: the component plus only the
// component schemas it references (transitively). Leaving the rest of the bundle out
// keeps unrelated broken refs (e.g. the embedded CoverageJSON schema's unresolvable
// #/definitions/* refs in the EDR 1.2 bundle) from failing the dereference.
function componentDocument(bundle, name) {
  const all = bundle.components?.schemas ?? {};
  if (!all[name]) {
    throw new Error(`Component schema "${name}" not found in bundle`);
  }
  const needed = {};
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if (typeof node.$ref === 'string' && node.$ref.startsWith(COMPONENT_REF_PREFIX)) {
      const dep = node.$ref.slice(COMPONENT_REF_PREFIX.length);
      if (!(dep in needed)) {
        needed[dep] = all[dep];
        visit(all[dep]);
      }
    }
    Object.values(node).forEach(visit);
  };
  visit(all[name]);
  // Clone: $RefParser mutates its input and the parsed bundle is shared between entries
  return structuredClone({ ...all[name], components: { schemas: needed } });
}

// Download, convert, and dereference a single schema
async function downloadAndDereference(schema) {
  console.log(`\n📥 ${schema.name}`);
  console.log(`   URL: ${schema.url}${schema.component ? ` (#/components/schemas/${schema.component})` : ''}`);

  try {
    // Download and parse the YAML with all references resolved
    let dereferencedSchema;
    if (schema.raw) {
      // Used as published (these schemas are recursive, so not dereferenced)
      const response = await fetch(schema.url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      dereferencedSchema = schema.transform(await response.json());
    } else if (schema.component) {
      const bundle = await parseBundle(schema.url);
      dereferencedSchema = await $RefParser.dereference(componentDocument(bundle, schema.component));
      delete dereferencedSchema.components;
    } else {
      dereferencedSchema = await $RefParser.dereference(schema.url);
    }

    console.log(`   ✅ Downloaded and dereferenced`);
    
    // Ensure output directory exists
    const outputDir = path.dirname(schema.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write dereferenced JSON
    fs.writeFileSync(
      schema.output,
      JSON.stringify(dereferencedSchema, null, 2)
    );
    
    const stats = fs.statSync(schema.output);
    console.log(`   ✅ Saved to: ${schema.output} (${(stats.size / 1024).toFixed(2)} KB)`);
    
  } catch (error) {
    throw error;
  }
}

// Main execution
async function main() {
  console.log('=== Downloading and Dereferencing OGC API Schemas ===\n');
  console.log('This script will:');
  console.log('1. Download YAML schemas from schemas.opengis.net');
  console.log('2. Resolve all $ref references');
  console.log('3. Save as standalone JSON files\n');

  // Optional name filter, e.g. `node download-schemas-deref.js "EDR Part 1 v1.2"`
  const filter = process.argv[2];
  const selected = filter ? schemas.filter(s => s.name.includes(filter)) : schemas;
  if (filter) {
    console.log(`Filter "${filter}": ${selected.length} of ${schemas.length} schemas selected`);
  }

  let successful = 0;
  let failed = 0;
  const errors = [];

  let skipped = 0;
  for (const schema of selected) {
    if (schema.skip) {
      console.log(`\n⏭️  ${schema.name} — skipped (manual fixes in tree)`);
      skipped++;
      continue;
    }
    try {
      await downloadAndDereference(schema);
      successful++;
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      errors.push({ schema: schema.name, error: error.message });
      failed++;
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`✅ Successful: ${successful}`);
  console.log(`⏭️  Skipped:    ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => {
      console.log(`   - ${e.schema}: ${e.error}`);
    });
  }
  
  console.log(`\nSchemas saved to: public/schemas/individual/`);
  
  if (successful > 0) {
    console.log('\n📋 Next steps:');
    console.log('1. Review the downloaded schemas');
    console.log('2. Restart the app to use the updated schemas');
  }
}

main().catch(console.error);
