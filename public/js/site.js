/**
 * Sitenin genel tarayici davranislari: tema dugmesi, paylas, bildirim (toast)
 * ve silme onayi penceresi. Hepsi "ilerlemeli iyilestirme": JavaScript kapali
 * olsa da sayfalar calisir (silme onayi ayri bir sayfa olarak acilir).
 */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ── bildirim ──────────────────────────────────────────────────────────── */
  var toastTimer = null;
  function toast(msg) {
    var el = document.querySelector('.aa-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'aa-toast';
      el.setAttribute('role', 'status');
      document.querySelector('.aa-app').appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 2800);
  }
  window.aaToast = toast;

  // Sunucudan gelen bildirim varsa 2.8 saniye sonra kaybolsun.
  var mevcut = document.querySelector('.aa-toast');
  if (mevcut) setTimeout(function () { mevcut.remove(); }, 2800);

  /* ── tema dugmesi ──────────────────────────────────────────────────────── */
  var siraCyc = { sistem: 'acik', acik: 'koyu', koyu: 'sistem' };
  function uygula(mode) {
    root.setAttribute('data-aa-mode', mode);
    var koyu = mode === 'koyu' || (mode === 'sistem'
      && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-aa-theme', koyu ? 'dark' : 'light');
  }
  var temaBtn = document.getElementById('aa-theme-btn');
  if (temaBtn) {
    temaBtn.addEventListener('click', function () {
      var yeni = siraCyc[root.getAttribute('data-aa-mode')] || 'acik';
      try { localStorage.setItem('aa_theme', yeni); } catch (e) { /* yok sayilir */ }
      uygula(yeni);
    });
  }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var dinle = function () {
      if (root.getAttribute('data-aa-mode') === 'sistem') uygula('sistem');
    };
    if (mq.addEventListener) mq.addEventListener('change', dinle);
    else if (mq.addListener) mq.addListener(dinle);
  }

  /* ── paylas ────────────────────────────────────────────────────────────── */
  var paylasBtn = document.getElementById('aa-share');
  if (paylasBtn) {
    paylasBtn.addEventListener('click', function () {
      var url = location.href;
      var baslik = paylasBtn.getAttribute('data-baslik') || document.title;
      if (navigator.share) {
        navigator.share({ title: baslik, url: url }).catch(function (e) {
          if (e && e.name === 'AbortError') return;
          panoyaKopyala(url);
        });
        return;
      }
      panoyaKopyala(url);
    });
  }
  function panoyaKopyala(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(function () { toast('Bağlantı panoya kopyalandı'); })
        .catch(function () { toast(url); });
    } else {
      toast(url);
    }
  }

  /* ── silme onayi ───────────────────────────────────────────────────────── */
  var kutu = document.getElementById('aa-sil-kutu');
  if (kutu) {
    var ad = document.getElementById('aa-sil-ad');
    var form = document.getElementById('aa-sil-form');
    var vazgec = document.getElementById('aa-sil-vazgec');

    function ac(baslik, id) {
      ad.textContent = baslik;
      form.setAttribute('action', '/panel/sil/' + encodeURIComponent(id));
      kutu.hidden = false;
      var ilk = kutu.querySelector('button, a');
      if (ilk) ilk.focus();
    }
    function kapat() { kutu.hidden = true; }

    Array.prototype.forEach.call(document.querySelectorAll('.aa-sil'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        ac(a.getAttribute('data-baslik') || '', a.getAttribute('data-id'));
      });
    });
    if (vazgec) {
      vazgec.addEventListener('click', function (e) {
        // Adres cubugunda /panel/sil/... varsa gercekten /panel'e donsun.
        if (location.pathname.indexOf('/panel/sil/') === 0) return;
        e.preventDefault();
        kapat();
      });
    }
    kutu.addEventListener('click', function (e) {
      if (e.target === kutu && location.pathname.indexOf('/panel/sil/') !== 0) kapat();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !kutu.hidden && location.pathname.indexOf('/panel/sil/') !== 0) kapat();
    });
  }
})();
