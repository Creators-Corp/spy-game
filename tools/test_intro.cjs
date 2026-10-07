/* Intro blocks the host page, hands off to QR, and skips invited phones. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/intro.js'), 'utf8');
function setup(role) {
  const handlers = {};
  const begin = { tagName: 'BUTTON', focus() { this.focused = true; },
    addEventListener(name, fn) { handlers[name] = fn; } };
  const intro = { tagName: 'DIV', hidden: false, contains: target => target === begin };
  const stage = { tagName: 'DIV', inert: false };
  const recovery = { tagName: 'DIV', inert: true };
  const close = { focus() { this.focused = true; } };
  let opens = 0;
  const events = {};
  const document = { readyState: 'complete', body: { children: [intro, stage, recovery] },
    getElementById: id => ({ 'intro-screen': intro, 'intro-begin': begin, 'seat-close': close })[id],
    addEventListener(name, fn) { events[name] = fn; },
    removeEventListener(name) { delete events[name]; } };
  vm.runInNewContext(source, { document, window: { DC: { link: { role, openPanel() { opens++; } } } } });
  return { intro, begin, stage, recovery, close, handlers, events, opens: () => opens };
}
const host = setup('host');
assert.equal(host.intro.hidden, false);
assert.equal(host.stage.inert, true);
assert.equal(host.begin.focused, true);
let prevented = false, stopped = false;
host.events.keydown({ key: 'Tab', target: host.begin,
  preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
assert.ok(prevented && stopped);
host.handlers.click();
assert.equal(host.intro.hidden, true);
assert.equal(host.stage.inert, false);
assert.equal(host.recovery.inert, true);
assert.equal(host.opens(), 1);
assert.equal(host.close.focused, true);
assert.deepEqual(host.events, {});
/* The relay check locks the stage while the intro boots and unlocks it before
   LET'S BEGIN. The intro must not bring that stale lock back. */
{
  const handlers = {}, events = {};
  const begin = { tagName: 'BUTTON', focus() {}, addEventListener(name, fn) { handlers[name] = fn; } };
  const intro = { tagName: 'DIV', hidden: false, contains: target => target === begin };
  const stage = { tagName: 'DIV', inert: true };                 // locked: "Checking the main screen connection…"
  const R = { blocked: true, pending: false, paint() { stage.inert = this.blocked || this.pending; } };
  const document = { readyState: 'complete', body: { children: [intro, stage] },
    getElementById: id => ({ 'intro-screen': intro, 'intro-begin': begin, 'seat-close': { focus() {} } })[id],
    addEventListener(name, fn) { events[name] = fn; }, removeEventListener(name) { delete events[name]; } };
  vm.runInNewContext(source, { document, window: { DC: { recovery: R, link: { role: 'host', openPanel() {} } } } });
  R.blocked = false; R.paint();                                  // the relay answered
  stage.inert = true;                                            // ...but the intro still covers it
  handlers.click();
  assert.equal(stage.inert, false, 'LET’S BEGIN leaves the stage usable once the relay check is over');
  R.blocked = true; stage.inert = false;
  handlers.click();
  assert.equal(stage.inert, true, 'a lock that is still true stays');
}
const guest = setup('guest');
assert.equal(guest.intro.hidden, true);
assert.equal(guest.stage.inert, false);
assert.equal(guest.opens(), 0);
console.log('Intro passed: host overlay, focus trap, QR handoff, inert restoration and guest bypass.');
