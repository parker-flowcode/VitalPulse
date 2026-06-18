/**
 * Jest configuration for the VitalPulse React Native project.
 * Uses the React Native preset and sets up a basic environment.
 */
module.exports = {
  preset: 'react-native',
  // Setup file to mock native modules like AsyncStorage
  setupFiles: ['./jestSetup.js'],
  // Transform ignore patterns – allow transformation of specific RN modules
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vision-camera|react-native-worklets-core|@react-native-async-storage|expo|@expo|expo-.*)/)',
  ],
  // Test environment
  testEnvironment: 'jsdom',
  // Collect coverage (optional)
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/',
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
};