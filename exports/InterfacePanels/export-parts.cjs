const fs = require('fs');
const path = require('path');
const { DOMParser, XMLSerializer } = require('./render-tools/node_modules/@xmldom/xmldom');
const { Resvg } = require('./render-tools/node_modules/@resvg/resvg-js');
const { PNG } = require('./render-tools/node_modules/pngjs');
const base = __dirname;
const serializer = new XMLSerializer();
const elements = node => Array.from(node.childNodes || []).filter(n => n.nodeType === 1);
const all = node => [node, ...elements(node).flatMap(all)];
const targetPattern = /^(BUTTON|CLOSEBUTTN|CLOSEBTN|CLOSEBUTTON|FRAMENOT)(?:_\d+)?$/i;
const manifest = [];
function svgString(root) { return serializer.serializeToString(root); }
function render(root, width) {
  const image = new Resvg(svgString(root), { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: width }, imageRendering: 0 }).render();
  const png = image.asPng();
  const decoded = PNG.sync.read(png);
  return { width: decoded.width, height: decoded.height, pixels: decoded.data, asPng: () => png };
}
// Figma exports these stripes as a CSS blend mode that SVG image renderers ignore.
// Bake Figma's Pegtop soft-light equation into vector gradients instead.
function resolveSoftLight(root, doc) {
  const nodes = all(root);
  const defs = elements(root).find(n => n.tagName === 'defs');
  const rgb = color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
  let serial = 0;
  for (const group of nodes.filter(n => n.getAttribute?.('style') === 'mix-blend-mode:soft-light')) {
    const rect = elements(group)[0];
    if (rect.tagName !== 'rect') throw new Error('Unexpected blend shape');
    const preceding = nodes.slice(0, nodes.indexOf(group)).reverse().find(n => n.tagName === 'rect' && /^url\(#paint.*linear/.test(n.getAttribute('fill') || ''));
    const gradientId = preceding.getAttribute('fill').slice(5, -1);
    const original = nodes.find(n => n.getAttribute?.('id') === gradientId);
    const stops = elements(original);
    if (stops.length !== 2) throw new Error('Unexpected gradient');
    const from = rgb(stops[0].getAttribute('stop-color')), to = rgb(stops[1].getAttribute('stop-color'));
    const source = rgb(rect.getAttribute('fill'));
    const gradient = original.cloneNode(false);
    const id = `resolvedSoftLight${++serial}`;
    gradient.setAttribute('id', id);
    const rotation = /^rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)$/.exec(rect.getAttribute('transform') || '');
    if (!rotation) throw new Error('Unexpected stripe transform');
    gradient.setAttribute('gradientTransform', `rotate(${-Number(rotation[1])} ${rotation[2]} ${rotation[3]})`);
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const blended = from.map((v, c) => {
        const background = v + (to[c] - v) * t;
        return background + (2 * source[c] - 1) * background * (1 - background);
      });
      const stop = doc.createElementNS(root.namespaceURI, 'stop');
      stop.setAttribute('offset', String(t));
      stop.setAttribute('stop-color', '#' + blended.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''));
      gradient.appendChild(stop);
    }
    defs.appendChild(gradient);
    group.removeAttribute('style');
    rect.setAttribute('fill', `url(#${id})`);
    // Blend stripes only over the face gradient. Cyan and black outline pixels
    // must keep their original stroke colors rather than inherit the face fill.
    const inset = Number(preceding.getAttribute('stroke-width') || 0) / 2;
    const faceClip = doc.createElementNS(root.namespaceURI, 'clipPath');
    const faceId = `stripeFaceClip${serial}`;
    faceClip.setAttribute('id', faceId);
    faceClip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const face = doc.createElementNS(root.namespaceURI, 'rect');
    face.setAttribute('x', String(Number(preceding.getAttribute('x') || 0) + inset));
    face.setAttribute('y', String(Number(preceding.getAttribute('y') || 0) + inset));
    face.setAttribute('width', String(Number(preceding.getAttribute('width')) - 2 * inset));
    face.setAttribute('height', String(Number(preceding.getAttribute('height')) - 2 * inset));
    face.setAttribute('rx', String(Math.max(0, Number(preceding.getAttribute('rx') || 0) - inset)));
    faceClip.appendChild(face);
    defs.appendChild(faceClip);
    group.setAttribute('clip-path', `url(#${faceId})`);
  }
}
function isolate(root, node) {
  const result = root.cloneNode(false);
  for (const defs of elements(root).filter(n => n.tagName === 'defs')) result.appendChild(defs.cloneNode(true));
  let branch = node.cloneNode(true);
  for (let parent = node.parentNode; parent !== root; parent = parent.parentNode) {
    const shell = parent.cloneNode(false);
    shell.appendChild(branch);
    branch = shell;
  }
  result.appendChild(branch);
  return result;
}
function bounds(image, canvas) {
  let x0 = image.width, y0 = image.height, x1 = -1, y1 = -1;
  const pixels = image.pixels;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (pixels[(y * image.width + x) * 4 + 3]) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) throw new Error('Empty asset');
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2);
  x1 = Math.min(canvas.width - 1, x1 + 2); y1 = Math.min(canvas.height - 1, y1 + 2);
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}
for (const name of ['Settings', 'PlotAccess', 'Index']) {
  const doc = new DOMParser().parseFromString(fs.readFileSync(path.join(base, `${name}-source.svg`), 'utf8'), 'image/svg+xml');
  const root = doc.documentElement;
  resolveSoftLight(root, doc);
  const canvas = { width: Number(root.getAttribute('width')), height: Number(root.getAttribute('height')) };
  const targets = all(root).filter(n => n.tagName === 'g' && targetPattern.test(n.getAttribute('id')));
  const panel = root.cloneNode(true);
  for (const node of all(panel).filter(n => n.tagName === 'g' && targetPattern.test(n.getAttribute('id')))) node.parentNode.removeChild(node);
  const entries = [{ name: 'Panel', kind: 'panel', svg: panel, sourceId: root.firstChild?.getAttribute?.('id') || name }];
  let frames = 0, buttons = 0;
  for (const node of targets) {
    const sourceId = node.getAttribute('id');
    const kind = /^CLOSE/.test(sourceId) ? 'close' : /^FRAMENOT/.test(sourceId) ? 'frame' : 'button';
    const category = all(node).map(n => n.getAttribute?.('id')).find(id => /^(ENGINES|FUEL|WHEELS|BLOCKS|GUNS)$/.test(id || ''));
    const partName = kind === 'close' ? 'CloseButton' : kind === 'frame' ? `FrameNot${++frames}` : category ? category[0] + category.slice(1).toLowerCase() + 'Button' : `Button${++buttons}`;
    entries.push({ name: partName, kind, sourceId, svg: isolate(root, node) });
  }
  const directory = path.join(base, name);
  fs.mkdirSync(directory, { recursive: true });
  const gui = { name, canvas, parts: [] };
  // Verify decomposition at a useful viewing size using premultiplied alpha.
  const previewWidth = 1000;
  const reference = render(root, previewWidth);
  const composite = new Float64Array(reference.width * reference.height * 4);
  for (const entry of entries) {
    const piece = render(entry.svg, previewWidth);
    const p = piece.pixels;
    for (let i = 0; i < p.length; i += 4) {
      const a = p[i + 3] / 255;
      for (let c = 0; c < 3; c++) composite[i + c] = p[i + c] * a + composite[i + c] * (1 - a);
      composite[i + 3] = 255 * a + composite[i + 3] * (1 - a);
    }
    const box = bounds(render(entry.svg, canvas.width), canvas);
    const cropped = entry.svg.cloneNode(true);
    cropped.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
    cropped.setAttribute('width', String(box.width)); cropped.setAttribute('height', String(box.height));
    const maxDimension = entry.kind === 'close' ? 1024 : entry.kind === 'panel' || box.width > 2048 ? 4096 : 2048;
    const outputWidth = Math.round(maxDimension * box.width / Math.max(box.width, box.height));
    const output = render(cropped, outputWidth);
    const file = `${name}/${entry.name}.png`;
    fs.writeFileSync(path.join(base, file), output.asPng());
    fs.writeFileSync(path.join(directory, `${entry.name}.svg`), svgString(cropped));
    gui.parts.push({ name: entry.name, kind: entry.kind, sourceId: entry.sourceId, ...box, file, textureWidth: output.width, textureHeight: output.height });
  }
  const original = reference.pixels;
  let totalError = 0, maxError = 0, significant = 0;
  for (let i = 0; i < original.length; i += 4) {
    const a = original[i + 3] / 255;
    let pixelError = 0;
    for (let c = 0; c < 4; c++) {
      const expected = c === 3 ? original[i + c] : original[i + c] * a;
      const error = Math.abs(expected - composite[i + c]);
      totalError += error; maxError = Math.max(maxError, error); pixelError = Math.max(pixelError, error);
    }
    if (pixelError > 3) significant++;
  }
  gui.verification = { meanChannelError: totalError / original.length, maxError, pixelsAbove3: significant, pixels: reference.width * reference.height };
  fs.writeFileSync(path.join(base, `${name}-reference.png`), reference.asPng());
  manifest.push(gui);
  console.log(JSON.stringify({ name, parts: gui.parts.map(p => ({ name: p.name, kind: p.kind, bounds: [p.x, p.y, p.width, p.height], texture: [p.textureWidth, p.textureHeight] })), verification: gui.verification }));
}
fs.writeFileSync(path.join(base, 'manifest.json'), JSON.stringify(manifest, null, 2));
