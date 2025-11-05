# IWXXM Schema Files

This directory contains XML Schema Definition (XSD) files for validating IWXXM (ICAO Meteorological Information Exchange Model) messages.

## IWXXM 3.0

The IWXXM 3.0 schemas are used for validating aviation weather reports including:
- **METAR** - Meteorological Aerodrome Report (routine observations)
- **SPECI** - Special Meteorological Report (non-routine observations)
- **TAF** - Terminal Aerodrome Forecast
- **SIGMET** - Significant Meteorological Information
- **AIRMET** - Airmen's Meteorological Information

### Schema Files

- `iwxxm/3.0/iwxxm.xsd` - Main IWXXM 3.0 schema file (includes all sub-schemas)
- `iwxxm/3.0/common.xsd` - Common constructs used across multiple report types
- `iwxxm/3.0/metarSpeci.xsd` - METAR and SPECI specific definitions
- `iwxxm/3.0/taf.xsd` - TAF specific definitions
- `iwxxm/3.0/sigmet.xsd` - SIGMET specific definitions
- `iwxxm/3.0/airmet.xsd` - AIRMET specific definitions

### Source

All schemas are downloaded from the official WMO schema repository:
- https://schemas.wmo.int/iwxxm/3.0/

### Usage

These schemas can be used to validate IWXXM XML messages received from APIs. Example validation using xmllint:

```bash
xmllint --schema schemas/iwxxm/3.0/metarSpeci.xsd test-metar.xml --noout
xmllint --schema schemas/iwxxm/3.0/taf.xsd test-taf-full.xml --noout
xmllint --schema schemas/iwxxm/3.0/sigmet.xsd test-sigmet.xml --noout
xmllint --schema schemas/iwxxm/3.0/airmet.xsd test-airmet.xml --noout
```

### References

- ICAO Annex 3 - Meteorological Service for International Air Navigation
- WMO No. 49-2 - Technical Regulations, Volume II - Meteorological Service for International Air Navigation
- IWXXM Documentation: https://schemas.wmo.int/iwxxm/
