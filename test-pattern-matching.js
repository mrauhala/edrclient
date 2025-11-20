// Test the pattern matching logic

const conformsTo = [
  "http://www.opengis.net/spec/ogcapi-common-1/1.0/conf/core",
  "http://www.opengis.net/spec/ogcapi-common-2/1.0/conf/collections",
  "http://www.opengis.net/spec/ogcapi-edr-1/1.1/conf/core",
  "http://www.opengis.net/spec/ogcapi-edr-1/1.2/req/oas31",
  "http://www.opengis.net/spec/ogcapi-edr-1/1.0/conf/html",
  "http://www.opengis.net/spec/ogcapi-edr-1/1.0/conf/geojson",
  "http://www.opengis.net/spec/ogcapi-edr-1/1.0/conf/covjson",
  "http://www.opengis.net/spec/ogcapi-edr-1/1.0/conf/queries",
  "http://rodeo-project.eu/spec/rodeo-edr-profile/1/req/core",
  "https://schemas.wmo.int/iwxxm/3.0/"
];

const patterns = [
  { type: 'features-1.0', pattern: '/spec/ogcapi-features-1/1.0/conf/core' },
  { type: 'edr-1.1', pattern: '/spec/ogcapi-edr-1/1.1/conf/core' },
  { type: 'edr-1.0', pattern: '/spec/ogcapi-edr-1/1.0/conf/core' },
  { type: 'common-1.0', pattern: '/spec/ogcapi-common-1/1.0/conf/core' }
];

console.log('Conformance matching test:\n');
patterns.forEach(config => {
  const matches = conformsTo.filter(url => url.endsWith(config.pattern));
  console.log(`${config.type} (${config.pattern}):`);
  if (matches.length > 0) {
    matches.forEach(m => console.log(`  ✓ ${m}`));
  } else {
    console.log(`  ✗ No matches`);
  }
  console.log();
});
