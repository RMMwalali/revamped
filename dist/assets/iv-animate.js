(function () {
  'use strict';
  var Q = function (s, el) { return (el || document).querySelector(s); };
  var QA = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  function hasText(el, s) { return el && el.textContent && el.textContent.indexOf(s) !== -1; }

  document.documentElement.classList.add('lenis');

  function locateStatsSection() {
    var mains = QA('main');
    for (var i = 0; i < mains.length; i++) {
      var children = Array.prototype.slice.call(mains[i].children);
      for (var j = 0; j < children.length; j++) {
        var c = children[j];
        if (c && c.querySelector && (c.querySelector('.css-5ohagv') || c.querySelector('.js-team-achievement-item'))) {
          return c;
        }
      }
    }
    // fallback: find element containing "participants" word as stat label
    var all = QA('div');
    for (i = 0; i < all.length; i++) {
      var p = all[i].querySelector('p.css-qg5m4o');
      if (p && /participants/i.test(p.textContent)) {
        // walk up to a reasonable outer container (the css-5ohagv parent)
        var up = p;
        while (up && up.parentElement && !(up.parentElement.classList.contains('css-5ohagv') || up.parentElement.children.length > 4)) {
          up = up.parentElement;
        }
        return up.parentElement || up;
      }
    }
    return null;
  }

  function initLenis() {
    if (typeof Lenis === 'undefined') return;
    var lenis = new Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
    return lenis;
  }

  function setupStats() {
    var sec = locateStatsSection();
    if (!sec) return;
    var secRoot = sec.parentElement;
    while (secRoot && secRoot.parentElement && secRoot !== document.querySelector('main')) secRoot = secRoot.parentElement;
    var outer = Q('.css-9nnxn7', sec) || sec;
    var wrap = Q('.css-5ohagv', sec) || sec;
    var inner = Q('.css-3rlusp', sec) || sec;
    var ct = Q('.css-ctko3l', inner || sec);
    if (!inner || !ct) return;

    var vh = Math.max(document.documentElement.clientHeight, window.innerHeight);
    // Original geometry: the stats section is a single 100svh viewport whose
    // content children overlap via absolute positioning (sticky inner).
    var travel = vh;
    if (sec) { sec.style.height = travel + 'px'; sec.style.overflow = 'clip'; }
    wrap.style.height = travel + 'px';
    outer.style.height = travel + 'px';
    outer.style.overflow = 'clip';
    outer.style.position = 'relative';

    // sticky viewport: inner pins for the travel range
    inner.style.position = 'sticky';
    inner.style.top = '0';
    inner.style.height = vh + 'px';
    inner.style.overflow = 'hidden';

    // Clip the entire passion section root so giant number columns don't extend scroll
    if (secRoot) {
      secRoot.style.position = 'relative';
      secRoot.style.overflow = 'hidden';
    }

    // content container is the relative viewport box
    ct.style.position = 'relative';
    ct.style.height = vh + 'px';
    ct.style.overflow = 'hidden';

    // Overlay the overlapping blocks at the original absolute offsets (1440x900 ref).
    // Small stat row (css-woa673) stays static at top; everything else is absolutely placed.
    var place = [
      ['.css-lvtjah', 292, 292],
      ['.css-7jq3c1', 256, 389],
      ['.css-x75brr', 430, 41],
      ['.css-71o8z3', 390, 119],
      ['.css-ufa12r', -98, 0],
      ['.css-41c6dw', 391, 118],
      ['.css-12ybk68', 840, 36]
    ];
    place.forEach(function (p) {
      var el = Q(p[0], ct);
      if (!el) return;
      el.style.position = 'absolute';
      el.style.top = p[1] + 'px';
      el.style.left = '0';
      el.style.width = '100%';
      el.style.height = p[2] + 'px';
      el.style.overflow = 'hidden';
    });

    // animate inner translate as you scroll through the travel range
    gsap.fromTo(inner, { y: '16%' }, {
      y: '-16%',
      ease: 'none',
      scrollTrigger: { trigger: sec || wrap, start: 'top top', end: 'bottom bottom', scrub: true }
    });

    // Roll the numbers: each stat column list rolls upward through the visible window
    QA('.css-h3wi0l', sec).forEach(function (list) {
      var items = QA('p', list);
      if (items.length < 2) return;
      var dy = -(items.length - 1) / items.length * 100;
      gsap.to(items, {
        y: dy + '%',
        ease: 'none',
        stagger: 0,
        scrollTrigger: { trigger: sec || wrap, start: 'top top', end: '+=' + (travel) + 'px', scrub: true }
      });
    });
  }

  function setupProduced() {
    var sec = document.getElementById('produced-section');
    if (!sec) {
      // locate by its wrapper class
      sec = Q('main .css-ci5sz3');
    }
    if (!sec) return;
    var vh = Math.max(document.documentElement.clientHeight, window.innerHeight);
    // The cities track overflows a fixed 100svh clip window.
    QA('.css-c3tei4,.css-i9p357', sec).forEach(function (e) { e.style.height = vh + 'px'; e.style.overflow = 'hidden'; });
    // The bottom info row (css-1jeuzur) overlays the section rather than adding height
    // (matches the original 900px produced section).
    var jeuzur = Q('.css-1jeuzur', sec);
    if (jeuzur) {
      sec.style.position = 'relative';
      jeuzur.style.position = 'absolute';
      jeuzur.style.bottom = '0';
      jeuzur.style.left = '0';
      jeuzur.style.width = '100%';
    }
    var track = Q('.css-1b723r6', sec) || sec;
    var dist = track.scrollHeight - vh;
    if (dist < 10) dist = vh;
    gsap.fromTo(track, { y: 0 }, {
      y: -dist,
      ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  }

  function setupPassion() {
    var sec = Q('main .js-team-achievement-item');
    if (!sec) return;
    var secRoot = sec.parentElement;
    while (secRoot && secRoot.parentElement && secRoot !== document.querySelector('main')) secRoot = secRoot.parentElement;
    // Collapse the recruit/achievement sub-block so the whole passion section is a
    // single 100svh viewport like the original (its tall stack is overlaid, not stacked).
    var header = secRoot ? secRoot.querySelector('.css-4ysux8') : null;
    var ezood = secRoot ? secRoot.querySelector('.css-1ezuood') : null;
    var vh = Math.max(document.documentElement.clientHeight, window.innerHeight);
    if (secRoot && ezood && header) {
      var headH = header.getBoundingClientRect().height;
      secRoot.style.position = 'relative';
      secRoot.style.overflow = 'hidden';
      ezood.style.position = 'relative';
      ezood.style.height = Math.max(0, Math.round(vh - headH)) + 'px';
      ezood.style.overflow = 'hidden';
    }
    // rolling number columns (a1l9nu)
    QA('.css-155g5tn', document).forEach(function (col) {
      var cells = QA('div', col);
      if (cells.length < 2) return;
      gsap.fromTo(cells, { yPercent: 0 }, {
        yPercent: -(cells.length - 1),
        ease: 'none',
        scrollTrigger: { trigger: col, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  function setupInsights() {
    var sec = Q('main .styles_invention__bakTB, main .styles_invention_main__C05bH');
    if (sec) {
      var root = sec.classList.contains('styles_invention__bakTB') ? sec : sec.closest('.styles_invention__bakTB');
      if (root) {
        var vh = Math.max(document.documentElement.clientHeight, window.innerHeight);
        root.style.height = vh + 'px';
      }
    }
  }

  function setupWorked() {
    var sec = Q('.styles_worked__ZRqpe');
    if (!sec) return;
    var main = Q('.styles_worked_main__rjWnX') || sec;
    gsap.fromTo(main, { y: 60 }, {
      y: -60,
      ease: 'none',
      scrollTrigger: { trigger: sec, start: 'bottom top', end: 'top bottom', scrub: true }
    });
  }

  function setupHero() {
    var h1 = Q('main h1');
    if (!h1) return;
    // line-mask reveal on load
    QA('.line-mask .line, .line.fix-clip', document).forEach(function (line) {
      gsap.fromTo(line, {
        yPercent: 120,
        clipPath: 'inset(0 0 100% 0)'
      }, {
        yPercent: 0,
        clipPath: 'inset(0 0 0% 0)',
        duration: 1.1,
        ease: 'power4.out',
        stagger: 0.06
      });
    });
  }

  function setupMenu() {
    var btn = Q('header [aria-label="menu button"]');
    var menus = Q('.styles_menus__Fobad');
    var overlay = Q('.styles_overlay__SxW5X');
    var inner = Q('.styles_menus_inner__9X7sY');
    if (!btn || !menus) return;
    var open = false;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      open = !open;
      if (open) {
        menus.classList.add('styles_toggled__4yeBE');
        if (inner) inner.classList.add('styles_on_show__wWWIr');
        if (overlay) overlay.classList.add('styles_toggled__4yeBE');
        gsap.to(menus, { opacity: 1, duration: 0.4 });
      } else {
        gsap.to(menus, { opacity: 0, duration: 0.3, onComplete: function () {
          menus.classList.remove('styles_toggled__4yeBE');
          if (inner) inner.classList.remove('styles_on_show__wWWIr');
          if (overlay) overlay.classList.remove('styles_toggled__4yeBE');
        }});
      }
    });
  }

  window.addEventListener('load', function () {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);
    initLenis();
    setupStats();
    setupProduced();
    setupPassion();
    setupInsights();
    setupWorked();
    setupHero();
    setupMenu();
    ScrollTrigger.refresh();
  });
})();