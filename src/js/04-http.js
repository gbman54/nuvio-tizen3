/* XHR wrapper with timeout + one retry with backoff. Callback style for ES5 clarity. */
var Http = (function () {
  'use strict';
  // GET JSON. cb(err, json, status) ; options {timeout, retries}
  function getJson(url, timeout, cb) {
    var attempt = 0, maxAttempts = 2; // initial + 1 retry
    function tryOnce() {
      var xhr = new XMLHttpRequest();
      var done = false;
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.timeout = timeout || 8000;
      xhr.ontimeout = function () { if (done) return; done = true; onFail(new Error('timeout')); };
      xhr.onerror = function () { if (done) return; done = true; onFail(new Error('network')); };
      xhr.onload = function () {
        if (done) return; done = true;
        if (xhr.status >= 200 && xhr.status < 300) {
          try { cb(null, JSON.parse(xhr.responseText), xhr.status); }
          catch (e) { cb(e, null, xhr.status); }
        } else { onFail(new Error('http ' + xhr.status), xhr.status); }
      };
      xhr.send();
    }
    function onFail(err, status) {
      attempt++;
      if (attempt < maxAttempts) {
        var backoff = 600 * attempt;
        setTimeout(tryOnce, backoff);
      } else {
        cb(err, null, status || 0);
      }
    }
    tryOnce();
  }
  // GET text (for resolver adapters)
  function getText(url, timeout, cb) {
    getJsonRaw(url, timeout, cb);
  }
  function getJsonRaw(url, timeout, cb) {
    var xhr = new XMLHttpRequest();
    var done = false;
    xhr.open('GET', url, true);
    xhr.timeout = timeout || 8000;
    xhr.ontimeout = function () { if (!done) { done = true; cb(new Error('timeout'), null, 0); } };
    xhr.onerror = function () { if (!done) { done = true; cb(new Error('network'), null, 0); } };
    xhr.onload = function () {
      if (done) return; done = true;
      if (xhr.status >= 200 && xhr.status < 400) cb(null, xhr.responseText, xhr.status);
      else cb(new Error('http ' + xhr.status), null, xhr.status);
    };
    xhr.send();
  }
  function postJson(url, body, timeout, cb) {
    var xhr = new XMLHttpRequest();
    var done = false;
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = timeout || 8000;
    xhr.ontimeout = function () { if (!done) { done = true; cb(new Error('timeout'), null, 0); } };
    xhr.onerror = function () { if (!done) { done = true; cb(new Error('network'), null, 0); } };
    xhr.onload = function () {
      if (done) return; done = true;
      if (xhr.status >= 200 && xhr.status < 300) {
        try { cb(null, JSON.parse(xhr.responseText), xhr.status); }
        catch (e) { cb(null, xhr.responseText, xhr.status); }
      } else cb(new Error('http ' + xhr.status), null, xhr.status);
    };
    xhr.send(JSON.stringify(body || {}));
  }
  function testUrl(url, timeout, cb) {
    var xhr = new XMLHttpRequest();
    var done = false;
    xhr.open('GET', url, true);
    xhr.timeout = timeout || 6000;
    xhr.ontimeout = function () { if (!done) { done = true; cb(new Error('timeout')); } };
    xhr.onerror = function () { if (!done) { done = true; cb(new Error('network')); } };
    xhr.onload = function () { if (!done) { done = true; cb(null, xhr.status); } };
    xhr.send();
  }
  return { getJson: getJson, getText: getText, postJson: postJson, testUrl: testUrl };
})();
