/* ============================================================
   Giftology — theme behaviors (ported from
   design/giftology-reference.html, vanilla, no deps).
   Loads on every page; each block is guarded by element presence.
   - header solid-on-scroll
   - mobile menu open/close
   - reveal-on-scroll
   - gift finder (§7)  — category links come from data-* (Salla settings)
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
      burger.addEventListener('click', function () { mmenu.classList.add('open'); });
      if (mclose) mclose.addEventListener('click', function () { mmenu.classList.remove('open'); });
      mmenu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { mmenu.classList.remove('open'); });
      });
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
  });

  /* ===================== GIFT FINDER ===================== */
  function initFinder() {
    var root = document.querySelector('.gly-quiz-box');
    if (!root) return;
    var card = root.querySelector('.gly-qcard');
    if (!card) return;

    var QUESTIONS = [
      { q: 'الهدية لمين؟', o: [['مولود جديد', 'newborn'], ['طفل / حفلة', 'kids'], ['رجل', 'men'], ['أي شخص', 'occasion']] },
      { q: 'وش المناسبة؟', o: [['ولادة', 'newborn'], ['حفلة أطفال', 'kids'], ['مناسبة عامة', 'occasion'], ['توزيعات', 'favors']] },
      { q: 'وش تبي بالضبط؟', o: [['هدية جاهزة', 'occasion'], ['هدية مخصّصة', 'custom'], ['ظرف أو بطاقة', 'cards'], ['توزيعات بالجملة', 'favors']] }
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

    var step = 0, score = {};

    function linkFor(key) {
      // data-* on the box hold the merchant category URLs + the WhatsApp link
      return root.dataset[key] || root.dataset.occasion || '#';
    }

    function render() {
      if (step >= QUESTIONS.length) {
        var best = ORDER[0], bestScore = -1;
        ORDER.forEach(function (k) { var s = score[k] || 0; if (s > bestScore) { bestScore = s; best = k; } });
        var r = RESULTS[best];
        var isCustom = best === 'custom';
        var url = isCustom ? linkFor('custom') : linkFor(best);
        var ext = isCustom; // custom opens WhatsApp in a new tab
        card.innerHTML =
          '<div class="gly-qresult"><div class="em">' + r.em + '</div>' +
          '<b>' + r.t + '</b><p>' + r.d + '</p>' +
          '<a class="gly-btn ' + (ext ? 'gly-btn-wa' : 'gly-btn-primary') + '" style="width:100%;justify-content:center" href="' + url + '"' +
          (ext ? ' target="_blank" rel="noopener"' : '') + '>' + (ext ? 'تواصل عبر واتساب' : 'تسوّق هذا القسم') + '</a>' +
          '<button type="button" class="gly-restart">↺ ابدأ من جديد</button></div>';
        card.querySelector('.gly-restart').addEventListener('click', function () { step = 0; score = {}; render(); });
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
