const fs = require('fs');
const path = require('path');
const $RefParser = require('@apidevtools/json-schema-ref-parser');

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
    output: 'public/schemas/individual/maps-p1-v1.0/collections.json'
  },
  {
    name: 'Maps Part 1 v1.0 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/maps/part1/1.0/openapi/schemas/common-core/confClasses.yaml',
    output: 'public/schemas/individual/maps-p1-v1.0/confClasses.json'
  }
];

// Download, convert, and dereference a single schema
async function downloadAndDereference(schema) {
  console.log(`\n📥 ${schema.name}`);
  console.log(`   URL: ${schema.url}`);
  
  try {
    // Download and parse the YAML with all references resolved
    const dereferencedSchema = await $RefParser.dereference(schema.url);
    
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
  
  let successful = 0;
  let failed = 0;
  const errors = [];
  
  let skipped = 0;
  for (const schema of schemas) {
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
