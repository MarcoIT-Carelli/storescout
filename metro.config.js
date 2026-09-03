const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * L'alias `@/` dichiarato in tsconfig.json vale solo per il controllo dei tipi.
 * Qui lo si ripete per il bundler, così l'import funziona anche a runtime.
 */
const SRC = path.resolve(__dirname, 'src');
const risolviPredefinito = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const risolvi = risolviPredefinito ?? context.resolveRequest;
  if (moduleName.startsWith('@/')) {
    return risolvi(context, path.join(SRC, moduleName.slice(2)), platform);
  }
  return risolvi(context, moduleName, platform);
};

module.exports = config;
