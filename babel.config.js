module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-worklets-core/plugin'],
      'react-native-reanimated/plugin', // <--- ¡Este es el que faltaba y SIEMPRE va al final!
    ],
  };
};