import { requestSourceReceipt } from './proofgate-client.js';
const $ = id => document.getElementById(id);
let ready = false, busy = false, result;
function update() { $('start').disabled = !ready || busy || !$('consent').checked; }
$('consent').addEventListener('change', update);
try {
  const response = await fetch('/api/proofgate', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  const config = await response.json();
  ready = response.ok && config.ready === true;
  $('availability').textContent = ready ? 'Server configured' : 'Setup required';
  if (!ready) $('status').textContent = 'The verifier is not configured yet. Follow docs/PROOFGATE.md to add the server secret, RPC and durable replay protection. Proof transactions are disabled until setup is complete.';
} catch {
  $('availability').textContent = 'Server unavailable';
  $('status').textContent = 'Run with Vercel dev or deploy the server API. A static file server cannot verify proofs.';
}
update();
$('start').addEventListener('click', async () => {
  if (busy || !ready || !$('consent').checked) return;
  busy = true; update(); $('audience').disabled = true; $('consent').disabled = true;
  result = undefined; $('receipt').hidden = true; $('download').hidden = true;
  document.querySelector('.result-panel').className = 'panel result-panel';
  $('state').textContent = 'In progress'; $('title').textContent = 'Verification in progress';
  try {
    result = await requestSourceReceipt({ audience: $('audience').value, onStatus: text => { $('status').textContent = text; } });
    document.querySelector('.result-panel').classList.add('success');
    $('state').textContent = 'Source verified'; $('title').textContent = 'A receipt, not a credit decision.';
    $('status').textContent = result.notice;
    const labels = { audience: 'Consumer', wallet: 'Wallet', taskId: 'Task', chainId: 'Chain', templateId: 'Template', scope: 'Scope', expiresAt: 'Expires' };
    $('receipt').replaceChildren();
    for (const [key, label] of Object.entries(labels)) {
      const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = key === 'expiresAt' ? new Date(result.receipt[key] * 1000).toLocaleString() : String(result.receipt[key]);
      row.append(dt, dd); $('receipt').append(row);
    }
    $('receipt').hidden = false; $('download').hidden = false;
  } catch (error) {
    result = undefined;
    document.querySelector('.result-panel').classList.add('failure');
    $('state').textContent = 'Not issued'; $('title').textContent = 'No verification receipt issued.';
    $('status').textContent = error?.message || 'The request did not complete. Retry after checking your wallet and extension.';
  } finally { busy = false; $('audience').disabled = false; $('consent').disabled = false; update(); }
});
$('download').addEventListener('click', () => {
  if (!result) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'proofgate-source-receipt.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
