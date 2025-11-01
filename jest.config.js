module.exports = {
  preset: 'react-scripts',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  
  // Transform ES modules from node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(axios|swagger-ui-react|ol|ol-layerswitcher|rbush|quickselect|geotiff|color-space|color-rgba)/)'
  ],
  
  // Module name mappings
  moduleNameMapper: {
    // Mock CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Mock swagger-ui internal module
    '^#swagger-ui$': '<rootDir>/node_modules/swagger-ui-react/swagger-ui-es-bundle-core.js',
    
    // Mock image and font files
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js'
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/reportWebVitals.ts',
    '!src/setupTests.ts'
  ],
  
  coverageThresholds: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  }
};
