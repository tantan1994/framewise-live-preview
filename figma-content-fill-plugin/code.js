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

function nodeRect(node) {
  var t = node.absoluteTransform || [[1, 0, 0], [0, 1, 0]];
  var x = t[0][2] || 0;
  var y = t[1][2] || 0;
  var width = typeof node.width === 'number' ? node.width : 0;
  var height = typeof node.height === 'number' ? node.height : 0;
  return { x: x, y: y, width: width, height: height, right: x + width, bottom: y + height };
}

function hasImageFill(node) {
  if (!canReceiveImage(node) || node.fills === figma.mixed) return false;
  for (var i = 0; i < node.fills.length; i++) {
    if (node.fills[i] && node.fills[i].type === 'IMAGE') return true;
  }
  return false;
}

function imageCandidatesIn(nodes) {
  var candidates = [];
  function visit(node, isRoot) {
    if (canReceiveImage(node) && !(isRoot && hasChildren(node))) candidates.push(node);
    if (hasChildren(node)) for (var i = 0; i < node.children.length; i++) visit(node.children[i], false);
  }
  for (var i = 0; i < nodes.length; i++) visit(nodes[i], true);
  return candidates;
}

function isLikelyCoverImage(node) {
  if (!canReceiveImage(node)) return false;
  var rect = nodeRect(node);
  var area = rect.width * rect.height;
  var ratio = rect.width / Math.max(1, rect.height);
  if (area < 3000 || rect.width < 40 || rect.height < 50) return false;
  if (ratio < 0.35 || ratio > 1.45) return false;
  return hasImageFill(node);
}

function coverImageCandidatesIn(nodes) {
  return imageCandidatesIn(nodes).filter(isLikelyCoverImage);
}

