const fs = require('fs');
const path = require('path');
const https = require('https');
const yaml = require('js-yaml');
const $RefParser = require('@apidevtools/json-schema-ref-parser');

// Schema definitions with correct EDR paths
const schemas = [
  // OGC API Features 1.0
  {
    name: 'Features 1.0 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/landingPage.yaml',
    output: 'schemas/individual/features-1.0/landingPage.json'
  },
  {
    name: 'Features 1.0 - Collections',
    url: 'https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/collections.yaml',
    output: 'schemas/individual/features-1.0/collections.json'
  },
  {
    name: 'Features 1.0 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/confClasses.yaml',
    output: 'schemas/individual/features-1.0/confClasses.json'
  },
  
  // OGC API EDR 1.0 - flat structure
  {
    name: 'EDR 1.0 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/landingPage.yaml',
    output: 'schemas/individual/edr-1.0/landingPage.json'
  },
  {
    name: 'EDR 1.0 - Collections',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/collections.yaml',
    output: 'schemas/individual/edr-1.0/collections.json'
  },
  {
    name: 'EDR 1.0 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/confClasses.yaml',
    output: 'schemas/individual/edr-1.0/confClasses.json'
  },
  
  // OGC API EDR 1.1 - corrected paths
  {
    name: 'EDR 1.1 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/core/landingPage.yaml',
    output: 'schemas/individual/edr-1.1/landingPage.json'
  },
  {
    name: 'EDR 1.1 - Collections',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/collections/collections.yaml',
    output: 'schemas/individual/edr-1.1/collections.json'
  },
  {
    name: 'EDR 1.1 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/core/confClasses.yaml',
    output: 'schemas/individual/edr-1.1/confClasses.json'
  },
  
  // OGC API Common 1.0
  {
    name: 'Common 1.0 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/common/part1/1.0/openapi/schemas/landingPage.yaml',
    output: 'schemas/individual/common-1.0/landingPage.json'
  },
  {
    name: 'Common 1.0 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/common/part1/1.0/openapi/schemas/confClasses.yaml',
    output: 'schemas/individual/common-1.0/confClasses.json'
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
  
  for (const schema of schemas) {
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
  console.log(`❌ Failed: ${failed}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => {
      console.log(`   - ${e.schema}: ${e.error}`);
    });
  }
  
  console.log(`\nSchemas saved to: schemas/individual/`);
  
  if (successful > 0) {
    console.log('\n📋 Next steps:');
    console.log('1. Review the downloaded schemas');
    console.log('2. Copy to public directory:');
    console.log('   cp -r schemas/individual public/schemas/');
    console.log('3. Restart the app to use the updated schemas');
  }
}

main().catch(console.error);
