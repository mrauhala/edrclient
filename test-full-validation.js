const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

// Load the dereferenced schema
const schema = JSON.parse(fs.readFileSync('schemas/individual/edr-1.1/collections.json', 'utf8'));

// Test data - just one collection from swim.met.no
const testData = {
  "links": [{"href": "https://swim.met.no/collections", "rel": "self", "type": "application/json"}],
  "collections": [{
    "id": "taf",
    "title": "Aviation Weather forecast data provider for taf",
    "description": "TAF Forecasts from Met Norway",
    "keywords": ["ICAO identifier", "Opmet Data"],
    "links": [{"href": "https://swim.met.no/collections/taf", "rel": "data", "type": "collection", "title": "taf"}],
    "extent": {
      "spatial": {
        "bbox": [[-10, 56, 32, 79]],
        "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
      },
      "temporal": {
        "interval": [["2025-11-10T00:00:00Z", "2025-11-20T19:00:00Z"]],
        "trs": "http://www.opengis.net/def/uom/ISO-8601/0/Gregorian"
      }
    },
    "crs": ["http://www.opengis.net/def/crs/OGC/1.3/CRS84"],
    "output_formats": ["IWXXM", "IWXXMzip"],
    "data_queries": {
      "locations": {
        "link": {
          "href": "https://swim.met.no/collections/taf/locations",
          "hreflang": "en",
          "rel": "data",
          "variables": {
            "title": "Locations query",
            "query_type": "locations",
            "output_formats": ["IWXXM", "IWXXMzip"],
            "default_output_format": "IWXXM"
          }
        }
      }
    },
    "parameter_names": {
      "message": {
        "type": "Parameter",
        "id": "message",
        "description": "Aviation message",
        "observedProperty": {"label": "message"}
      }
    }
  }]
};

const validate = ajv.compile(schema);
const isValid = validate(testData);

console.log('Testing full collections response');
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
