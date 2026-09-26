const appJson = require('./app.json');

/**
 * Expo resolves config through this file when present and passes the static
 * `app.json` config in as `config`. We only use it to inject the Android Google
 * Maps API key from the environment so the key is never committed.
 *
 * `react-native-maps`, `expo-location` and `expo-image-picker` config plugins are
 * applied automatically at prebuild by Expo
 * (see @expo/prebuild-config/build/plugins/withDefaultPlugins.js), so they must
 * not be duplicated in the `plugins` array.
 */
module.exports = ({ config }) => {
  const base = config && Object.keys(config).length ? config : appJson.expo;
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  const androidConfig = androidGoogleMapsApiKey
    ? {
        ...(base.android?.config ?? {}),
        googleMaps: { apiKey: androidGoogleMapsApiKey },
      }
    : base.android?.config;

  return {
    ...base,
    android: {
      ...base.android,
      ...(androidConfig ? { config: androidConfig } : {}),
    },
  };
};
