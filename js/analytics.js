/* Shared GoGo Company Google Tag Manager loader. Kept external so the
 * game's strict Content Security Policy does not need unsafe-inline. */
(function (window, document) {
  'use strict';
  if (window.__gogoGtmLoaded) return;
  window.__gogoGtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var firstScript = document.getElementsByTagName('script')[0];
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-TH4NX8MH';
  firstScript.parentNode.insertBefore(tag, firstScript);
})(window, document);
