/* Single focus manager: spatial D-pad navigation over .focusable elements */
var FocusMgr = (function () {
  'use strict';
  var current = null;
  var stack = []; // remember focus per view
  var scopeEl = null;
  function setScope(el) { scopeEl = el || null; }
  function clearScope() { scopeEl = null; }
  function focusables() {
    var root = scopeEl || document;
    var els = root.querySelectorAll('.focusable');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.offsetParent !== null || e.getClientRects().length) out.push(e);
    }
    return out;
  }
  function scrollParent(el) {
    var p = el.parentNode;
    while (p && p.nodeType === 1 && p !== document.body) {
      var cs = window.getComputedStyle ? window.getComputedStyle(p) : null;
      var oy = cs ? cs.overflowY : '';
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 2) return p;
      p = p.parentNode;
    }
    return null;
  }
  // The whole stage is scaled on non-1920x1080 viewports. getBoundingClientRect()
  // returns scaled pixels while scrollTop/scrollLeft are unscaled, so convert.
  function stageScale() {
    try {
      var st = document.getElementById('stage');
      if (!st) return 1;
      var r = st.getBoundingClientRect();
      var s = r.width / 1920;
      return s > 0 ? s : 1;
    } catch (e) { return 1; }
  }
  // Scroll the horizontal card strip only (scrollIntoView also dragged the page
  // vertically and hid the row title).
  function scrollRowInline(el) {
    var list = el.closest ? el.closest('.row-list') : null;
    if (!list) return;
    var s = stageScale();
    var er = el.getBoundingClientRect(), lr = list.getBoundingClientRect();
    var target = list.scrollLeft;
    if (er.left < lr.left + 16) target -= (lr.left + 16 - er.left) / s;
    else if (er.right > lr.right - 16) target += (er.right - (lr.right - 16)) / s;
    if (target !== list.scrollLeft) list.scrollLeft = target;
  }
  function scrollFocusIntoView(el) {
    scrollRowInline(el);
    var scroller = scrollParent(el);
    if (!scroller) return;
    var s = stageScale();
    var cr = scroller.getBoundingClientRect();
    var row = el.closest ? el.closest('.row') : null;
    if (row) {
      // Keep the whole row (title + posters) in view, aligned below the top edge.
      var rr = row.getBoundingClientRect();
      if (rr.top < cr.top + 22 || rr.bottom > cr.bottom - 12) {
        scroller.scrollTop += (rr.top - cr.top - 22) / s;
      }
    } else {
      var er = el.getBoundingClientRect();
      if (er.top < cr.top + 22) scroller.scrollTop -= (cr.top + 22 - er.top) / s;
      else if (er.bottom > cr.bottom - 90) scroller.scrollTop += (er.bottom - (cr.bottom - 90)) / s;
    }
  }
  function setFocus(el) {
    if (!el) return;
    blurCurrent();
    current = el;
    el.classList.add('focused');
    // Deliberately no el.focus(): Tizen's native focus scroll runs after this
    // function and snapped the page back to the top of the poster row.
    scrollFocusIntoView(el);
    // highlight row poster
    var row = el.closest ? el.closest('.row') : null;
    var rows = document.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove('active-row');
    if (row) row.classList.add('active-row');
  }
  function blurCurrent() {
    if (current) { current.classList.remove('focused'); current = null; }
  }
  function getFocus() { return current; }
  function inTopbar(el) {
    var p = el;
    while (p && p !== document.body) {
      if (p.className && String(p.className).indexOf('topbar') !== -1) return true;
      p = p.parentNode;
    }
    return false;
  }
  // Non-destructive: keeps the current focus when it is still valid, so async
  // data loads never snap the user back to the Home tab.
  function focusFirst() {
    var f = focusables();
    if (!f.length) return null;
    if (current && document.body.contains(current) && !inTopbar(current) &&
        (current.offsetParent !== null || current.getClientRects().length) &&
        (!scopeEl || scopeEl.contains(current))) return current;
    if (scopeEl) { setFocus(f[0]); return f[0]; }
    var content = [], i;
    for (i = 0; i < f.length; i++) if (!inTopbar(f[i])) content.push(f[i]);
    var target = content[0] || f[0];
    setFocus(target);
    return target;
  }
  function focusById(id) {
    var el = document.querySelector('[data-focus-id="' + id + '"]');
    if (el) { setFocus(el); return true; }
    return false;
  }
  // Spatial move: pick best candidate in direction by center distance + alignment
  function move(dir) {
    var list = focusables();
    if (!list.length) return false;
    if (!current) { setFocus(list[0]); return true; }
    var c = current.getBoundingClientRect();
    var cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    var best = null, bestScore = Infinity, i;
    for (i = 0; i < list.length; i++) {
      var e = list[i];
      if (e === current) continue;
      var r = e.getBoundingClientRect();
      var ex = r.left + r.width / 2, ey = r.top + r.height / 2;
      var dx = ex - cx, dy = ey - cy;
      var inDir = false, primary = 0, secondary = 0;
      if (dir === 'left') { inDir = dx < -4; primary = -dx; secondary = Math.abs(dy); }
      else if (dir === 'right') { inDir = dx > 4; primary = dx; secondary = Math.abs(dy); }
      else if (dir === 'up') { inDir = dy < -4; primary = -dy; secondary = Math.abs(dx); }
      else if (dir === 'down') { inDir = dy > 4; primary = dy; secondary = Math.abs(dx); }
      if (!inDir) continue;
      var score = primary + secondary * 3;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (best) { setFocus(best); return true; }
    return false;
  }
  function saveFocus(id) {
    stack.push({ viewId: id, el: current ? (current.getAttribute('data-focus-id') || '') : '' });
  }
  function restoreFocus(id) {
    for (var i = stack.length - 1; i >= 0; i--) {
      if (stack[i].viewId === id && stack[i].el) {
        if (focusById(stack[i].el)) { stack.splice(i, 1); return true; }
      }
    }
    return focusFirst() != null;
  }
  function clearStack() { stack = []; }
  return { setFocus: setFocus, getFocus: getFocus, focusFirst: focusFirst, focusById: focusById, move: move, saveFocus: saveFocus, restoreFocus: restoreFocus, clearStack: clearStack, focusables: focusables, setScope: setScope, clearScope: clearScope };
})();
