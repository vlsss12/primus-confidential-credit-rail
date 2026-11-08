import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPrimusNetworkSdk, NETWORK_SDK_VERSION, NETWORK_SDK_BROWSER_URL } from '../src/primus-sdk.js';

test('browser loader uses the same exact release as the package and lockfile', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies['@primuslabs/network-js-sdk'], NETWORK_SDK_VERSION);
  assert.equal(lock.packages['node_modules/@primuslabs/network-js-sdk'].version, NETWORK_SDK_VERSION);
  const loaded = await loadPrimusNetworkSdk({ browser: true, importModule: async specifier => specifier });
  assert.equal(loaded, NETWORK_SDK_BROWSER_URL);
  assert.equal(loaded, `https://esm.sh/@primuslabs/network-js-sdk@${NETWORK_SDK_VERSION}`);
  assert.equal(await loadPrimusNetworkSdk({ browser: false, importModule: async specifier => specifier }), '@primuslabs/network-js-sdk');
});

test('browser entry points cannot bypass the pinned network SDK loader', async () => {
  for (const path of ['index.html', 'proofgate.html', 'src/primus-network.js', 'src/proofgate-client.js']) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /https:\/\/esm\.sh\/@primuslabs\/network-js-sdk/);
  }
});
