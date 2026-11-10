/* Versioned, per-profile storage with size cap */
var Store = (function () {
  'use strict';
  var ROOT_KEY = 'nuvio-lite-v1';
  var MAX_BYTES = 900 * 1024; // stay under quota
  var state = null;

  function defaultProfile() {
    return {
      addons: [
        { url: 'https://v3-cinemeta.strem.io/manifest.json', enabled: true, manifest: null, addedAt: 0 }
      ],
      library: [],      // {type,id,title,poster,addedAt}
      watched: {},      // "type:id" -> true  (episodes: "type:id:season:ep")
      history: {},      // "type:id" -> {pos,dur,ts,title,poster,type,id,videoId}
      settings: {
        lang: 'en', dir: 'ltr',
        subLang: 'en', subSize: 'medium', subColor: 'white',
        audioLang: 'en', enforceAudioLang: 'on', defaultQuality: 'any',
        playerEngine: 'auto',
        resolverMode: 'debrid', resolverBase: '', resolverAdapter: 'stremio-server',
        lastQuality: '', trakt: { token: null, refresh: null, username: '' }
      }
    };
  }
  function defaultState() {
    return { version: 1, currentProfile: 'P1', profiles: { P1: defaultProfile() } };
  }
  function load() {
    try {
      var raw = localStorage.getItem(ROOT_KEY);
      if (!raw) { state = defaultState(); save(); return state; }
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !parsed.profiles) { state = defaultState(); save(); return state; }
      // migrate missing fields
      var pids = Object.keys(parsed.profiles), i;
      for (i = 0; i < pids.length; i++) {
        var d = defaultProfile(), p = parsed.profiles[pids[i]], k;
        for (k in d) if (p[k] == null) p[k] = d[k];
        for (k in d.settings) if (p.settings[k] == null) p.settings[k] = d.settings[k];
      }
      if (!parsed.profiles[parsed.currentProfile]) parsed.currentProfile = pids[0];
      state = parsed;
    } catch (e) {
      state = defaultState();
    }
    return state;
  }
  function save() {
    try {
      var raw = JSON.stringify(state);
      if (raw.length > MAX_BYTES) {
        // trim history oldest until fits
        var prof = profile();
        var keys = Object.keys(prof.history).sort(function (a, b) { return (prof.history[a].ts || 0) - (prof.history[b].ts || 0); });
        while (raw.length > MAX_BYTES && keys.length) { delete prof.history[keys.shift()]; raw = JSON.stringify(state); }
        if (raw.length > MAX_BYTES) { prof.history = {}; raw = JSON.stringify(state); }
      }
      localStorage.setItem(ROOT_KEY, raw);
    } catch (e) { /* quota - keep in-memory */ }
  }
  function profile() { return state.profiles[state.currentProfile]; }
  function settings() { return profile().settings; }
  function setSetting(k, v) { profile().settings[k] = v; save(); }
  function profileNames() { return Object.keys(state.profiles); }
  function createProfile(id, name) {
    if (profileNames().length >= 4) return false;
    if (state.profiles[id]) return false;
    var p = defaultProfile(); p.name = name || id;
    state.profiles[id] = p; save(); return true;
  }
  function deleteProfile(id) {
    if (profileNames().length <= 1 || id === state.currentProfile) return false;
    delete state.profiles[id]; save(); return true;
  }
  function switchProfile(id) {
    if (!state.profiles[id]) return false;
    state.currentProfile = id; save(); return true;
  }
  function clearAll() {
    try { localStorage.removeItem(ROOT_KEY); } catch (e) {}
    state = defaultState(); save();
  }
  function clearCache() { save(); }
  load();
  return {
    load: load, save: save, profile: profile, settings: settings, setSetting: setSetting,
    profileNames: profileNames, createProfile: createProfile, deleteProfile: deleteProfile,
    switchProfile: switchProfile, clearAll: clearAll, clearCache: clearCache, state: function () { return state; }
  };
})();
