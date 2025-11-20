# Schema Validation Improvements Summary

## Issues Fixed

### 1. ✅ Schema Persistence Across API Calls
**Problem**: Schemas from previous API calls persisted in memory, causing validation against incorrect schema versions.

**Example**: Testing swim.met.no (EDR 1.1 + Common 1.0) after testing another service (EDR 1.0) would validate against all three schema types, causing false errors.

**Solution**: 
- Clear `loadedSchemas` and `validators` maps before loading new schemas
- Each API call now starts fresh with only matching schemas

### 2. ✅ Unclear Error Sources
**Problem**: Validation errors didn't indicate which schema they came from.

**Example**: Error message was just:
```
/collections/0/extent/spatial/bbox/0: must match exactly one schema in oneOf
```
Impossible to know if this was from EDR 1.0, EDR 1.1, or Common 1.0.

**Solution**:
- Added schema name prefix in UI: `[OGC API EDR 1.0] /collections/0/extent/spatial/bbox/0: ...`
- Enhanced console logging with per-schema error grouping
- Added `schemaType` field to error objects

### 3. ✅ Confusing Schema Count Display
**Problem**: Chip showed "Schemas: 1" but list showed 3 files, causing confusion.

**Explanation**: 
- Schema Types = Number of OGC API standards (EDR 1.1, Common 1.0, etc.)
- Schema Files = Number of individual JSON files (landingPage.json, collections.json, confClasses.json)

**Solution**:
- Changed to "Schema Types: 2" (clear what it counts)
- Added "Schema Files: 5" chip (shows individual files)
- Used outlined variant to differentiate the two counts

## Current Behavior

### For swim.met.no (conformance: EDR 1.1 + Common 1.0)

**Loaded Schemas**:
- ✅ OGC API EDR 1.1 (3 files)
- ✅ OGC API Common 1.0 (2 files)
- ❌ EDR 1.0 NOT loaded (correctly excluded)

**UI Display**:
```
Schema Types: 2    Schema Files: 5
```

**Console Output**:
```
🎯 Analyzing 10 conformance classes...
   ✓ Found: OGC API Common 1.0
   ✓ Found: OGC API EDR 1.1
🧹 Clearing previously loaded schemas...
📥 Loading 2 schema(s)...
   ✅ OGC API Common 1.0: 2 schema(s) loaded
   ✅ OGC API EDR 1.1: 3 schema(s) loaded

🔍 Validating collections against 2 schema(s)...
   Schemas: OGC API Common 1.0, OGC API EDR 1.1

   ✅ OGC API EDR 1.1: Valid
```

**Error Display** (when applicable):
```
Schema differences:
[OGC API EDR 1.0] /collections/0/extent/spatial/bbox/0: must match exactly one schema in oneOf
```

## Technical Changes

### SchemaValidator.ts
1. Added schema clearing in `loadSchemaBasedOnConformance()`:
   ```typescript
   this.loadedSchemas.clear();
   this.validators.clear();
   ```

2. Enhanced error objects with schema information:
   ```typescript
   {
     schema: displayName,
     schemaType: schemaType,
     path: error.instancePath,
     message: `${error.instancePath}: ${error.message}`,
     keyword: error.keyword
   }
   ```

3. Improved console logging:
   - Show which schemas are being validated against
   - Group errors by schema
   - Show first 3 errors per schema
   - Summary of validation results

### ValidationResult.tsx
1. Added schema name prefix to error messages:
   ```tsx
   {error.schema && <strong>[{error.schema}] </strong>}
   {error.message}
   ```

2. Split schema count display:
   ```tsx
   <Chip label={`Schema Types: ${validation.schemaCount}`} />
   <Chip label={`Schema Files: ${validation.schemaUrls.length}`} variant="outlined" />
   ```

## Benefits

1. **Accurate Validation**: Only validates against schemas that the API actually conforms to
2. **Clear Error Attribution**: Immediately see which schema detected each error
3. **Better Debugging**: Console logs show validation flow and schema matching
4. **Intuitive UI**: Clear distinction between schema types and individual files
5. **No False Positives**: Eliminates errors from incompatible schema versions

## Testing

Tested with:
- ✅ swim.met.no (EDR 1.1 + Common 1.0) - No false EDR 1.0 errors
- ✅ Console logging shows correct schemas loaded
- ✅ UI clearly shows schema types vs files
- ✅ Errors properly attributed to source schema
