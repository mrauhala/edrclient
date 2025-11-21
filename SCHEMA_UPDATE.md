# Schema Update - Proper Dereferencing

## Issue
EDR validation was not catching errors that existed previously. The schemas were not properly dereferenced - they still contained `$ref` references that needed to be resolved.

## Root Cause
1. The original `download-schemas.js` script only converted YAML to JSON but didn't resolve `$ref` references
2. EDR schema paths were incorrect:
   - EDR 1.0: Uses flat structure directly in `/schemas/`
   - EDR 1.1: Uses subdirectories `/schemas/core/` and `/schemas/collections/`

## Solution
Created `download-schemas-deref.js` script that:
1. Uses `@apidevtools/json-schema-ref-parser` to properly dereference schemas
2. Downloads schemas with correct paths for each OGC API standard
3. Resolves all `$ref` references, creating standalone schema files

## Correct Schema URLs

### OGC API Features 1.0
- Landing Page: `https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/landingPage.yaml`
- Collections: `https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/collections.yaml`
- Conformance: `https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/confClasses.yaml`

### OGC API EDR 1.0 (flat structure)
- Landing Page: `https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/landingPage.yaml`
- Collections: `https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/collections.yaml`
- Conformance: `https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/confClasses.yaml`

### OGC API EDR 1.1 (subdirectory structure)
- Landing Page: `https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/core/landingPage.yaml`
- Collections: `https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/collections/collections.yaml`
- Conformance: `https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/core/confClasses.yaml`

### OGC API Common 1.0
- Landing Page: `https://schemas.opengis.net/ogcapi/common/part1/1.0/openapi/schemas/landingPage.yaml`
- Conformance: `https://schemas.opengis.net/ogcapi/common/part1/1.0/openapi/schemas/confClasses.yaml`

## Results

All 11 schemas successfully downloaded and dereferenced:

| Standard | File | Size (Before) | Size (After) | Notes |
|----------|------|---------------|--------------|-------|
| Features 1.0 | landingPage.json | 447B | 1.1KB | Fully dereferenced |
| Features 1.0 | collections.json | 304B | 10KB | Fully dereferenced |
| Features 1.0 | confClasses.json | 264B | 264B | No refs |
| EDR 1.0 | landingPage.json | 3.4KB | 3.3KB | **Now dereferenced** |
| EDR 1.0 | collections.json | 859B | 83KB | **Now dereferenced** |
| EDR 1.0 | confClasses.json | 182B | 182B | No refs |
| EDR 1.1 | landingPage.json | 3.4KB | 3.3KB | **Now dereferenced** |
| EDR 1.1 | collections.json | 84.5KB | 83KB | **Now dereferenced** |
| EDR 1.1 | confClasses.json | 182B | 182B | No refs |
| Common 1.0 | landingPage.json | 940B | 2.1KB | Fully dereferenced |
| Common 1.0 | confClasses.json | 262B | 262B | No refs |

## Key Changes

### EDR Collections Schema
The EDR collections schema grew from 859B to 83KB after proper dereferencing because it now contains:
- All data query schemas (area, corridor, cube, trajectory, etc.) inline
- All parameter definitions inline
- All link object schemas inline
- Complete extent schemas with temporal/spatial definitions

This is why validation now properly catches errors - the validator can now see and validate against all the required properties and constraints that were previously just references.

## Testing
The schemas are now copied to `public/schemas/individual/` and the application will load them properly dereferenced. Validation should now catch all schema violations that it missed before.

## Commands Used
```bash
# Install dereferencing tool
npm install --save-dev @apidevtools/json-schema-ref-parser

# Download and dereference all schemas
node download-schemas-deref.js

# Copy to public directory
cp -r schemas/individual public/schemas/
```
