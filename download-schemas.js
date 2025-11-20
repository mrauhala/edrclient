const fs = require('fs');
const path = require('path');
const https = require('https');
const yaml = require('js-yaml');

// Schema definitions
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
  
  // OGC API EDR 1.0
  {
    name: 'EDR 1.0 - Landing Page',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/core/landingPage.yaml',
    output: 'schemas/individual/edr-1.0/landingPage.json'
  },
  {
    name: 'EDR 1.0 - Collections',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/collections/collections.yaml',
    output: 'schemas/individual/edr-1.0/collections.json'
  },
  {
    name: 'EDR 1.0 - Conformance',
    url: 'https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/core/confClasses.yaml',
    output: 'schemas/individual/edr-1.0/confClasses.json'
  },
  
  // OGC API EDR 1.1
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

// Download and convert a single schema
function downloadAndConvert(schema) {
  return new Promise((resolve, reject) => {
    console.log(`\n📥 ${schema.name}`);
    console.log(`   URL: ${schema.url}`);
    
    https.get(schema.url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          console.log(`   ✅ Downloaded YAML`);
          
          // Parse YAML
          const jsonData = yaml.load(data);
          
          // Ensure output directory exists
          const outputDir = path.dirname(schema.output);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Write JSON
          fs.writeFileSync(
            schema.output,
            JSON.stringify(jsonData, null, 2)
          );
          
          console.log(`   ✅ Converted to JSON: ${schema.output}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Main execution
async function main() {
  console.log('=== Downloading and Converting OGC API Schemas ===\n');
  
  let successful = 0;
  let failed = 0;
  
  for (const schema of schemas) {
    try {
      await downloadAndConvert(schema);
      successful++;
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`\nSchemas saved to: schemas/individual/`);
  
  if (successful > 0) {
    console.log('\n📋 Next steps:');
    console.log('1. Review the downloaded schemas');
    console.log('2. Copy to public directory:');
    console.log('   cp -r schemas/individual public/schemas/');
    console.log('3. Update SchemaValidator.ts to use individual schemas');
  }
}

main().catch(console.error);
