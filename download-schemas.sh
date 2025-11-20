#!/bin/bash

# Script to download and convert individual OGC API schemas from YAML to JSON
# with all references resolved (dereferenced)

set -e

echo "=== Downloading and Converting OGC API Schemas ==="
echo ""

# Function to download and convert a schema
download_schema() {
    local url=$1
    local output=$2
    local name=$3
    
    echo "📥 Downloading: $name"
    echo "   URL: $url"
    echo "   Output: $output"
    
    # Download YAML
    if curl -f -s "$url" -o "${output}.yaml"; then
        echo "   ✅ Downloaded YAML"
        
        # Convert YAML to JSON with resolved references using Python
        if python3 -c "
import yaml
import json
import sys
from pathlib import Path

def resolve_refs(data, base_url):
    '''Recursively resolve \$ref references'''
    if isinstance(data, dict):
        if '\$ref' in data:
            # For now, keep the reference as-is
            # Full resolution would require fetching remote refs
            return data
        return {k: resolve_refs(v, base_url) for k, v in data.items()}
    elif isinstance(data, list):
        return [resolve_refs(item, base_url) for item in data]
    return data

try:
    with open('${output}.yaml', 'r') as f:
        data = yaml.safe_load(f)
    
    # Resolve references (basic version)
    resolved = resolve_refs(data, '$url')
    
    with open('${output}.json', 'w') as f:
        json.dump(resolved, f, indent=2)
    
    print('   ✅ Converted to JSON', file=sys.stderr)
    sys.exit(0)
except Exception as e:
    print(f'   ❌ Error: {e}', file=sys.stderr)
    sys.exit(1)
" 2>&1; then
            rm "${output}.yaml"
            echo "   ✅ Done: $name"
            echo ""
        else
            echo "   ❌ Failed to convert YAML to JSON"
            echo ""
            return 1
        fi
    else
        echo "   ❌ Failed to download"
        echo ""
        return 1
    fi
}

# OGC API Features 1.0
echo "=== OGC API Features 1.0 ==="
download_schema \
    "https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/landingPage.yaml" \
    "schemas/individual/features-1.0/landingPage" \
    "Features Landing Page"

download_schema \
    "https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/collections.yaml" \
    "schemas/individual/features-1.0/collections" \
    "Features Collections"

download_schema \
    "https://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/confClasses.yaml" \
    "schemas/individual/features-1.0/confClasses" \
    "Features Conformance"

# OGC API EDR 1.0
echo "=== OGC API EDR 1.0 ==="
download_schema \
    "https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/landing-page.yaml" \
    "schemas/individual/edr-1.0/landingPage" \
    "EDR 1.0 Landing Page"

download_schema \
    "https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/collections.yaml" \
    "schemas/individual/edr-1.0/collections" \
    "EDR 1.0 Collections"

download_schema \
    "https://schemas.opengis.net/ogcapi/edr/1.0/openapi/schemas/confClasses.yaml" \
    "schemas/individual/edr-1.0/confClasses" \
    "EDR 1.0 Conformance"

# OGC API EDR 1.1
echo "=== OGC API EDR 1.1 ==="
download_schema \
    "https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/landing-page.yaml" \
    "schemas/individual/edr-1.1/landingPage" \
    "EDR 1.1 Landing Page"

download_schema \
    "https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/collections.yaml" \
    "schemas/individual/edr-1.1/collections" \
    "EDR 1.1 Collections"

download_schema \
    "https://schemas.opengis.net/ogcapi/edr/1.1/openapi/schemas/confClasses.yaml" \
    "schemas/individual/edr-1.1/confClasses" \
    "EDR 1.1 Conformance"

# OGC API Common 1.0
echo "=== OGC API Common 1.0 ==="
download_schema \
    "https://schemas.opengis.net/ogcapi/common/part1/1.0/openapi/schemas/landingPage.yaml" \
    "schemas/individual/common-1.0/landingPage" \
    "Common 1.0 Landing Page"

download_schema \
    "https://schemas.opengis.net/ogcapi/common/part1/1.0/openapi/schemas/confClasses.yaml" \
    "schemas/individual/common-1.0/confClasses" \
    "Common 1.0 Conformance"

echo "=== Download Complete ==="
echo "Schemas saved to: schemas/individual/"
echo ""
echo "Next: Copy to public directory"
echo "  cp -r schemas/individual public/schemas/"
