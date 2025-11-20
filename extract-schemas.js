const fs = require('fs');
const path = require('path');

// Extract specific schemas from bundled OpenAPI specs
function extractFromBundled(bundledPath, componentName, outputPath) {
  try {
    console.log(`\n📖 Reading: ${bundledPath}`);
    const bundled = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
    
    let schema = null;
    
    // Try to find in components/schemas first
    if (bundled.components?.schemas?.[componentName]) {
      schema = bundled.components.schemas[componentName];
      console.log(`   ✅ Found in components/schemas/${componentName}`);
    }
    // Try components/responses
    else if (bundled.components?.responses?.[componentName]?.content?.['application/json']?.schema) {
      schema = bundled.components.responses[componentName].content['application/json'].schema;
      console.log(`   ✅ Found in components/responses/${componentName}`);
    }
    // Try paths
    else if (bundled.paths) {
      for (const [pathKey, pathValue] of Object.entries(bundled.paths)) {
        if (pathValue.get?.responses?.['200']?.content?.['application/json']?.schema) {
          const pathSchema = pathValue.get.responses['200'].content['application/json'].schema;
          // Check if this matches what we're looking for
          if (componentName === 'landingPage' && pathKey === '/') {
            schema = pathSchema;
            console.log(`   ✅ Found in path '/' response`);
            break;
          } else if (componentName === 'collections' && pathKey === '/collections') {
            schema = pathSchema;
            console.log(`   ✅ Found in path '/collections' response`);
            break;
          } else if (componentName === 'confClasses' && pathKey === '/conformance') {
            schema = pathSchema;
            console.log(`   ✅ Found in path '/conformance' response`);
            break;
          }
        }
      }
    }
    
    if (schema) {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2));
      console.log(`   ✅ Extracted to: ${outputPath}`);
      return true;
    } else {
      console.log(`   ❌ Schema '${componentName}' not found`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

console.log('=== Extracting Schemas from Bundled OpenAPI Specs ===');

let successful = 0;
let failed = 0;

// Extract EDR 1.0 schemas
console.log('\n--- EDR 1.0 ---');
if (extractFromBundled(
  'schemas/ogcapi/ogcapi-edr-1-1.0-conf-core.json',
  'landingPage',
  'schemas/individual/edr-1.0/landingPage.json'
)) successful++; else failed++;

// Collections already downloaded

// Extract EDR 1.1 schemas
console.log('\n--- EDR 1.1 ---');
if (extractFromBundled(
  'schemas/ogcapi/ogcapi-edr-1-1.1-conf-core.json',
  'landingPage',
  'schemas/individual/edr-1.1/landingPage.json'
)) successful++; else failed++;

if (extractFromBundled(
  'schemas/ogcapi/ogcapi-edr-1-1.1-conf-core.json',
  'collections',
  'schemas/individual/edr-1.1/collections.json'
)) successful++; else failed++;

if (extractFromBundled(
  'schemas/ogcapi/ogcapi-edr-1-1.1-conf-core.json',
  'confClasses',
  'schemas/individual/edr-1.1/confClasses.json'
)) successful++; else failed++;

console.log('\n=== Summary ===');
console.log(`✅ Successful: ${successful}`);
console.log(`❌ Failed: ${failed}`);
