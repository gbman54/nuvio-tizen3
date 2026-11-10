/* ES5 polyfills for Chromium 47 - Promise, Array, Object, String basics */
(function () {
  'use strict';
  if (typeof Promise === 'undefined') {
    function P(executor) {
      var self = this;
      self.state = 'pending'; self.value = undefined; self.handlers = [];
      function resolve(v) {
        if (self.state !== 'pending') return;
        if (v && typeof v.then === 'function') { v.then(resolve, reject); return; }
        self.state = 'fulfilled'; self.value = v; drain();
      }
      function reject(e) {
        if (self.state !== 'pending') return;
        self.state = 'rejected'; self.value = e; drain();
      }
      function drain() {
        var hs = self.handlers.slice(), i;
        self.handlers = [];
        for (i = 0; i < hs.length; i++) {
          (function (h) {
            setTimeout(function () {
              var fn = self.state === 'fulfilled' ? h.onF : h.onR, out;
              if (!fn) { self.state === 'fulfilled' ? h.res(self.value) : h.rej(self.value); return; }
              try { out = fn(self.value); h.res(out); } catch (err) { h.rej(err); }
            }, 0);
          })(hs[i]);
        }
      }
      try { executor(resolve, reject); } catch (e) { reject(e); }
    }
    P.prototype.then = function (onF, onR) {
      var self = this, res, rej;
      var p = new P(function (r, j) { res = r; rej = j; });
      self.handlers.push({ onF: onF, onR: onR, res: res, rej: rej });
      if (self.state !== 'pending') { var h = self.handlers.pop(); (function () { setTimeout(function () { var fn = self.state === 'fulfilled' ? h.onF : h.onR; if (!fn) { self.state === 'fulfilled' ? h.res(self.value) : h.rej(self.value); return; } try { h.res(fn(self.value)); } catch (e) { h.rej(e); } }, 0); })(); }
      return p;
    };
    P.prototype.catch = function (onR) { return this.then(null, onR); };
    P.resolve = function (v) { return new P(function (r) { r(v); }); };
    P.reject = function (e) { return new P(function (r, j) { j(e); }); };
    P.all = function (arr) {
      return new P(function (res, rej) {
        var out = [], left = arr.length, done = false, i;
        if (!left) { res(out); return; }
        function next(v, idx) { out[idx] = v; if (--left === 0 && !done) { done = true; res(out); } }
        for (i = 0; i < arr.length; i++) { (function (idx) { P.resolve(arr[idx]).then(function (v) { next(v, idx); }, function (e) { if (!done) { done = true; rej(e); } }); })(i); }
      });
    };
    window.Promise = P;
  }
  if (!Array.prototype.find) {
    Array.prototype.find = function (cb, ctx) { var i; for (i = 0; i < this.length; i++) if (cb.call(ctx, this[i], i, this)) return this[i]; return undefined; };
    Array.prototype.findIndex = function (cb, ctx) { var i; for (i = 0; i < this.length; i++) if (cb.call(ctx, this[i], i, this)) return i; return -1; };
  }
  if (!Array.prototype.includes) {
    Array.prototype.includes = function (v) { return this.indexOf(v) !== -1; };
  }
  if (!Array.prototype.fill) {
    Array.prototype.fill = function (v, s, e) { var i; s = s || 0; e = e || this.length; for (i = s; i < e && i < this.length; i++) this[i] = v; return this; };
  }
  if (!Object.assign) {
    Object.assign = function (t) { var i, k; for (i = 1; i < arguments.length; i++) for (k in arguments[i]) if (Object.prototype.hasOwnProperty.call(arguments[i], k)) t[k] = arguments[i][k]; return t; };
  }
  if (!Object.keys) {
    Object.keys = function (o) { var a = [], k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) a.push(k); return a; };
  }
  if (!String.prototype.trim) {
    String.prototype.trim = function () { return this.replace(/^\s+|\s+$/g, ''); };
  }
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (s) { return this.indexOf(s) === 0; };
    String.prototype.endsWith = function (s) { return this.lastIndexOf(s) === this.length - s.length; };
  }
  // String.padStart polyfill (ES2017)
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (len, ch) {
      ch = ch || ' '; var s = String(this), need = len - s.length;
      if (need <= 0) return s;
      var pad = '', i; for (i = 0; i < need; i++) pad += ch;
      return pad + s;
    };
  }
  // Object.entries polyfill
  if (!Object.entries) {
    Object.entries = function (o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }); };
  }
  if (!Object.values) {
    Object.values = function (o) { return Object.keys(o).map(function (k) { return o[k]; }); };
  }
  if (!Object.getOwnPropertyDescriptors) {
    Object.getOwnPropertyDescriptors = function (o) {
      var out = {}, keys = Object.getOwnPropertyNames(o).concat(Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(o) : []);
      for (var i = 0; i < keys.length; i++) out[keys[i]] = Object.getOwnPropertyDescriptor(o, keys[i]);
      return out;
    };
  }
  if (!Object.getOwnPropertySymbols) { Object.getOwnPropertySymbols = function () { return []; }; }
  if (!Object.fromEntries) {
    Object.fromEntries = function (iterable) {
      var out = {}, list = [], i;
      if (!iterable) return out;
      if (typeof iterable.entries === 'function' && !Array.isArray(iterable)) list = iterable.entries();
      else if (typeof iterable[Symbol.iterator] === 'function') {
        var it = iterable[Symbol.iterator](), step;
        while (!(step = it.next()).done) list.push(step.value);
      } else {
        var keys = Object.keys(iterable);
        for (i = 0; i < keys.length; i++) list.push([keys[i], iterable[keys[i]]]);
      }
      for (i = 0; i < list.length; i++) if (list[i]) out[list[i][0]] = list[i][1];
      return out;
    };
  }
})();
