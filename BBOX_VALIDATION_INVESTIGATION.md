# bbox Validation Issue Investigation

## Issue Reported
After updating to dereferenced schemas, getting validation errors for swim.met.no:
```
/collections/0/extent/spatial/bbox/0: must match exactly one schema in oneOf
/collections/1/extent/spatial/bbox/0: must match exactly one schema in oneOf
/collections/2/extent/spatial/bbox/0: must match exactly one schema in oneOf
```

## Data Structure
swim.met.no collections endpoint returns bbox as:
```json
{
  "extent": {
    "spatial": {
      "bbox": [[-10, 56, 32, 79]]
    }
  }
}
```

## Schema Definition (EDR 1.1)
The bbox schema in `schemas/individual/edr-1.1/collections.json`:
```json
{
  "bbox": {
    "type": "array",
    "minItems": 1,
    "items": {
      "oneOf": [
        {
          "items": { "type": "number" },
          "minItems": 4,
          "maxItems": 4,
          "type": "array"
        },
        {
          "items": { "type": "number" },
          "minItems": 6,
          "maxItems": 6,
          "type": "array"
        }
      ]
    }
  }
}
```

This means:
- `bbox` is an array of arrays
- Each inner array must be either 4 numbers OR 6 numbers

The data `bbox[0] = [-10, 56, 32, 79]` **matches** the first oneOf option (array of 4 numbers).

## Validation Tests

### Test 1: Isolated bbox item
```javascript
const testData = [-10, 56, 32, 79];
// Result: VALID ✅
```

### Test 2: Full collections response with sample data
```javascript
const testData = { /* simplified swim.met.no data */ };
// Result: VALID ✅
```

### Test 3: Actual swim.met.no response (all 3 collections)
```javascript
const testData = JSON.parse(fs.readFileSync('/tmp/swim-collections.json'));
// Result: VALID ✅
```

## Conclusion

**The dereferenced schemas are correct and the swim.met.no data is VALID.**

All Node.js validation tests pass successfully. The validation errors you're seeing in the browser are most likely due to:

### 1. Browser Cache Issue
The browser may still be using old schemas from before the dereferencing update. Solutions:
- Hard refresh the browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- Clear browser cache completely
- Restart the React dev server (done)
- Open in incognito/private browsing mode

### 2. Why It Seems Different
The old bundled schema had `$ref` references that weren't being resolved at validation time, which may have caused the validator to skip certain constraints. The new dereferenced schemas have ALL constraints inline and fully visible to the validator.

However, since the data passes validation with the new schemas in Node.js, this confirms:
- The dereferencing was done correctly
- The oneOf constraint is properly structured  
- The swim.met.no data conforms to the EDR 1.1 specification

## Recommended Actions

1. **Clear browser cache** - This is the most likely cause
2. **Test in incognito mode** - To confirm it's a caching issue
3. **Check browser console** - Verify which schema files are being loaded
4. **Verify schema URLs** - Check Network tab to ensure loading from `/schemas/individual/`

If the error persists after clearing cache, please:
- Share the exact error from browser console
- Check which schema file URLs are being loaded in Network tab
- Verify the schema files in `public/schemas/individual/edr-1.1/` match `schemas/individual/edr-1.1/`
