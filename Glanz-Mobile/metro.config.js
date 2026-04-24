const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// On web, @stripe/stripe-react-native pulls in native-only modules
// (codegenNativeCommands, etc.) that crash the bundler. Replace the whole
// package with a no-op shim that exports the same surface area used by the app.
const stripeWebMock = path.resolve(__dirname, 'src/stripe-web-mock.js');

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@stripe/stripe-react-native') {
    return { filePath: stripeWebMock, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
