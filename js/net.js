/* Small HTTP transport: bounded requests, one request per polling loop, and
   recovery when a phone comes back online or returns to the foreground. */
(function (L) {
  'use strict';
  var stats = { requests: 0, failures: 0, timeouts: 0, lastLatencyMs: null, maxLatencyMs: 0, events: [] };
  var outages = {};
  function event(kind, details) {
    stats.events.push(Object.assign({ at: Date.now(), event: kind }, details || {}));
    if (stats.events.length > 100) stats.events.shift();
    try { sessionStorage.setItem('dc-diagnostics', JSON.stringify(stats)); } catch (e) {}
  }
  try {
    var prior = JSON.parse(sessionStorage.getItem('dc-diagnostics') || 'null');
    if (prior && Array.isArray(prior.events)) stats = prior;
  } catch (e) {}
  function request(url, body, headers) {
    var start = Date.now(), route = url.split('?')[0];
    stats.requests++;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    var options = { signal: controller.signal, cache: 'no-store', credentials: 'same-origin', headers: Object.assign({}, headers) };
    if (body !== undefined) {
      options.method = 'POST';
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    return fetch(url, options).then(function (response) {
      if (!response.ok) {
        var error = new Error('HTTP ' + response.status);
        error.status = response.status;
        throw error;
      }
      return response.json();
    }).then(function (result) {
      if (outages[route] !== undefined) {
        event('recovered', { route: route, durationMs: Date.now() - outages[route] });
        delete outages[route];
      }
      return result;
    }).catch(function (error) {
      stats.failures++;
      if (controller.signal.aborted) stats.timeouts++;
      if (outages[route] === undefined) outages[route] = start;
      event('request_failed', { route: route, status: error.status || 0, timeout: controller.signal.aborted });
      throw error;
    }).finally(function () {
      clearTimeout(timer);
      stats.lastLatencyMs = Date.now() - start;
      stats.maxLatencyMs = Math.max(stats.maxLatencyMs, stats.lastLatencyMs);
    });
  }

  function loop(work, interval, onError) {
    var timer = null, busy = false, pending = false, stopped = false, failures = 0;
    function schedule(delay) { clearTimeout(timer); timer = setTimeout(run, delay); }
    function run() {
      if (stopped || busy) return;
      busy = true; pending = false;
      Promise.resolve().then(work).then(function () {
        failures = 0;
      }, function (error) {
        failures++;
        if (onError) onError(error);
      }).finally(function () {
        busy = false;
        if (stopped) return;
        var delay = failures ? Math.min(5000, 500 * Math.pow(2, failures - 1)) + Math.random() * 250
                             : pending ? 0 : interval;
        schedule(delay);
      });
    }
    function kick() {
      if (stopped) return;
      if (busy) pending = true;
      else schedule(0);
    }
    function wake() { if (!document.hidden) kick(); }
    window.addEventListener('online', kick);
    window.addEventListener('pageshow', wake);
    document.addEventListener('visibilitychange', wake);
    kick();
    return {
      kick: kick,
      stop: function () {
        stopped = true; clearTimeout(timer);
        window.removeEventListener('online', kick);
        window.removeEventListener('pageshow', wake);
        document.removeEventListener('visibilitychange', wake);
      }
    };
  }
  window.addEventListener('offline', function () { event('offline'); });
  window.addEventListener('online', function () { event('online'); });
  document.addEventListener('visibilitychange', function () { event(document.hidden ? 'background' : 'foreground'); });
  window.addEventListener('pagehide', function () { event('page_left'); });
  L.net = { request: request, loop: loop, event: event,
    diagnostics: function () { return JSON.parse(JSON.stringify(stats)); } };
})(window.DC);
