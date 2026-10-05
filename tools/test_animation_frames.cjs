const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const images = [];
class FakeImage {
  constructor() { images.push(this); }
  decode() { return new Promise((resolve, reject) => { this.decoded = resolve; this.failed = reject; }); }
}
const L = { util: { assetURL: p => p } };
let code = fs.readFileSync(path.join(__dirname, '../js/tiles.js'), 'utf8');
// Also catch missing/mis-cased frame paths before they reach the hosted build.
for (const match of code.matchAll(/'([^']*art\/chars\/[^']+\.png)'/g)) {
  assert.ok(fs.existsSync(path.join(__dirname, '..', match[1])), match[1]);
}
code = code.replace('})(window.DC);', 'L.frames = { show: showFrame, ready: frameReady }; })(window.DC);');
vm.runInNewContext(code, { window: { DC: L }, Image: FakeImage,
  XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; } });
(async () => {
  let href = 'visible.png', writes = 0;
  const sprite = { getAttribute: () => href, setAttribute: (_, value) => { href = value; writes++; } };
  L.frames.show(sprite, 'next.png');
  assert.equal(href, 'visible.png', 'keep the displayed frame during download');
  images[0].onload();
  L.frames.show(sprite, 'next.png');
  assert.equal(href, 'visible.png', 'loading is not sufficient: wait for decode');
  images[0].decoded(); await Promise.resolve();
  L.frames.show(sprite, 'next.png');
  assert.equal(href, 'next.png');
  L.frames.show(sprite, 'next.png');
  assert.equal(writes, 1, 'do not reassign the same href on every animation tick');
  L.frames.show(sprite, 'broken.png'); images[1].onerror();
  L.frames.show(sprite, 'broken.png');
  assert.equal(href, 'next.png', 'failed frames never replace a visible frame');
  L.frames.show(sprite, 'bad-decode.png'); images[2].onload(); images[2].failed();
  await Promise.resolve();
  L.frames.show(sprite, 'bad-decode.png');
  assert.equal(href, 'next.png');
  console.log('Animation frames passed: slow downloads, delayed/failed decode, failed loads, retained cache, and no duplicate href writes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
