/* ============================================================
   Giftology — theme behaviors (ported from
   design/giftology-reference.html, vanilla, no deps).
   Loads on every page; each block is guarded by element presence.
   - header solid-on-scroll
   - mobile menu open/close
   - reveal-on-scroll
   - gift finder (§7)  — shows a random product from the winning category
     (or WhatsApp custom); category URLs come from data-* (Salla settings)
   - testimonials slider (§5.8) — cards are rendered server-side
   ============================================================ */
(function () {
  'use strict';

  var ready = function (fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };

  ready(function () {

    /* ---- header solid-on-scroll ---- */
    var hdr = document.getElementById('gly-hdr');
    if (hdr) {
      var onScroll = function () { hdr.classList.toggle('solid', window.scrollY > 30); };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* ---- mobile menu ---- */
    var mmenu = document.getElementById('gly-mmenu');
    var burger = document.getElementById('gly-burger');
    var mclose = document.getElementById('gly-mclose');
    if (mmenu && burger) {
      var closeMenu = function () { mmenu.classList.remove('open'); };
      burger.addEventListener('click', function () { mmenu.classList.add('open'); });
      if (mclose) mclose.addEventListener('click', closeMenu);
      mmenu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeMenu);
      });
      // "Sections" accordion (reveals the category links)
      mmenu.querySelectorAll('.gly-msub-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var sub = btn.closest('.gly-msub');
          var open = sub.classList.toggle('open');
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      });
      // live category tree (rendered async by initCatMenu): tap a parent to
      // expand/collapse its subcategories; tap any real link to close the drawer
      var catbox = document.getElementById('gly-catmenu');
      if (catbox) {
        catbox.addEventListener('click', function (e) {
          var row = e.target.closest('.gly-catrow');
          if (row) {
            var open = row.parentNode.classList.toggle('open');
            row.setAttribute('aria-expanded', open ? 'true' : 'false');
            return;
          }
          if (e.target.closest('a')) closeMenu();
        });
      }
    }

    /* ---- reveal-on-scroll ---- */
    var revealEls = document.querySelectorAll('.gly-reveal');
    if (revealEls.length && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12 });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('in'); });
    }

    /* ---- gift finder (§7) ---- */
    initFinder();

    /* ---- testimonials slider (§5.8) ---- */
    initTestimonials();

    /* ---- product-list count ("X في هذا القسم") ---- */
    initProductCount();

    /* ---- live category tree in the mobile drawer ---- */
    initCatMenu();

    /* ---- subcategory chips on the category page ---- */
    initSubcatPills();
  });

  /* Fetch categories via Salla's category API. `salla.api.product.categories()` returns
     the whole tree (each node carries `sub_categories`); passing an id returns that one
     category (with its `sub_categories`). Returns a promise of the raw `data`. */
  function fetchCategories(id) {
    if (typeof salla === 'undefined' || !salla.onReady) return Promise.reject();
    return new Promise(function (resolve, reject) {
      salla.onReady(function () {
        if (!salla.api || !salla.api.product || !salla.api.product.categories) { reject(); return; }
        salla.api.product.categories(id).then(function (res) { resolve(res && res.data); }).catch(reject);
      });
    });
  }

  // node name / children are tolerant of both category (name/sub_categories) and menu (title/children) shapes
  function catName(m) { return m.name || m.title || ''; }
  function catKids(m) { return m.sub_categories || m.children || []; }

  /* ===================== CATEGORY MENU ===================== */
  /* Render the real category tree (categories + subcategories) as a gly accordion inside
     the drawer's "الأقسام" panel. The server-rendered tile links stay as the fallback. */
  function initCatMenu() {
    var box = document.getElementById('gly-catmenu');
    if (!box) return;
    fetchCategories().then(function (cats) {
      if (!cats || !cats.length) return; // keep the fallback tile links
      var allText = (salla.lang && salla.lang.get) ? salla.lang.get('blocks.home.display_all') : 'الكل';
      box.innerHTML = '<ul class="gly-catlist">' +
        cats.map(function (m) { return catNode(m, allText); }).join('') + '</ul>';
    }).catch(function () { /* leave the fallback tile links in place */ });
  }

  // one category node → <li>; recurses so any depth of subcategories collapses the same way
  function catNode(m, allText) {
    var title = esc(catName(m));
    var url = esc(m.url || '#');
    var kids = catKids(m);
    if (!kids.length) {
      return '<li class="gly-catitem"><a href="' + url + '">' + title + '</a></li>';
    }
    var inner = '<li><a href="' + url + '">' + esc(allText) + '</a></li>' +
      kids.map(function (c) { return catNode(c, allText); }).join('');
    return '<li class="gly-catitem gly-has-sub">' +
      '<button type="button" class="gly-catrow" aria-expanded="false"><span>' + title + '</span>' +
      '<svg class="gly-catchev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>' +
      '</button><ul class="gly-subcatlist">' + inner + '</ul></li>';
  }

  /* ===================== SUBCATEGORY PILLS ===================== */
  /* On a category page, show its direct subcategories as pills. Uses server-rendered
     chips when present; otherwise fetches them via the category id. */
  function initSubcatPills() {
    var nav = document.getElementById('gly-subcats');
    if (!nav || nav.children.length) return; // missing, or already server-rendered
    // Twig may not expose category.id — fall back to the /c{id} URL segment
    var id = nav.getAttribute('data-cat-id') ||
      (window.location.pathname.match(/\/c(\d+)(?:[\/?#]|$)/) || [])[1];
    if (!id) return;
    fetchCategories(id).then(function (data) {
      // categories(id) → a single category object; be tolerant if an array comes back
      var cat = Array.isArray(data) ? data[0] : data;
      var subs = cat && catKids(cat);
      if (!subs || !subs.length) return;
      nav.innerHTML = subs.map(function (s) {
        return '<a class="gly-subcat" href="' + esc(s.url) + '">' + esc(catName(s)) + '</a>';
      }).join('');
    }).catch(function () {});
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* keep the toolbar count in sync with the rendered product grid */
  function initProductCount() {
    var label = document.getElementById('gly-pcount');
    var grid = document.querySelector('.gly-pgrid');
    if (!label || !grid) return;
    var update = function () {
      var n = grid.querySelectorAll('.s-product-card-entry').length;
      if (n) label.textContent = n;
    };
    update();
    var t;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(update, 120); })
      .observe(grid, { childList: true, subtree: true });
  }

  /* ===================== GIFT FINDER ===================== */
  function initFinder() {
    var root = document.querySelector('.gly-quiz-box');
    if (!root) return;
    var card = root.querySelector('.gly-qcard');
    if (!card) return;

    var QUESTIONS = [
      { q: 'الهدية لمين؟', o: [['مولود جديد', 'newborn'], ['طفل / حفلة', 'kids'], ['رجل', 'men'], ['أي شخص', 'occasion']] },
      { q: 'وش المناسبة؟', o: [['ولادة', 'newborn'], ['حفلة أطفال', 'kids'], ['مناسبة عامة', 'occasion'], ['توزيعات', 'favors']] },
      { q: 'وش تبي بالضبط؟', o: [['هدية جاهزة', 'occasion'], ['هدية مخصّصة', 'custom'], ['ظرف أو بطاقة', 'cards'], ['توزيعات', 'favors']] }
    ];
    var RESULTS = {
      newborn:  { em: '🧸', t: 'هدايا مواليد',      d: 'كل ما يرحّب بالمولود الجديد بأناقة.' },
      kids:     { em: '🎈', t: 'هدايا حفلات أطفال', d: 'تجعل حفلة الأطفال لحظة لا تُنسى.' },
      men:      { em: '🤵', t: 'هدايا رجالية',      d: 'هدايا أنيقة تناسب ذوقه.' },
      occasion: { em: '🎁', t: 'هدايا لكل مناسبة',  d: 'هدية مثالية لأي مناسبة.' },
      favors:   { em: '🎀', t: 'توزيعات',           d: 'توزيعات مميزة لمناسباتك.' },
      cards:    { em: '💌', t: 'أظرف وبطاقات',      d: 'لمسة أخيرة تكمل هديتك.' },
      custom:   { em: '✨', t: 'هدايا مخصّصة',       d: 'نصنعها خصيصاً حسب فكرتك.' }
    };
    // order breaks scoring ties deterministically
    var ORDER = ['newborn', 'kids', 'men', 'occasion', 'favors', 'cards', 'custom'];

    var step = 0, score = {}, forcedCustom = false;

    function linkFor(key) {
      // data-* on the box hold the merchant category URLs + the WhatsApp link
      return root.dataset[key] || root.dataset.occasion || '#';
    }

    // Salla category-page URLs end with /c{id} — pull that id so we can query products
    function categoryIdFromUrl(url) {
      var m = String(url || '').match(/\/c(\d+)(?:[\/?#]|$)/);
      return m ? m[1] : null;
    }

    function restart() { step = 0; score = {}; forcedCustom = false; render(); }

    function resultShell(r, inner) {
      card.innerHTML =
        '<div class="gly-qresult"><div class="em">' + r.em + '</div>' +
        '<b>' + r.t + '</b>' + inner +
        '<button type="button" class="gly-restart">↺ ابدأ من جديد</button></div>';
      card.querySelector('.gly-restart').addEventListener('click', restart);
    }

    // custom = contact-first via WhatsApp, never a product
    function renderCustom() {
      var r = RESULTS.custom;
      resultShell(r, '<p>' + r.d + '</p>' +
        '<a class="gly-btn gly-btn-wa" style="width:100%;justify-content:center" href="' + linkFor('custom') + '" target="_blank" rel="noopener">تواصل عبر واتساب</a>');
    }

    // fallback: just link to the winning category page
    function renderCategoryLink(best) {
      var r = RESULTS[best];
      resultShell(r, '<p>' + r.d + '</p>' +
        '<a class="gly-btn gly-btn-primary" style="width:100%;justify-content:center" href="' + linkFor(best) + '">تسوّق هذا القسم</a>');
    }

    // winning category → pick a random real product from it (via Salla's products-list)
    function renderProduct(best) {
      var r = RESULTS[best];
      var catUrl = linkFor(best);
      var catId = categoryIdFromUrl(catUrl);
      if (!catId) { renderCategoryLink(best); return; } // no id → safe fallback

      resultShell(r, '<p class="gly-qloading">نبحث لك عن هدية مثالية…</p><div class="gly-qpwrap"></div>');
      var wrap = card.querySelector('.gly-qpwrap');

      // hidden host so Salla fetches + renders the category's products off-screen
      var host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:absolute;left:-9999px;top:0;width:320px;height:1px;overflow:hidden';
      var list = document.createElement('salla-products-list');
      list.setAttribute('source', 'categories');
      list.setAttribute('source-value', '[' + catId + ']'); // Salla wants a JSON array of ids
      // limit disables infinite-scroll → forces an immediate API fetch (otherwise the
      // off-screen list waits for the viewport to reach it and never loads here)
      list.setAttribute('limit', '24');
      list.setAttribute('compact-cards', ''); // render the compact card variant in the result
      host.appendChild(list);
      document.body.appendChild(host);

      // Salla renders each product as a <salla-product-card>/<custom-salla-product-card>
      // element carrying its data on the `.product` property (see getItemHTML).
      function cards() {
        return Array.prototype.slice.call(list.querySelectorAll('salla-product-card,custom-salla-product-card'));
      }

      var done = false;
      function cleanup() { if (host.parentNode) host.parentNode.removeChild(host); }
      function finish(entries) {
        if (done) return; done = true;
        var loading = card.querySelector('.gly-qloading'); if (loading) loading.remove();
        if (!entries || !entries.length) { cleanup(); renderCategoryLink(best); return; }
        var pick = entries[Math.floor(Math.random() * entries.length)];
        pick.compact = true; pick.setAttribute('compact', ''); // keep it the compact size
        wrap.appendChild(pick); // move the real card in — it's clickable to the product itself
        cleanup();
      }

      var obs = new MutationObserver(function () {
        if (cards().length) {
          obs.disconnect();
          setTimeout(function () { finish(cards()); }, 250); // let the full first page inject
        }
      });
      obs.observe(host, { childList: true, subtree: true });
      // safety net: if nothing renders in time, fall back to the category link
      setTimeout(function () { if (!done) { obs.disconnect(); finish(cards()); } }, 6000);
    }

    function render() {
      if (forcedCustom) { renderCustom(); return; }
      if (step >= QUESTIONS.length) {
        var best = ORDER[0], bestScore = -1;
        ORDER.forEach(function (k) { var s = score[k] || 0; if (s > bestScore) { bestScore = s; best = k; } });
        if (best === 'custom') { renderCustom(); return; }
        renderProduct(best);
        return;
      }
      var Q = QUESTIONS[step];
      var dots = QUESTIONS.map(function (_, i) { return '<i class="' + (i <= step ? 'on' : '') + '"></i>'; }).join('');
      var opts = Q.o.map(function (o) { return '<button type="button" class="gly-qopt" data-v="' + o[1] + '">' + o[0] + '</button>'; }).join('');
      card.innerHTML = '<div class="gly-qprog">' + dots + '</div><div class="gly-qq">' + Q.q + '</div><div class="gly-qopts">' + opts + '</div>';
    }

    card.addEventListener('click', function (e) {
      var o = e.target.closest('.gly-qopt');
      if (!o) return;
      var v = o.dataset.v;
      if (v === 'custom') { forcedCustom = true; render(); return; } // custom overrides everything
      score[v] = (score[v] || 0) + 1;
      step++;
      render();
    });

    render();
  }

  /* ===================== TESTIMONIALS ===================== */
  function initTestimonials() {
    var slider = document.querySelector('.gly-tslider');
    if (!slider) return;
    var track = slider.querySelector('.gly-ttrack');
    var dotsBox = slider.querySelector('.gly-tdots');
    if (!track) return;
    var slides = track.children.length;
    if (slides < 1) return;

    var i = 0, timer;
    if (dotsBox) {
      var dh = '';
      for (var d = 0; d < slides; d++) dh += '<b class="' + (d === 0 ? 'on' : '') + '" data-i="' + d + '"></b>';
      dotsBox.innerHTML = dh;
    }
    function go(n) {
      i = (n + slides) % slides;
      // RTL shifts positive (track moves right), LTR shifts negative
      var rtl = getComputedStyle(track).direction === 'rtl';
      track.style.transform = 'translateX(' + (rtl ? 1 : -1) * i * 100 + '%)';
      if (dotsBox) dotsBox.querySelectorAll('b').forEach(function (b, j) { b.classList.toggle('on', j === i); });
    }
    if (dotsBox) dotsBox.addEventListener('click', function (e) {
      var b = e.target.closest('b'); if (b) { go(+b.dataset.i); restart(); }
    });
    function restart() { clearInterval(timer); timer = setInterval(function () { go(i + 1); }, 5000); }
    slider.addEventListener('mouseenter', function () { clearInterval(timer); });
    slider.addEventListener('mouseleave', restart);
    if (slides > 1) restart();
  }

})();
