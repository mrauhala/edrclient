# Refactoring Plan

## Goals
Reduce duplication, improve maintainability, extract reusable components and utilities, simplify state management.

---

## HIGH PRIORITY

### 1. Extract `<CollapsibleSection>` component
**Saves:** ~150 lines across 5 files

**Duplicated in:**
- `LayerManager.tsx` — lines 37–89
- `TemporalExtent.tsx` — line 23, 118
- `VerticalExtent.tsx` — line 23, 117
- `LocationFeatureList.tsx` — line 40, 65–67
- `ItemsTable.tsx` — line 57, 62–68

**Pattern:**
```tsx
const [open, setOpen] = useState(false);
<ListItemButton onClick={() => setOpen(!open)}>...</ListItemButton>
<Collapse in={open} timeout="auto" unmountOnExit>...</Collapse>
```

**Target API:**
```tsx
<CollapsibleSection title="..." icon={<LayersIcon />} defaultOpen={false}>
  {children}
</CollapsibleSection>
```

- [x] Create `src/CollapsibleSection.tsx`
- [x] Replace pattern in LayerManager, LocationFeatureList, ItemsTable
- Note: TemporalExtent and VerticalExtent use a different pattern (toggle button embedded inside an Alert, not a section header) — these are addressed in item #4 (ExtentDisplay merge)

---

### 2. Extract `<DataGridSearchToolbar>` component
**Saves:** ~80 lines

**Duplicated in:**
- `ItemsTable.tsx` — lines 200–241 (function `CustomToolbar`)
- `LocationFeatureList.tsx` — lines 104–144 (function `CustomToolbar`)

**Target API:**
```tsx
<DataGridSearchToolbar placeholder="Search items..." />
```

- [ ] Create `src/DataGridSearchToolbar.tsx`
- [ ] Replace both CustomToolbar definitions

---

### 3. Consolidate auth utility usage
**Duplicated in:**
- `DataRetrievalAPI.ts` — `getAxiosConfig()` + `addApiKeyToUrl()` (canonical, lines 14–51)
- `App.tsx` — inline in `handleFetchData()` (lines 190–220)
- `ItemsTable.tsx` — inline in `fetchItems()` (lines 70–96)

**Action:** Export `getAxiosConfig` and `addApiKeyToUrl` from `DataRetrievalAPI.ts`, import and use them in App.tsx and ItemsTable.tsx instead of reimplementing.

- [ ] Export helpers from DataRetrievalAPI.ts
- [ ] Refactor App.tsx handleFetchData to use them
- [ ] Refactor ItemsTable.tsx fetchItems to use them

---

### 4. Merge `TemporalExtent.tsx` and `VerticalExtent.tsx` into a generic `<ExtentDisplay>`
**Files:** Both ~206 lines, nearly identical structure

Both render:
- Alert with title
- Summary values (different labels)
- Expandable detail section
- Same pattern of `showDetails` toggle

**Target API:**
```tsx
<ExtentDisplay type="temporal" extent={temporalExtent} />
<ExtentDisplay type="vertical" extent={verticalExtent} />
```

- [ ] Create `src/ExtentDisplay.tsx` with `type: 'temporal' | 'vertical'` prop
- [ ] Delete TemporalExtent.tsx and VerticalExtent.tsx
- [ ] Update all imports in Sidebar.tsx and CollectionInfo.tsx

---

### 5. Custom hooks for App.tsx state
**Problem:** App.tsx manages 16+ useState calls directly, many unrelated

**Group into custom hooks:**
- `useThemeSettings()` — themeMode + localStorage sync + actualMode computation
- `useCustomServices()` — service list + localStorage sync + CRUD handlers
- `useMapState()` — boundingBox, extents, locationFeatures, selectedFeature, clickedCoords, selectedArea, radiusKm, geoJsonLayers
- `useDataModal()` — modalOpen, modalData, modalContentType, modalLoading, modalError + handleFetchData

