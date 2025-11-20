const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

// The schema for bbox items
const bboxItemSchema = {
  "description": "Each bounding box...",
  "oneOf": [
    {
      "items": {
        "type": "number"
      },
      "minItems": 4,
      "maxItems": 4,
      "type": "array"
    },
    {
      "items": {
        "type": "number"
      },
      "minItems": 6,
      "maxItems": 6,
      "type": "array"
    }
  ]
};

// Test data from swim.met.no
const testData = [-10, 56, 32, 79];

const validate = ajv.compile(bboxItemSchema);
const isValid = validate(testData);

console.log('Testing bbox item:', testData);
console.log('Is valid:', isValid);
if (!isValid) {
  console.log('Errors:', JSON.stringify(validate.errors, null, 2));
}
