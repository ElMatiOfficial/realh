import { MockProvider } from './mock/index.js';

const providers = new Map();

export function registerProvider(ProviderClass, config) {
  const instance = new ProviderClass(config);
  providers.set(instance.id, instance);
}

export function getProvider(id) {
  return providers.get(id) || null;
}

export function listProviders() {
  return Array.from(providers.values()).map(p => p.toJSON());
}

export function initializeProviders(config) {
  registerProvider(MockProvider, config);
  // Future providers are registered here behind config flags:
  // if (config.providers?.eidasEu) registerProvider(EidasProvider, config);
}