- [ ] Create `src/hooks/useThemeSettings.ts`
- [ ] Create `src/hooks/useCustomServices.ts`
- [ ] Create `src/hooks/useMapState.ts`
- [ ] Create `src/hooks/useDataModal.ts`
- [ ] Refactor App.tsx to use all four hooks

---

## MEDIUM PRIORITY

### 6. Extract `<OverlayPanel>` wrapper component
**Duplicated in:**
- `FeatureInfo.tsx` — lines 35–48
- `GeoJsonFeatureViewer.tsx` — lines 63–76

Same `<Paper>` with `position: absolute`, `top: 16`, `right: 16`, `zIndex`, `backdropFilter`. Only `width` and `maxHeight` differ.

**Target API:**
```tsx
<OverlayPanel width={320} maxHeight="60vh">...</OverlayPanel>
```

- [ ] Create `src/OverlayPanel.tsx`
- [ ] Replace in FeatureInfo.tsx and GeoJsonFeatureViewer.tsx

---

### 7. Extract coordinate formatting utility
**Duplicated in:**
- `FeatureInfo.tsx` — lines 22–33
- `GeoJsonFeatureViewer.tsx` — lines 35–56

Both define `formatCoordinates()`. GeoJsonFeatureViewer version is more complete.

- [ ] Create `src/utils/geometry.ts` with `formatCoordinates(coords, geomType)`
- [ ] Remove local definitions, import from utility

---

### 8. Extract `<MetadataRow>` component
**Duplicated in:** `CollectionInfo.tsx` — 4+ repetitions of `icon + value` row pattern

```tsx
<Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  <SomeIcon sx={{ fontSize: '15px', color: ..., flexShrink: 0 }} />
  <Box sx={{ fontSize: '0.75rem', color: textSecondary }}>{value}</Box>
</Box>
```

**Target API:**
```tsx
<MetadataRow icon={<Public />} value={spatialCrs} />
```

- [ ] Create `src/MetadataRow.tsx`
- [ ] Replace pattern in CollectionInfo.tsx

---

### 9. Clarify ParameterForm.tsx vs FormatForm.tsx confusion
Both files exist; component names and responsibilities overlap.

- [ ] Read both files fully, document actual difference
- [ ] Rename/restructure to make each file's purpose unambiguous

---

### 10. Split DataRetrievalAPI.ts
File is 2500+ lines mixing types, fetch logic, normalization, and formatting.

**Proposed split:**
- `DataRetrievalAPI.ts` — types + core fetch functions
- `src/utils/dataNormalization.ts` — normalizeTemporal, normalizeVertical, etc.
- `src/utils/dataFormatting.ts` — formatTemporalInterval, formatVerticalValue, etc.

- [ ] Identify all functions in DataRetrievalAPI.ts and categorize them
- [ ] Extract normalization and formatting utilities
- [ ] Update all imports

---

## LOW PRIORITY

### 11. Extract `renderPropertyValue()` utility
**Duplicated check:** `key === 'keywords' && Array.isArray(value)` in FeatureInfo.tsx, GeoJsonFeatureViewer.tsx, ItemsTable.tsx

- [ ] Create utility `renderPropertyValue(key, value)` that handles the keywords special case
- [ ] Replace inline checks in all three files

### 12. Expand `KeywordChips` props
Accept optional `sx` prop for flexible styling in different contexts.

### 13. Extract `<PropertiesTable>` from GeoJsonFeatureViewer.tsx
Lines 170–264 — generic properties grid that could be reused in FeatureInfo.

---

## Suggested Execution Order

1. `CollapsibleSection` — high impact, low risk, no logic changes
2. `DataGridSearchToolbar` — contained, straightforward
3. Auth utility consolidation — reduces subtle auth divergence bugs
4. `ExtentDisplay` merge — reduces file count, no new patterns needed
5. `OverlayPanel` + coordinate utility — quick wins
6. Custom hooks for App.tsx — biggest structural improvement
7. DataRetrievalAPI.ts split — most complex, do last
