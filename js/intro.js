/* Host welcome screen. QR guests go straight to the existing role picker. */
(function (L) {
  'use strict';
  function boot() {
    var intro = document.getElementById('intro-screen');
    var begin = document.getElementById('intro-begin');
    if (L.link && L.link.role === 'guest') { intro.hidden = true; return; }
    var behind = Array.prototype.filter.call(document.body.children, function (node) {
      return node !== intro && node.tagName !== 'SCRIPT';
    }).map(function (node) {
      var prior = node.inert;
      node.inert = true;
      return { node: node, prior: prior };
    });
    function keepFocus(event) {
      if (!intro.hidden && !intro.contains(event.target)) begin.focus();
    }
    function keys(event) {
      if (intro.hidden) return;
      event.stopImmediatePropagation();
      if (event.key === 'Tab' || !intro.contains(event.target)) {
        event.preventDefault(); begin.focus();
      }
    }
    document.addEventListener('focusin', keepFocus);
    document.addEventListener('keydown', keys, true);
    begin.addEventListener('click', function () {
      intro.hidden = true;
      behind.forEach(function (entry) { entry.node.inert = entry.prior; });
      document.removeEventListener('focusin', keepFocus);
      document.removeEventListener('keydown', keys, true);
      if (L.link) L.link.openPanel();
      document.getElementById('seat-close').focus();
    });
    begin.focus();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.DC);
