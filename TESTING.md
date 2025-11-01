# Testing Setup and Known Issues

## Current Status

⚠️ **Tests are currently failing due to ES module compatibility issues with Jest**

## The Problem

This project uses several libraries that have moved to ES modules (ESM):
- `axios` - HTTP client
- `ol` (OpenLayers) - Map rendering library
- `swagger-ui-react` - API documentation viewer

Jest (the testing framework used by Create React App) has difficulty transforming these ES modules because:
1. They use `import` statements in their source
2. Jest's default transformer doesn't handle all ES module dependencies
3. The dependency tree is deep (e.g., OpenLayers imports `rbush`, `quickselect`, `geotiff`, etc.)

## Current Workarounds

### In CI/CD
The GitHub Actions CI workflow is configured to:
- Skip test failures gracefully with `|| echo "..."` 
- Still run type checking and linting
- Build the application successfully

### Attempted Solutions

1. **jest.config.js** - Created comprehensive Jest configuration
2. **setupTests.ts** - Added extensive mocks for problematic modules  
3. **Manual mocks** - Created `__mocks__` directories
4. **transformIgnorePatterns** - Attempted to transform node_modules

## Recommended Solutions

### Option 1: Upgrade to Vitest (Recommended)
[Vitest](https://vitest.dev/) is a modern test runner with native ES module support:

```bash
npm install --save-dev vitest @vitest/ui jsdom
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

Update `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
});
```

### Option 2: Use Experimental ESM in Jest
Update `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "test": "NODE_OPTIONS=--experimental-vm-modules jest"
  }
}
```

⚠️ This is experimental and may have other side effects.

### Option 3: Mock Heavy Dependencies
Create a more comprehensive mocking strategy:
- Mock the entire `ol` module
- Mock the entire `axios` module
- Mock `swagger-ui-react` component

This reduces test coverage but allows tests to run.

### Option 4: Eject from Create React App
```bash
npm run eject
```

This gives full control over the webpack and Jest configuration, but you lose CRA's updates and simplicity.

## Temporary Workaround (Current)

Tests are skipped in CI but the application still:
- ✅ Type checks successfully
- ✅ Lints code (if configured)
- ✅ Builds successfully
- ✅ Deploys to Firebase Hosting

## Running Tests Locally

```bash
# Try to run tests (will fail with current setup)
npm test

# Run type checking (works)
npx tsc --noEmit

# Build the app (works)
npm run build
```

## Contributing

If you want to fix the testing setup:
1. Consider Option 1 (Vitest migration) for the best long-term solution
2. Document any changes in this file
3. Update the CI workflow to enable tests again
4. Remove the `|| echo "..."` workaround from `.github/workflows/ci.yml`

## References

- [Jest ES Modules documentation](https://jestjs.io/docs/ecmascript-modules)
- [Vitest Migration Guide](https://vitest.dev/guide/migration.html)
- [Create React App Testing Documentation](https://create-react-app.dev/docs/running-tests/)
- [GitHub Issue: Jest and ES Modules](https://github.com/facebook/jest/issues/9430)
