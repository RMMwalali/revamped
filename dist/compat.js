/* CLONE-COMPAT loader (not part of the original site). Registers sw.js so that
 * Next.js image-optimizer URLs resolve on plain static hosts. No-op if the
 * host already handles /_next/image (e.g. `npm run serve`). */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var probe = new Image();
  probe.onerror = function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  };
  probe.src = '/_next/image?url=%2Ffavicon.ico&w=16&q=10';
})();
