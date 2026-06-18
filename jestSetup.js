/**
 * Jest setup file for the VitalPulse project.
 * Mocks native modules that are not available in the Jest environment.
 */

// Mock AsyncStorage used by the health store
jest.mock('@react-native-async-storage/async-storage', () => {
  const mockAsyncStorage = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  return mockAsyncStorage;
});

// Mock react-native-gesture-handler (required for navigation components)
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Swipeable: View,
    DrawerLayoutAndroid: View,
    State: {},
    PanResponder: {},
    // Add any other components used in the app as needed
  };
});

// Silence the warning about timers in React Native
jest.useFakeTimers();