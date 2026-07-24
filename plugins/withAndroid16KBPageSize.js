/**
 * Custom Expo config plugin to enable 16 KB page size support (Android 15+).
 * Adds android.experimental.enable16kbPageSize=true to gradle.properties.
 */
const { withGradleProperties } = require('expo/config-plugins');

function withAndroid16KBPageSize(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults.push({
      type: 'property',
      key: 'android.experimental.enable16kbPageSize',
      value: 'true',
    });
    return cfg;
  });
}

module.exports = withAndroid16KBPageSize;
