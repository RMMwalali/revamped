/* StillCraft admin edit bar — injected only for authenticated admins.
   ID-free targeting: elements are matched by exact content (orig + occurrence
   index), because React hydration re-renders from vdom and drops baked ids. */
(function () {
  'use strict';
  var PAGE = window.__SC_PAGE__ || '/';
  var ACCENT = '#C9A24B';
  var dirty = {};      // key -> { kind, value, orig, idx }
  var overrides = [];  // [{ el_id, kind, value, orig_html, idx }]
  var active = null;

  var TEXT_TAGS = /^(P|H1|H2|H3|H4|H5|H6|LI|A|SPAN|BUTTON|BLOCKQUOTE|FIGCAPTION|DT|DD|TD|TH|LABEL)$/;

  function $(s, el) { return (el || document).querySelector(s); }
  function toast(msg, bad) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('style', 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:' + (bad ? '#ff6b6b' : ACCENT) + ';color:#111;font:600 14px Arial,sans-serif;' +
      'padding:10px 20px;border-radius:999px;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,.4);');
    document.documentElement.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  // ---------- candidates (text, images, video — excluding our own UI) ----------
  function isCandidate(el) {
    if (!el || el.closest('#sc-bar,#sc-brand-panel')) return null;
    if (el.tagName === 'IMG' && el.getAttribute('src')) return 'image';
    if (el.tagName === 'VIDEO' && (el.getAttribute('src') || $(el, 'source[src]'))) return 'video';
    if (el.tagName === 'SOURCE' && el.parentElement && el.parentElement.tagName === 'VIDEO') return 'video';
    if (TEXT_TAGS.test(el.tagName) && el.innerHTML.trim()) return 'text';
    return null;
  }

  // Climb from a clicked node to the element the user actually means. The
  // animated-copy stack (span.css-3w1c3c > div.line-mask > div.line > sliced
  // text) exposes the SAME visible text at every level, so walking up while
  // the text stays identical lands on the real heading/paragraph — and stops
  // the editor from recording framework-mutated wrapper markup (live
  // transform/--rX/--line-index values never match on the next render).
  function editableTarget(el) {
    if (!el || el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'SOURCE') return el;
    var base = (el.innerText || el.textContent || '').trim();
    if (!base) return el;
    var t = el;
    var top = el;
    while (t && t.parentElement && t.parentElement !== document.body) {
      var p = t.parentElement;
      if ((p.innerText || p.textContent || '').trim() !== base) break;
      if (TEXT_TAGS.test(p.tagName)) top = p;
      t = p;
    }
    return top;
  }

  // Serialize content without presentation chrome: unwrap div/span wrappers
  // that only carry animation/positioning (line-mask, fix-clip, css-hashed
  // classes, live transform/animation styles) and drop framework-mutated
  // inline styles, so the recorded orig/value stay stable between sessions and
  // match the static markup the server/guard re-finds.
  function cleanTextHTML(el) {
    // clean() returns an HTML string at every branch. It used to return a Node
    // from some branches and a String from others, which meant
    // appendChild(string) threw "parameter 1 is not of type 'Node'" the moment
    // a node contained an unwrapped chrome span - and the string branch
    // concatenated Nodes into "[object HTMLDivElement]". Since nearly every
    // heading and paragraph on this site is wrapped in css-3w1c3c spans, that
    // exception fired on almost any text click and killed text editing.
    function esc(v) {
      return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function clean(node) {
      if (node.nodeType === 3) return esc(node.nodeValue || '');
      if (node.nodeType !== 1) return '';
      var tag = node.tagName;
      var cls = String(node.className || '');
      var st = String(node.getAttribute ? node.getAttribute('style') || '' : '');
      var chrome = /line-mask|fix-mask|fix-clip|will-change|css-3w1c3c|css-1lpdf6v/.test(cls) ||
                   /transform|translate|rotate|scale|--r[XY]|animation/i.test(st);
      var inner = '';
      for (var c = 0; c < node.childNodes.length; c++) inner += clean(node.childNodes[c]);
      if (/^(DIV|SPAN)$/.test(tag) && chrome) return inner;
      var clone = node.cloneNode(false);
      if (clone.removeAttribute) {
        clone.removeAttribute('style');
        // Strip what the editor itself added, or it gets baked into the saved
        // value: contenteditable would ship to visitors, and the sc-* classes
        // make orig and value differ on every pass so nothing ever matches.
        clone.removeAttribute('contenteditable');
        var kept = String(clone.className || '')
          .split(/\s+/).filter(function (c) { return c && c !== 'sc-cand' && c !== 'sc-editing'; })
          .join(' ');
        if (kept) clone.setAttribute('class', kept); else clone.removeAttribute('class');
      }
      clone.innerHTML = inner;
      return clone.outerHTML;
    }
    // Serialize the element's CONTENT, not the element itself. The server
    // matches a text override by this string: replaceElInner swaps inner HTML,
    // and patchFlight looks for it inside the flight payload, which carries
    // text without the surrounding tag. Emitting outerHTML made both lookups
    // miss, so edits saved but never reached a visitor.
    var inner = '';
    for (var i = 0; i < el.childNodes.length; i++) inner += clean(el.childNodes[i]);
    return inner.replace(/\s+/g, ' ').replace(/ >/g, '>').replace(/> </g, '><').trim();
  }

  // nth occurrence of the same content among same-tag peers (for duplicates)
  function peerIndex(el, kind) {
    if (kind === 'video') {
      var key = el.tagName === 'VIDEO'
        ? (el.getAttribute('src') || ($(el, 'source[src]') ? $(el, 'source[src]').getAttribute('src') : '') || '')
        : el.getAttribute('src') || '';
      var list = document.getElementsByTagName('VIDEO');
      var n = 0;
      for (var i = 0; i < list.length; i++) {
        if (list[i].closest('#sc-bar,#sc-brand-panel')) continue;
        var k = list[i].getAttribute('src') || ($(list[i], 'source[src]') ? $(list[i], 'source[src]').getAttribute('src') : '') || '';
        if (k === key) {
          if (list[i] === el || (el.tagName === 'SOURCE' && list[i] === el.parentElement)) return n;
          n++;
        }
      }
      return 0;
    }
    var key = kind === 'image' ? el.getAttribute('src') : (kind === 'text' ? cleanTextHTML(el) : el.innerHTML);
    var list = document.getElementsByTagName(el.tagName);
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].closest('#sc-bar,#sc-brand-panel')) continue;
      var k = kind === 'image' ? list[i].getAttribute('src') : (kind === 'text' ? cleanTextHTML(list[i]) : list[i].innerHTML);
      if (k === key) {
        if (list[i] === el) return n;
        n++;
      }
    }
    return 0;
  }

  // ---------- apply overrides (post-hydration safety net) ----------
  function textPeers(tag, orig) {
    var out = [];
    var tags = (tag && TEXT_TAGS.test(tag.toUpperCase())) ? [tag.toUpperCase()] :
      ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'A', 'SPAN', 'BUTTON'];
    tags.forEach(function (tg) {
      var list = document.getElementsByTagName(tg);
      for (var i = 0; i < list.length; i++) {
        if (list[i].closest('#sc-bar,#sc-brand-panel')) continue;
        if (list[i].innerHTML === orig || cleanTextHTML(list[i]) === orig) out.push(list[i]);
      }
    });
    return out;
  }

  function imgPeers(orig) {
    var out = [];
    var list = document.getElementsByTagName('IMG');
    for (var i = 0; i < list.length; i++) {
      if (list[i].closest('#sc-bar,#sc-brand-panel')) continue;
      if (list[i].getAttribute('src') === orig) out.push(list[i]);
    }
    return out;
  }

  function mediaPeers(orig) {
    var out = [];
    var vids = document.getElementsByTagName('VIDEO');
    for (var i = 0; i < vids.length; i++) {
      if (vids[i].closest('#sc-bar,#sc-brand-panel')) continue;
      var src = vids[i].getAttribute('src');
      if (src && src === orig) out.push({ el: vids[i], attr: 'src' });
      else if (vids[i].poster && vids[i].poster === orig) out.push({ el: vids[i], attr: 'poster' });
      var srcs = vids[i].getElementsByTagName('source');
      for (var j = 0; j < srcs.length; j++) {
        if (srcs[j].getAttribute('src') === orig) out.push({ el: srcs[j], attr: 'src' });
      }
    }
    return out;
  }

  function applyAll() {
    overrides.forEach(function (o) {
      if (dirty[o.el_id]) return;
      var idx = o.idx || 0;
      if (o.kind === 'image') {
        var imgs = imgPeers(o.orig_html);
        var img = imgs[idx] || imgs[0];
        if (img && img.getAttribute('src') !== o.value) {
          img.setAttribute('src', o.value);
          img.removeAttribute('srcset');
          img.removeAttribute('sizes');
        }
        return;
      }
      if (o.kind === 'media') {
        var peers = mediaPeers(o.orig_html);
        var peer = peers[idx] || peers[0];
        if (peer && peer.el) {
          if (peer.el.tagName === 'SOURCE' || peer.attr === 'src') peer.el.setAttribute('src', o.value);
          else peer.el.setAttribute(peer.attr, o.value);
          peer.el.load && peer.el.load();
        }
        return;
      }
      var els = textPeers(o.tag, o.orig_html);
      var el = els[idx] || els[0];
      if (el && el.innerHTML !== o.value) el.innerHTML = o.value;
    });
  }

  function loadOverrides() {
    api('/api/content?page=' + encodeURIComponent(PAGE)).then(function (d) {
      overrides = d.items || [];
      applyAll();
    }).catch(function () {});
  }

  // ---------- edit bar UI (floating, bottom-left; never shifts page layout) ----------
  function buildBar() {
    try {
    if (document.querySelector('#sc-bar')) return;
    window.__sc_editbar_on = 1;
    if (sessionStorage.getItem('sc_hide') === '1') { buildFab(); return; }
    var bar = document.createElement('div');
    bar.id = 'sc-bar';
    bar.innerHTML =
      '<style>' +
      '#sc-bar{position:fixed;left:12px;bottom:12px;z-index:2147483646;' +
      'background:rgba(20,20,20,.96);color:#f3efeb;display:flex;flex-direction:row;align-items:center;gap:10px;flex-wrap:wrap;' +
      'padding:10px 14px;font:400 13px Arial,sans-serif;border:1px solid #2c2c2a;border-radius:999px;' +
      'box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:calc(100vw - 24px);}' +
      '#sc-bar .top{display:flex;align-items:center;gap:8px;flex:none;}' +
      '#sc-bar .dot{width:9px;height:9px;border-radius:50%;background:' + ACCENT + ';flex:none;}' +
      '#sc-bar b{font-weight:700;letter-spacing:1px;white-space:nowrap;}' +
      '#sc-bar .pg{color:#9a978f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;}' +
      '#sc-bar .hint{display:none;}' +
      '#sc-bar .row{display:contents;}' +
      '#sc-bar button{background:#2a2a28;color:#f3efeb;border:1px solid #3a3a38;border-radius:999px;' +
      'padding:7px 12px;font:600 12px Arial,sans-serif;cursor:pointer;}' +
      '#sc-bar button:hover{border-color:' + ACCENT + ';}' +
      '#sc-bar #sc-save{background:' + ACCENT + ';color:#111;border:0;}' +
      '#sc-bar #sc-save:disabled{opacity:.45;cursor:default;}' +
      '#sc-bar-on .sc-cand:hover{outline:1px dashed ' + ACCENT + ';cursor:text;}' +
      '#sc-bar-on img.sc-cand:hover{outline:2px dashed ' + ACCENT + ';cursor:pointer;}' +
      '#sc-bar-on video.sc-cand:hover{outline:2px dashed ' + ACCENT + ';cursor:pointer;}' +
      '.sc-editing{outline:2px solid ' + ACCENT + ' !important;background:rgba(201,162,75,.12);}' +
      '#sc-brand-panel{position:fixed;left:12px;bottom:12px;width:300px;z-index:2147483647;' +
      'background:#1c1c1a;border:1px solid #3a3a38;border-radius:14px;padding:20px;' +
      'font:400 13px Arial,sans-serif;color:#f3efeb;display:none;}' +
      '#sc-brand-panel.open{display:block;}' +
      '#sc-bar.hidden{display:none;}' +
      '#sc-brand-panel label{display:block;color:#9a978f;font-size:11px;letter-spacing:1px;margin:12px 0 4px;}' +
      '#sc-brand-panel input[type=text]{width:100%;background:#111;border:1px solid #3a3a38;' +
      'color:#f3efeb;border-radius:8px;padding:8px 10px;font-size:13px;}' +
      '#sc-brand-panel input[type=color]{width:100%;height:34px;border:0;background:none;padding:0;cursor:pointer;}' +
      '#sc-brand-panel .row{display:flex;gap:8px;margin-top:16px;}' +
      '#sc-brand-panel .row button{flex:1;background:' + ACCENT + ';color:#111;border:0;border-radius:999px;' +
      'padding:9px;font:700 12px Arial,sans-serif;cursor:pointer;}' +
      '</style>' +
      '<span class="dot"></span><b>STILLCRAFT</b><span class="pg"></span>' +
      '<span class="hint">Click any text to edit · click images/videos to swap</span>' +
      '<span class="row"><button id="sc-brand">Brand</button>' +
      '<button id="sc-cms">CMS</button>' +
      '<button id="sc-save" disabled>Save (0)</button></span>' +
      '<span class="row"><button id="sc-discard">Discard</button>' +
      '<button id="sc-hide">Hide</button>' +
      '<button id="sc-logout">Logout</button></span>';
    document.documentElement.appendChild(bar);
    bar.querySelector('.pg').textContent = PAGE;
    document.documentElement.id = 'sc-bar-on';
    markCandidates();

    $('#sc-save').addEventListener('click', save);
    $('#sc-discard').addEventListener('click', function () {
      if (Object.keys(dirty).length && !confirm('Discard all unsaved edits?')) return;
      window.location.reload();
    });
    $('#sc-hide').addEventListener('click', function () {
      sessionStorage.setItem('sc_hide', '1');
      window.location.reload();
    });
    $('#sc-logout').addEventListener('click', function () {
      fetch('/api/logout', { method: 'POST' }).then(function () { window.location.href = '/'; });
    });
    $('#sc-brand').addEventListener('click', toggleBrandPanel);
    var cmsBtn = $('#sc-cms');
    if (cmsBtn) cmsBtn.addEventListener('click', function () { window.open('/insider', '_blank'); });

    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && active) active.blur();
    });
    } catch (err) { window.__sc_err = String(err && err.stack || err).slice(0, 300); }
  }

  function markCandidates() {
    var els = document.body.getElementsByTagName('*');
    for (var i = 0; i < els.length; i++) {
      if (isCandidate(els[i])) els[i].classList.add('sc-cand');
    }
  }

  function buildFab() {
    var b = document.createElement('button');
    b.textContent = '✎ Edit';
    b.setAttribute('style', 'position:fixed;bottom:20px;right:20px;z-index:2147483646;' +
      'background:' + ACCENT + ';color:#111;border:0;border-radius:999px;padding:12px 20px;' +
      'font:700 13px Arial,sans-serif;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.4);');
    b.addEventListener('click', function () {
      sessionStorage.removeItem('sc_hide');
      window.location.reload();
    });
    document.documentElement.appendChild(b);
  }

  // ---------- editing ----------
  function key(kind, tag, idx) { return 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }

  function markDirty(k, kind, value, orig, idx, tag) {
    dirty[k] = { kind: kind, value: value, orig: orig, idx: idx, tag: tag };
    updateSave();
  }

  function updateSave() {
    var n = Object.keys(dirty).length;
    var b = $('#sc-save');
    if (b) { b.disabled = !n; b.textContent = 'Save (' + n + ')'; }
  }

  function onClick(e) {
    var bar = e.target.closest && e.target.closest('#sc-bar,#sc-brand-panel');
    if (bar) return;
    var t = e.target.closest ? e.target.closest('img,p,h1,h2,h3,h4,h5,h6,li,a,span,button,video,source') : null;
    if (!t || !isCandidate(t)) { if (active) active.blur(); return; }
    var kind = isCandidate(t);
    e.preventDefault(); e.stopPropagation();
    if (kind === 'image') pickImage(t);
    else if (kind === 'video') pickMedia(t);
    else startTextEdit(t);
  }

  function startTextEdit(el, _id) {
    var target = editableTarget(el);
    el = target;
    if (active && active !== el) active.blur();
    active = el;
    var orig = cleanTextHTML(el);
    var idx = peerIndex(el, 'text');
    var k = key('text', el.tagName, idx);
    el.contentEditable = 'true';
    el.classList.add('sc-editing');
    el.focus();
    el.addEventListener('blur', function onBlur() {
      el.removeEventListener('blur', onBlur);
      el.contentEditable = 'false';
      el.classList.remove('sc-editing');
      if (active === el) active = null;
      var v = cleanTextHTML(el);
      if (v !== orig) markDirty(k, 'text', v, orig, idx, el.tagName);
      updateSave();
    });
  }

  var fileInput = null;
  function ensureInput() {
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg';
      document.documentElement.appendChild(fileInput);
    }
    return fileInput;
  }

  function pickImage(img) {
    var input = ensureInput();
    input.onchange = function () {
      var f = input.files[0];
      input.value = '';
      if (!f) return;
      var orig = img.getAttribute('src') || '';
      var idx = peerIndex(img, 'image');
      var tag = img.tagName;
      var fd = new FormData();
      fd.append('image', f);
      toast('Uploading…');
      fetch('/api/upload', { method: 'POST', body: fd }).then(function (r) {
        if (!r.ok) throw new Error();
        return r.json();
      }).then(function (d) {
        img.setAttribute('src', d.src);
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        markDirty(key('image', tag, idx), 'image', d.src, orig, idx, tag);
        toast('Image swapped — press Save');
      }).catch(function () { toast('Upload failed (must be an image)', true); });
    };
    input.click();
  }

  function pickMedia(video) {
    var input = ensureInput();
    input.onchange = function () {
      var f = input.files[0];
      input.value = '';
      if (!f) return;
      // Which attr to overwrite: prefer poster when user picks an image,
      // otherwise the video src (or the first <source> inside).
      var isImg = /^image\//.test(f.type || '');
      var orig, idx, target;
      if (isImg) {
        orig = video.poster || (video.getAttribute('src') || '');
        target = { el: video, attr: 'poster', kind: 'media' };
        if (!orig && video.querySelector) {
          var psrc = video.querySelector('source[src]');
          if (psrc) orig = psrc.getAttribute('src') || '';
        }
      } else {
        var srcEl = video.hasAttribute('src') ? video : (video.querySelector && video.querySelector('source[src]'));
        orig = srcEl ? srcEl.getAttribute('src') : (video.poster || '');
        if (!srcEl) srcEl = video;
        target = { el: srcEl, attr: 'src', kind: 'media' };
      }
      idx = peerIndex(video, 'video');
      var fd = new FormData();
      fd.append('image', f);
      toast('Uploading…');
      fetch('/api/upload', { method: 'POST', body: fd }).then(function (r) {
        if (!r.ok) throw new Error();
        return r.json();
      }).then(function (d) {
        if (target.attr === 'poster') {
          video.setAttribute('poster', d.src);
        } else {
          target.el.setAttribute('src', d.src);
        }
        video.load && video.load();
        markDirty(key('media', video.tagName, idx), 'media', d.src, orig, idx, video.tagName);
        toast('Media swapped — press Save');
      }).catch(function () { toast('Upload failed (max 250MB, image/video/audio)', true); });
    };
    input.click();
  }

  function save() {
    var items = Object.keys(dirty).map(function (k) {
      return { el_id: k, kind: dirty[k].kind, value: dirty[k].value, orig: dirty[k].orig, idx: dirty[k].idx || 0, tag: dirty[k].tag || '' };
    });
    if (!items.length) return;
    var b = $('#sc-save');
    b.disabled = true; b.textContent = 'Saving…';
    api('/api/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: PAGE, items: items })
    }).then(function (d) {
      toast('Saved ' + d.saved + ' change(s) — live now');
      dirty = {};
      updateSave();
      loadOverrides();
    }).catch(function () {
      toast('Save failed', true);
      updateSave();
    });
  }

  // ---------- brand panel ----------
  function toggleBrandPanel() {
    var p = $('#sc-brand-panel');
    var bar = $('#sc-bar');
    if (p) {
      var open = p.classList.toggle('open');
      if (bar) bar.classList.toggle('hidden', open);
      return;
    }
    p = document.createElement('div');
    p.id = 'sc-brand-panel';
    p.innerHTML =
      '<b>Brand settings</b>' +
      '<label>SITE NAME</label><input type="text" id="sc-b-name">' +
      '<label>TAGLINE</label><input type="text" id="sc-b-tag">' +
      '<label>LOGO (upload replaces header/footer mark)</label><input type="file" id="sc-b-logo" accept="image/*">' +
      '<label>PRIMARY COLOR</label><input type="color" id="sc-b-pri">' +
      '<label>ACCENT COLOR</label><input type="color" id="sc-b-acc">' +
      '<div class="row"><button id="sc-b-save">Apply brand</button></div>';
    document.documentElement.appendChild(p);
    p.classList.add('open');
    if (bar) bar.classList.add('hidden');
    api('/api/brand').then(function (b) {
      $('#sc-b-name').value = b.site_name || '';
      $('#sc-b-tag').value = b.tagline || '';
      $('#sc-b-pri').value = /^#[0-9a-f]{6}$/i.test(b.primary_color || '') ? b.primary_color : '#1B2A4A';
      $('#sc-b-acc').value = /^#[0-9a-f]{6}$/i.test(b.accent_color || '') ? b.accent_color : '#C9A24B';
    }).catch(function () {});
    $('#sc-b-save').addEventListener('click', function () {
      var done = function (logoSrc) {
        var payload = {
          site_name: $('#sc-b-name').value,
          tagline: $('#sc-b-tag').value,
          primary_color: $('#sc-b-pri').value,
          accent_color: $('#sc-b-acc').value
        };
        if (logoSrc) payload.logo_src = logoSrc;
        api('/api/brand', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function () { toast('Brand applied — reloading'); setTimeout(function () { window.location.reload(); }, 800); })
          .catch(function () { toast('Brand save failed', true); });
      };
      var f = $('#sc-b-logo').files[0];
      if (f) {
        var fd = new FormData();
        fd.append('image', f);
        fetch('/api/upload', { method: 'POST', body: fd }).then(function (r) {
          if (!r.ok) throw new Error();
          return r.json();
        }).then(function (d) { done(d.src); }).catch(function () { toast('Logo upload failed', true); });
      } else done(null);
    });
  }

  // ---------- boot ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { buildBar(); loadOverrides(); setTimeout(applyAll, 2500); });
  } else {
    buildBar(); loadOverrides(); setTimeout(applyAll, 2500);
  }
  // Self-heal: the framework may drop non-vdom nodes on re-render; rebuild if gone.
  setInterval(function () {
    try {
      if (!document.querySelector('#sc-bar') && !document.querySelector('#sc-brand-panel.open') &&
          sessionStorage.getItem('sc_hide') !== '1') {
        buildBar();
      }
      loadOverrides();
    } catch (e) {}
  }, 5000);
})();
