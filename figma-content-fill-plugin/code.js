figma.showUI(__html__, { width: 400, height: 620, title: 'Fillmate · 共享内容填充' });

function selectedNodes() { return figma.currentPage.selection; }
function canReceiveImage(node) {
  if (!node || node.type === 'TEXT' || node.type === 'DOCUMENT' || node.type === 'PAGE') return false;
  return 'fills' in node;
}

function hasChildren(node) {
  return node && 'children' in node && node.children && node.children.length;
}

function nodeArea(node) {
  return (typeof node.width === 'number' ? node.width : 0) * (typeof node.height === 'number' ? node.height : 0);
}

function hasImageFill(node) {
  if (!canReceiveImage(node) || node.fills === figma.mixed) return false;
  for (var i = 0; i < node.fills.length; i++) {
    if (node.fills[i] && node.fills[i].type === 'IMAGE') return true;
  }
  return false;
}

function imageNodesIn(nodes) {
  var candidates = [];
  function visit(node, isRoot) {
    if (canReceiveImage(node) && !(isRoot && hasChildren(node))) candidates.push(node);
    if (hasChildren(node)) for (var i = 0; i < node.children.length; i++) visit(node.children[i], false);
  }
  for (var i = 0; i < nodes.length; i++) visit(nodes[i], true);
  if (!candidates.length) return [];

  var imageFilled = candidates.filter(hasImageFill);
  var source = imageFilled.length ? imageFilled : candidates;
  var best = source[0];
  var bestArea = nodeArea(best);
  for (var j = 1; j < source.length; j++) {
    var area = nodeArea(source[j]);
    if (area > bestArea) {
      best = source[j];
      bestArea = area;
    }
  }
  return [best];
}

function textNodesIn(nodes) {
  var result = [];
  function visit(node) {
    if (node.type === 'TEXT') { result.push(node); return; }
    if ('children' in node) for (var i = 0; i < node.children.length; i++) visit(node.children[i]);
  }
  for (var i = 0; i < nodes.length; i++) visit(nodes[i]);
  return result;
}

function textSize(node) {
  if (!node || node.type !== 'TEXT') return 0;
  if (typeof node.fontSize === 'number') return node.fontSize;
  if (!node.characters || !node.characters.length) return 0;
  var max = 0;
  for (var i = 0; i < node.characters.length; i++) {
    var size = node.getRangeFontSize(i, i + 1);
    if (typeof size === 'number' && size > max) max = size;
  }
  return max;
}

function largestTextNodeIn(nodes) {
  var texts = textNodesIn(nodes);
  if (!texts.length) return [];
  var best = texts[0];
  var bestSize = textSize(best);
  for (var i = 1; i < texts.length; i++) {
    var size = textSize(texts[i]);
    if (size > bestSize) {
      best = texts[i];
      bestSize = size;
    }
  }
  return [best];
}

function sendSelection() {
  var nodes = selectedNodes();
  figma.ui.postMessage({ type: 'selection', total: nodes.length, fillable: imageNodesIn(nodes).length, texts: largestTextNodeIn(nodes).length });
}

async function writeText(targets, value, append) {
  for (var i = 0; i < targets.length; i++) {
    var node = targets[i];
    var fonts = node.getRangeAllFontNames(0, node.characters.length);
    var seen = {};
    for (var j = 0; j < fonts.length; j++) seen[fonts[j].family + '\u0000' + fonts[j].style] = fonts[j];
    var names = Object.keys(seen).map(function(key) { return seen[key]; });
    if (!names.length && node.fontName !== figma.mixed) names = [node.fontName];
    for (var k = 0; k < names.length; k++) await figma.loadFontAsync(names[k]);
    node.characters = append ? node.characters + value : value;
  }
}

async function fillImage(targets, bytes) {
  var image = figma.createImage(new Uint8Array(bytes));
  for (var i = 0; i < targets.length; i++) {
    var existing = targets[i].fills === figma.mixed ? [] : targets[i].fills.slice();
    var next = { type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash };
    if (existing.length) existing[0] = next;
    else existing.push(next);
    targets[i].fills = existing;
  }
}

async function applySharedItem(bytes, name) {
  var nodes = selectedNodes();
  var imageTargets = imageNodesIn(nodes);
  var textTargets = largestTextNodeIn(nodes);
  if (!imageTargets.length && !textTargets.length) throw new Error('请同时选中封面/头像图层和对应的名称文本图层。');
  if (imageTargets.length) await fillImage(imageTargets, bytes);
  if (textTargets.length) await writeText(textTargets, name, false);
  return { images: imageTargets.length, texts: textTargets.length };
}

figma.on('selectionchange', sendSelection);
figma.ui.onmessage = async function(message) {
  try {
    if (message.type === 'apply-shared') {
      var result = await applySharedItem(message.bytes, String(message.name || ''));
      figma.ui.postMessage({ type: 'success', message: '已填充 ' + result.images + ' 个图片图层和 ' + result.texts + ' 个文本图层。' });
    }
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: error && error.message ? error.message : '操作未完成，请重试。' });
  }
};
sendSelection();
