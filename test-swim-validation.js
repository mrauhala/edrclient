const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
  validateFormats: true
});
addFormats(ajv);

// Load the dereferenced schema
const schema = JSON.parse(fs.readFileSync('schemas/individual/edr-1.1/collections.json', 'utf8'));

// Load the actual response from swim.met.no
const testData = JSON.parse(fs.readFileSync('/tmp/swim-collections.json', 'utf8'));

const validate = ajv.compile(schema);
const isValid = validate(testData);

console.log('Testing actual swim.met.no response');
console.log('Number of collections:', testData.collections.length);
console.log('Is valid:', isValid);
if (!isValid) {
  console.log('\nErrors:');
  validate.errors.forEach((error, index) => {
    console.log(`${index + 1}. ${error.instancePath}: ${error.message}`);
    if (error.params) {
      console.log('   Params:', JSON.stringify(error.params, null, 2));
    }
  });
}
