/**
 * Arrow Out! - Google AdSense display ad wiring (menu screen only).
 * The loader tag lives in index.html. This module activates the single
 * labelled home-screen slot; gameplay screens never carry ads.
 * Until a Google-certified consent-management platform is wired in
 * (cmpReady below), the slot stays hidden for players detected in the
 * EEA, the UK or Switzerland.
 */
(function () {
  'use strict';

  var PUBLISHER = 'ca-pub-2895136878543415';
  var SLOTS = { 'ao-home': '7200569170' };
  var cmpReady = false; // set true only after a certified CMP integration

  function consentRegionLikely() {
    try {
      if (typeof navigator !== 'undefined' && navigator.language) {
        var lang = String(navigator.language).toLowerCase();
        if (lang.indexOf('en-gb') !== -1) return true;
      }
      if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
        var tz = '';
        try { tz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || ''; } catch (er) { tz = ''; }
        if (tz.indexOf('Europe/') === 0 || tz.indexOf('Atlantic/') === 0) return true;
      }
    } catch (er) { return true; }
    return false;
  }

  function loaderPresent() {
    if (typeof document === 'undefined' || !document.querySelector) return false;
    return !!document.querySelector('script[src*="adsbygoogle.js?client="]');
  }

  function activateSlots() {
    if (!loaderPresent()) return;
    if (cmpReady === false && consentRegionLikely()) return;
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    var hosts = document.querySelectorAll('.ad-slot[data-ad-slot]');
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      var unit = SLOTS[host.getAttribute('data-ad-slot')];
      var ins = host.querySelector ? host.querySelector('ins.adsbygoogle') : null;
      if (!unit || !ins || host.getAttribute('data-ad-active') === '1') continue;
      host.setAttribute('data-ad-active', '1');
      ins.setAttribute('data-ad-client', PUBLISHER);
      ins.setAttribute('data-ad-slot', unit);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      host.removeAttribute('hidden');
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (er) { /* ad library not ready: the labelled slot stays empty */ }
    }
  }

  function boot() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', activateSlots);
    } else {
      activateSlots();
    }
  }

  boot();
})();
