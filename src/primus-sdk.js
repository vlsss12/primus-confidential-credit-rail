// Keep the browser and Node dependency on the same reviewed SDK release.
export const NETWORK_SDK_VERSION = '0.1.11';
export const NETWORK_SDK_BROWSER_URL =
  'https://esm.sh/@primuslabs/network-js-sdk@0.1.11';

export function loadPrimusNetworkSdk({
  browser = typeof window !== 'undefined',
  importModule = (specifier) => import(specifier),
} = {}) {
  return importModule(browser ? NETWORK_SDK_BROWSER_URL : '@primuslabs/network-js-sdk');
}
