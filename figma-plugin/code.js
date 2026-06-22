// Framewise Figma plugin: selection → PNG export → secure relay.
figma.showUI(__html__, { width: 336, height: 382, title: 'Framewise Live Preview' });

let session = null;
let debounceTimer = null;
let lastNodeId = null;

function selectedFrame() {
  const node = figma.currentPage.selection[0];
  if (!node) return null;
  const exportable = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION', 'GROUP'];
  return exportable.includes(node.type) ? node : null;
}

function bytesToBase64(bytes) {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function updateStatus() {
  const node = selectedFrame();
  figma.ui.postMessage({
    type: 'selection',
    name: node ? node.name : null,
    size: node ? `${Math.round(node.width)} × ${Math.round(node.height)}` : null,
    running: Boolean(session)
  });
}

async function publishSelection() {
  if (!session) return;
  const node = selectedFrame();
  updateStatus();
  if (!node) return;

  try {
    figma.ui.postMessage({ type: 'syncing' });
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 }
    });
    const response = await fetch(`${session.relayUrl}/api/sessions/${session.id}/frame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.publisherToken}`
      },
      body: JSON.stringify({
        name: node.name,
        nodeId: node.id,
        width: Math.round(node.width),
        height: Math.round(node.height),
        image: bytesToBase64(bytes),
        updatedAt: new Date().toISOString()
      })
    });
    if (!response.ok) throw new Error(`Relay returned ${response.status}`);
    lastNodeId = node.id;
    figma.ui.postMessage({ type: 'synced', nodeId: node.id });
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: '同步失败。请检查中继服务地址与网络权限。' });
    console.error(error);
  }
}

function schedulePublish() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(publishSelection, 450);
}

figma.on('selectionchange', () => {
  updateStatus();
  schedulePublish();
});

figma.ui.onmessage = async (message) => {
  if (message.type === 'start') {
    const relayUrl = message.relayUrl.replace(/\/$/, '');
    try {
      const response = await fetch(`${relayUrl}/api/sessions`, { method: 'POST' });
      if (!response.ok) throw new Error('Unable to create session');
      const created = await response.json();
      session = { relayUrl, ...created };
      figma.ui.postMessage({ type: 'started', ...created, relayUrl });
      updateStatus();
      await publishSelection();
    } catch (error) {
      figma.ui.postMessage({ type: 'error', message: '无法创建会话。请确认服务地址可公开访问。' });
    }
  }
  if (message.type === 'sync-now') publishSelection();
};

updateStatus();
