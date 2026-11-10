/* On-screen keyboard: QWERTY + Arabic + symbols page (URLs), RTL-aware. ES5. */
var Kb = (function () {
  'use strict';
  var LETTERS = {
    qwerty: [
      ['1','2','3','4','5','6','7','8','9','0'],
      ['q','w','e','r','t','y','u','i','o','p'],
      ['a','s','d','f','g','h','j','k','l'],
      ['z','x','c','v','b','n','m']
    ],
    arabic: [
      ['1','2','3','4','5','6','7','8','9','0'],
      ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح'],
      ['ج','د','ش','س','ي','ب','ل','ا','ت'],
      ['ن','م','ك','ط','ئ','ء','ؤ']
    ]
  };
  // Symbols page: characters needed for URLs and general input
  var SYMBOLS = [
    ['1','2','3','4','5','6','7','8','9','0'],
    [':','/','.','-','_','?','=','&'],
    ['#','@','%','+','~',',',';','!'],
    ['(',')','[',']','{','}','<','>']
  ];
  var QUICK = ['https://', 'http://', '.com', '.org'];
  var layout = 'qwerty';
  var page = 'letters';
  var value = '';
  var onInput = null;
  var onDone = null;
  var idPrefix = 'kb';
  var lastOpts = null;

  function esc(s) { return String(s == null ? '' : s); }

  function build(container) {
    container.innerHTML = '';
    var wrap = Util.el('div', 'kb-wrap');
    var display = Util.el('div', 'kb-display focusable');
    display.setAttribute('data-focus-id', idPrefix + '-display');
    display.setAttribute('data-action', 'kb-focus');
    display.textContent = value || '...';
    wrap.appendChild(display);

    // Quick-insert URL fragments only for URL fields (they were cluttering search).
    if (lastOpts && lastOpts.url) {
      var quickRow = Util.el('div', 'kb-row kb-quick-row');
      for (var q = 0; q < QUICK.length; q++) {
        (function (txt, qi) {
          var b = Util.el('button', 'kb-key kb-quick focusable', txt);
          b.setAttribute('data-focus-id', idPrefix + '-quick-' + qi);
          b.setAttribute('data-action', 'kb-insert');
          b.setAttribute('data-text', txt);
          b.setAttribute('type', 'button');
          quickRow.appendChild(b);
        })(QUICK[q], q);
      }
      wrap.appendChild(quickRow);
    }

    var rows = page === 'symbols' ? SYMBOLS : LETTERS[layout];
    var r, c;
    for (r = 0; r < rows.length; r++) {
      var rowEl = Util.el('div', 'kb-row');
      for (c = 0; c < rows[r].length; c++) {
        (function (ch, rr, cc) {
          var b = Util.el('button', 'kb-key focusable', ch);
          b.setAttribute('data-focus-id', idPrefix + '-' + rr + '-' + cc);
          b.setAttribute('data-action', 'kb-key');
          b.setAttribute('data-char', ch);
          b.setAttribute('type', 'button');
          rowEl.appendChild(b);
        })(rows[r][c], r, c);
      }
      wrap.appendChild(rowEl);
    }

    var ctrl = Util.el('div', 'kb-row kb-ctrl');
    var pageLabel = page === 'symbols' ? 'ABC' : '?123';
    var btns = [
      { label: I18n.t('space'), act: 'kb-space', id: 'space' },
      { label: '⌫', act: 'kb-back', id: 'back' },
      { label: I18n.t('clear'), act: 'kb-clear', id: 'clear' },
      { label: pageLabel, act: 'kb-page', id: 'page' },
      { label: (layout === 'qwerty' ? 'AR' : 'EN'), act: 'kb-layout', id: 'layout' },
      { label: I18n.t('done'), act: 'kb-done', id: 'done' }
    ];
    for (var b = 0; b < btns.length; b++) {
      (function (spec) {
        var btn = Util.el('button', 'kb-key kb-ctrl-btn focusable', spec.label);
        btn.setAttribute('data-focus-id', idPrefix + '-ctrl-' + spec.id);
        btn.setAttribute('data-action', spec.act);
        btn.setAttribute('type', 'button');
        ctrl.appendChild(btn);
      })(btns[b]);
    }
    wrap.appendChild(ctrl);
    container.appendChild(wrap);
    updateDisplay();
  }

  function render(container, opts) {
    opts = opts || {};
    value = opts.initial || '';
    onInput = opts.onInput || null;
    onDone = opts.onDone || null;
    layout = opts.layout || Store.settings().kbLayout || 'qwerty';
    page = opts.page || 'letters';
    idPrefix = opts.idPrefix || 'kb';
    lastOpts = { container: container, onInput: onInput, onDone: onDone, idPrefix: idPrefix, layout: layout, url: !!opts.url };
    build(container);
  }

  function rerender(focusId) {
    if (!lastOpts || !lastOpts.container) return;
    build(lastOpts.container);
    if (focusId) { if (!FocusMgr.focusById(focusId)) FocusMgr.focusFirst(); }
  }

  function updateDisplay(d) {
    d = d || document.querySelector('.kb-display');
    if (d) d.textContent = value || '...';
  }

  function emit() {
    updateDisplay();
    if (onInput) onInput(value);
  }

  function handleAction(action, el) {
    if (action === 'kb-key') { value += el.getAttribute('data-char'); emit(); return true; }
    if (action === 'kb-insert') { value += el.getAttribute('data-text'); emit(); return true; }
    if (action === 'kb-space') { value += ' '; emit(); return true; }
    if (action === 'kb-back') { value = value.slice(0, -1); emit(); return true; }
    if (action === 'kb-clear') { value = ''; emit(); return true; }
    if (action === 'kb-page') {
      page = page === 'symbols' ? 'letters' : 'symbols';
      rerender(idPrefix + '-ctrl-page');
      return true;
    }
    if (action === 'kb-layout') {
      layout = layout === 'qwerty' ? 'arabic' : 'qwerty';
      Store.setSetting('kbLayout', layout);
      page = 'letters';
      rerender(idPrefix + '-ctrl-layout');
      return true;
    }
    if (action === 'kb-done') { if (onDone) onDone(value); return true; }
    if (action === 'kb-focus') { return true; }
    return false;
  }

  function getValue() { return value; }
  function setValue(v) { value = v || ''; emit(); }
  return { render: render, handleAction: handleAction, getValue: getValue, setValue: setValue };
})();
