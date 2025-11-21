# OGC API Schema Naming Convention

## Issue
The schema naming was using ambiguous version numbers like "EDR 1.0" and "Features 1.0", which doesn't reflect the actual OGC API structure where specifications have both **Part numbers** and **Version numbers**.

## OGC API Structure
OGC APIs are organized as:
- **Part X**: Defines different aspects/extensions of the API
- **Version Y.Z**: Version of that specific part

### Examples:
- **OGC API Features**:
  - Part 1 v1.0: Core functionality
  - Part 2 v1.0: CRS extensions
  - Part 3 v1.0: Filtering
  
- **OGC API EDR**:
  - Part 1 v1.0: Initial release
  - Part 1 v1.1: Updated version of Part 1

## New Naming Convention

### Format: `{api}-p{part}-v{version}`

| Old Name | New Name | Description |
|----------|----------|-------------|
| `features-1.0` | `features-p1-v1.0` | Features Part 1 Version 1.0 |
| `features-2.0` | `features-p2-v1.0` | Features Part 2 Version 1.0 |
| `edr-1.0` | `edr-p1-v1.0` | EDR Part 1 Version 1.0 |
| `edr-1.1` | `edr-p1-v1.1` | EDR Part 1 Version 1.1 |
| `common-1.0` | `common-p1-v1.0` | Common Part 1 Version 1.0 |

## Supported Schemas (Updated)

### 1. OGC API Features Part 1 v1.0
- **Conformance**: `/spec/ogcapi-features-1/1.0/conf/core`
- **Schemas**: landingPage, collections, conformance
- **Directory**: `schemas/individual/features-p1-v1.0/`

### 2. OGC API Features Part 2 v1.0 (CRS) ✨ NEW
- **Conformance**: `/spec/ogcapi-features-2/1.0/conf/crs`
- **Schemas**: collections (CRS extensions only)
- **Directory**: `schemas/individual/features-p2-v1.0/`
- **Note**: Part 2 only extends collections with CRS support, no landing page or conformance schemas

### 3. OGC API EDR Part 1 v1.0
- **Conformance**: `/spec/ogcapi-edr-1/1.0/conf/core`
- **Schemas**: landingPage, collections, conformance
- **Directory**: `schemas/individual/edr-p1-v1.0/`

### 4. OGC API EDR Part 1 v1.1
- **Conformance**: `/spec/ogcapi-edr-1/1.1/conf/core`
- **Schemas**: landingPage, collections, conformance
- **Directory**: `schemas/individual/edr-p1-v1.1/`

### 5. OGC API Common Part 1 v1.0
- **Conformance**: `/spec/ogcapi-common-1/1.0/conf/core`
- **Schemas**: landingPage, conformance (no collections)
- **Directory**: `schemas/individual/common-p1-v1.0/`

### 6. OGC API Records Part 1 v1.0 ✨ NEW
- **Conformance**: `/spec/ogcapi-records-1/1.0/conf/core`
- **Schemas**: landingPage, catalogs (as collections)
- **Directory**: `schemas/individual/records-p1-v1.0/`
- **Note**: Records uses catalogs instead of collections, no conformance schema available

## TypeScript Types

```typescript
type SchemaType = 
  | 'features-p1-v1.0'
  | 'features-p2-v1.0'
  | 'edr-p1-v1.0'
  | 'edr-p1-v1.1'
  | 'common-p1-v1.0'
  | 'records-p1-v1.0';
```

## Display Names

User-friendly names shown in UI and logs:
- "OGC API Features Part 1 v1.0"
- "OGC API Features Part 2 v1.0 (CRS)"
- "OGC API EDR Part 1 v1.0"
- "OGC API EDR Part 1 v1.1"
- "OGC API Common Part 1 v1.0"
- "OGC API Records Part 1 v1.0"

## Benefits

1. ✅ **Accurate**: Reflects actual OGC API specification structure
2. ✅ **Scalable**: Easy to add new parts (e.g., Features Part 3)
3. ✅ **Clear**: No confusion between part numbers and version numbers
4. ✅ **Consistent**: Same pattern across all OGC API types
5. ✅ **Future-proof**: Supports multiple parts with multiple versions

## Migration

All schema directories and references have been updated:
- ✅ `schemas/individual/` - Source schemas
- ✅ `public/schemas/individual/` - Public schemas
- ✅ `SchemaValidator.ts` - Type definitions and configurations
- ✅ `download-schemas-deref.js` - Download script

No user action required - changes are backward compatible as URL patterns match the same conformance classes.