function imageNodesIn(nodes) {
  var candidates = imageCandidatesIn(nodes);
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

function containerNodesIn(nodes) {
  var result = [];
  function visit(node) {
    if (hasChildren(node)) {
      result.push(node);
      for (var i = 0; i < node.children.length; i++) visit(node.children[i]);
    }
  }
  for (var i = 0; i < nodes.length; i++) visit(nodes[i]);
  return result;
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

function textLooksLikeMetadata(node) {
  if (!node || node.type !== 'TEXT') return true;
  var value = String(node.characters || '').trim();
  if (!value) return true;
  if (/^(热播榜|预约|预计|即将|马上|今天|明天|昨天|上线|直播|剧集|分类|现代|古风|都市|言情|爱情|日常|重生|穿越|闪婚|马甲|系统|逆袭|甜宠|虐渣)/.test(value)) return true;
  if (/No\.\d+|热度|期待|收藏|上线|分类\d*|^\d{1,2}:\d{2}|^\d+月\d+日/.test(value)) return true;
  if (value.length <= 1) return true;
  return false;
}

function titleTextBelowImage(nodes, image) {
  var texts = textNodesIn(nodes);
  if (!texts.length || !image) return null;
  var ir = nodeRect(image);
  var best = null;
  var bestSize = -1;
  var bestScore = Infinity;
  for (var i = 0; i < texts.length; i++) {
    if (textLooksLikeMetadata(texts[i])) continue;
    var tr = nodeRect(texts[i]);
    var overlap = overlapAmount(ir, tr);
    var overlapRatio = overlap / Math.max(1, Math.min(ir.width, tr.width));
    var verticalGap = tr.y - ir.bottom;
    if (verticalGap < 0 || verticalGap > Math.max(28, ir.height * 0.28) || overlapRatio < 0.5) continue;
    var size = textSize(texts[i]);
    var score = Math.abs(verticalGap) + Math.abs((tr.x + tr.width / 2) - (ir.x + ir.width / 2)) * 0.2;
    if (size > bestSize || (size === bestSize && score < bestScore)) {
      best = texts[i];
      bestSize = size;
      bestScore = score;
    }
  }
  return best;
}

function buildContainerGroups(nodes) {
  var containers = containerNodesIn(nodes).sort(function(a, b) { return nodeArea(a) - nodeArea(b); });
  var groups = [];
  var usedImages = {};
  var usedTexts = {};
  for (var i = 0; i < containers.length; i++) {
    var coverImages = coverImageCandidatesIn([containers[i]]);
    var image = coverImages.length ? coverImages.sort(function(a, b) { return nodeArea(b) - nodeArea(a); })[0] : null;
    var text = titleTextBelowImage([containers[i]], image);
    if (!image || !text) continue;
    if (usedImages[image.id] || usedTexts[text.id]) continue;
    usedImages[image.id] = true;
    usedTexts[text.id] = true;
    groups.push({ image: image, text: text });
  }
  return groups;
}

function overlapAmount(a, b) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
}

function distanceBetween(a, b) {
  var ax = a.x + a.width / 2;
  var ay = a.y + a.height / 2;
  var bx = b.x + b.width / 2;
  var by = b.y + b.height / 2;
  var dx = ax - bx;
  var dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildPositionGroups(nodes) {
  var images = coverImageCandidatesIn(nodes).sort(function(a, b) {
    var ar = nodeRect(a), br = nodeRect(b);
    return ar.y === br.y ? ar.x - br.x : ar.y - br.y;
  });
  var texts = textNodesIn(nodes);
  var groups = [];
  var usedTexts = {};
  for (var i = 0; i < images.length; i++) {
    var ir = nodeRect(images[i]);
    var best = null;
    var bestSize = -1;
    var bestScore = Infinity;
    for (var j = 0; j < texts.length; j++) {
      if (usedTexts[texts[j].id]) continue;
      if (textLooksLikeMetadata(texts[j])) continue;
      var tr = nodeRect(texts[j]);
      var overlap = overlapAmount(ir, tr);
      var overlapRatio = overlap / Math.max(1, Math.min(ir.width, tr.width));
      var verticalGap = tr.y - ir.bottom;
      if (verticalGap < 0 || verticalGap > Math.max(28, ir.height * 0.28) || overlapRatio < 0.5) continue;
      var size = textSize(texts[j]);
      var score = Math.abs(verticalGap) + Math.abs((tr.x + tr.width / 2) - (ir.x + ir.width / 2)) * 0.2;
      if (size > bestSize || (size === bestSize && score < bestScore)) {
        best = texts[j];
        bestSize = size;
        bestScore = score;
      }
    }
    if (best) {
      usedTexts[best.id] = true;
      groups.push({ image: images[i], text: best });
    }
  }
  return groups;
}

function fillGroupsIn(nodes) {
  var groups = buildContainerGroups(nodes);
  if (groups.length) return groups;
  return buildPositionGroups(nodes);
}

function sendSelection() {
  var nodes = selectedNodes();
  var groups = fillGroupsIn(nodes);
  figma.ui.postMessage({
    type: 'selection',
    total: nodes.length,
    fillable: imageNodesIn(nodes).length,
    texts: largestTextNodeIn(nodes).length,
    groups: groups.length
  });
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

function shuffle(items) {
  var copy = items.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

async function applyBatchSharedItems(batchItems) {
  var nodes = selectedNodes();
  var groups = fillGroupsIn(nodes);
  if (!groups.length) throw new Error('没有识别到可填充的「图片 + 标题」组合。请选中包含多张卡片的模块。');
  if (!batchItems || !batchItems.length) throw new Error('当前分类没有可用素材。');
  var picks = shuffle(batchItems).slice(0, Math.min(groups.length, batchItems.length));
  for (var i = 0; i < picks.length; i++) {
    await fillImage([groups[i].image], picks[i].bytes);
    await writeText([groups[i].text], String(picks[i].name || ''), false);
  }
  return { groups: groups.length, filled: picks.length };
}

figma.on('selectionchange', sendSelection);
figma.ui.onmessage = async function(message) {
  try {
    if (message.type === 'apply-shared') {
      var result = await applySharedItem(message.bytes, String(message.name || ''));
      figma.ui.postMessage({ type: 'success', message: '已填充 ' + result.images + ' 个图片图层和 ' + result.texts + ' 个文本图层。' });
    }
    if (message.type === 'apply-batch-shared') {
      var batchResult = await applyBatchSharedItems(message.items || []);
      figma.ui.postMessage({ type: 'success', message: '已一键填充 ' + batchResult.filled + ' 组；识别到 ' + batchResult.groups + ' 组。' });
    }
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: error && error.message ? error.message : '操作未完成，请重试。' });
  }
};
sendSelection();
