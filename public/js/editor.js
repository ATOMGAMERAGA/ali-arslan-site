/**
 * Yazi editoru: bicimlendirme dugmeleri, gorsel yukleme, onizleme ve
 * otomatik kayit. Kod bilmeyen birinin rahatca yazabilmesi icin butun
 * isaretleme secili metne dugmelerle uygulanir.
 *
 * JavaScript kapaliysa: baslik + metin alani + "Yayımla" yine calisir.
 */
(function () {
  'use strict';

  var form = document.getElementById('aa-editor');
  if (!form) return;

  var ta = document.getElementById('aa-govde');
  var baslikEl = document.getElementById('aa-baslik');
  var kapakEl = document.getElementById('aa-kapak');
  var kapakEkle = document.getElementById('aa-kapak-ekle');
  var kapakKutu = document.getElementById('aa-kapak-kutu');
  var kapakOn = document.getElementById('aa-kapak-onizleme');
  var kapakDegistir = document.getElementById('aa-kapak-degistir');
  var kapakKaldir = document.getElementById('aa-kapak-kaldir');
  var dosyaKapak = document.getElementById('aa-dosya-kapak');
  var dosyaGorsel = document.getElementById('aa-dosya-gorsel');
  var onizleme = document.getElementById('aa-onizleme');
  var sekmeYaz = document.getElementById('aa-sekme-yaz');
  var sekmeOnizle = document.getElementById('aa-sekme-onizle');
  var linkBar = document.getElementById('aa-link-bar');
  var linkMetin = document.getElementById('aa-link-metin');
  var linkAdres = document.getElementById('aa-link-adres');
  var kaydedildi = document.getElementById('aa-kaydedildi');
  var kaydedildiSaat = document.getElementById('aa-kaydedildi-saat');

  var csrf = form.querySelector('input[name="_csrf"]').value;
  var otokayitUrl = form.getAttribute('data-otokayit');
  var anahtar = form.getAttribute('data-anahtar');
  var toast = window.aaToast || function (m) { console.log(m); };

  /* ── metin islemleri (prototipteki davranisin birebir karsiligi) ───────── */

  function metinEkle(txt) {
    var v = ta.value;
    var s = ta.selectionStart, e = ta.selectionEnd;
    if (typeof s !== 'number') { s = v.length; e = v.length; }
    ta.value = v.slice(0, s) + txt + v.slice(e);
    var p = s + txt.length;
    requestAnimationFrame(function () { ta.focus(); ta.setSelectionRange(p, p); });
    degisti();
  }

  function sar(basi, sonu, yerTutucu) {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var sec = v.slice(s, e) || yerTutucu;
    ta.value = v.slice(0, s) + basi + sec + sonu + v.slice(e);
    var p = s + basi.length;
    requestAnimationFrame(function () { ta.focus(); ta.setSelectionRange(p, p + sec.length); });
    degisti();
  }

  function satirOnEki(pf) {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var ls = v.lastIndexOf('\n', s - 1) + 1;
    var le = v.indexOf('\n', e); if (le < 0) le = v.length;
    var out = v.slice(ls, le).split('\n').map(function (ln, i) {
      return pf === 'ol' ? (i + 1) + '. ' + ln : pf + ln;
    }).join('\n');
    ta.value = v.slice(0, ls) + out + v.slice(le);
    requestAnimationFrame(function () { ta.focus(); ta.setSelectionRange(ls, ls + out.length); });
    degisti();
  }

  var eylemler = {
    kalin: function () { sar('**', '**', 'kalın metin'); },
    egik: function () { sar('*', '*', 'eğik metin'); },
    h2: function () { satirOnEki('## '); },
    h3: function () { satirOnEki('### '); },
    alinti: function () { satirOnEki('> '); },
    liste: function () { satirOnEki('- '); },
    numarali: function () { satirOnEki('ol'); },
    cizgi: function () { metinEkle('\n\n---\n\n'); },
    gorsel: function () { dosyaGorsel.click(); },
    baglanti: function () {
      linkBar.hidden = false;
      linkMetin.focus();
    }
  };

  form.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-ed]') : null;
    if (!btn) return;
    var f = eylemler[btn.getAttribute('data-ed')];
    if (f) { e.preventDefault(); f(); }
  });

  /* ── baglanti kutusu ───────────────────────────────────────────────────── */

  document.getElementById('aa-link-ekle').addEventListener('click', function () {
    var t = (linkMetin.value || '').trim() || 'bağlantı';
    var u = (linkAdres.value || '').trim();
    if (!u) { toast('Önce bir adres yazın'); return; }
    if (!/^https?:/i.test(u) && u.charAt(0) !== '/') u = 'https://' + u;
    metinEkle('[' + t + '](' + u + ')');
    linkMetin.value = ''; linkAdres.value = '';
    linkBar.hidden = true;
  });
  document.getElementById('aa-link-vazgec').addEventListener('click', function () {
    linkBar.hidden = true;
  });

  /* ── gorsel yukleme ────────────────────────────────────────────────────── */

  function yukle(dosya, tur, tamam) {
    if (!dosya) return;
    var fd = new FormData();
    fd.append('gorsel', dosya);
    fd.append('tur', tur);
    fd.append('_csrf', csrf);
    toast('Görsel yükleniyor…');
    fetch('/panel/gorsel', {
      method: 'POST', body: fd, credentials: 'same-origin',
      headers: { 'x-csrf-token': csrf, 'accept': 'application/json' }
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.ok) throw new Error(res.j && res.j.hata ? res.j.hata : 'Yükleme başarısız');
        tamam(res.j.url);
      })
      .catch(function (err) { toast(err.message || 'Görsel yüklenemedi'); });
  }

  if (kapakEkle) kapakEkle.addEventListener('click', function () { dosyaKapak.click(); });
  if (kapakDegistir) kapakDegistir.addEventListener('click', function () { dosyaKapak.click(); });
  if (kapakKaldir) kapakKaldir.addEventListener('click', function () {
    kapakEl.value = '';
    kapakKutu.hidden = true;
    kapakEkle.hidden = false;
    degisti();
  });

  dosyaKapak.addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    yukle(f, 'kapak', function (url) {
      kapakEl.value = url;
      kapakOn.src = url;
      kapakKutu.hidden = false;
      kapakEkle.hidden = true;
      toast('Kapak eklendi');
      degisti();
    });
  });

  dosyaGorsel.addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    yukle(f, 'icerik', function (url) {
      metinEkle('\n![Görsel](' + url + ')\n');
      toast('Görsel eklendi');
    });
  });

  /* ── yaz / onizle ──────────────────────────────────────────────────────── */

  function sekme(onizleAcik) {
    sekmeYaz.classList.toggle('is-active', !onizleAcik);
    sekmeOnizle.classList.toggle('is-active', onizleAcik);
    ta.hidden = onizleAcik;
    onizleme.hidden = !onizleAcik;
    if (onizleAcik) {
      var kaynak = ta.value.trim() ? ta.value : '*Henüz önizlenecek bir şey yok — önce birkaç satır yazın.*';
      onizleme.innerHTML = window.aaMarkdown.render(kaynak);
    }
  }
  sekmeYaz.addEventListener('click', function () { sekme(false); });
  sekmeOnizle.addEventListener('click', function () { sekme(true); });

  /* ── otomatik kayit ────────────────────────────────────────────────────── */

  var zaman = null;
  var gonderiliyor = false;

  function degisti() {
    clearTimeout(zaman);
    zaman = setTimeout(kaydet, 600);
  }

  function kaydet() {
    if (gonderiliyor) return;
    gonderiliyor = true;
    fetch(otokayitUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf, 'accept': 'application/json' },
      body: JSON.stringify({
        _csrf: csrf, anahtar: anahtar,
        baslik: baslikEl.value, govde: ta.value, kapak: kapakEl.value
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok && j.saat) {
          kaydedildiSaat.textContent = j.saat;
          kaydedildi.hidden = false;
        }
      })
      .catch(function () { /* ag koptuysa sessizce gec; metin alanda duruyor */ })
      .then(function () { gonderiliyor = false; });
  }

  ta.addEventListener('input', degisti);
  baslikEl.addEventListener('input', degisti);

  // Form gonderildiginde bekleyen otomatik kaydi iptal et (yazi zaten kaydedilecek).
  form.addEventListener('submit', function () { clearTimeout(zaman); });

  // Ctrl/Cmd + S: taslak olarak kaydet
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      clearTimeout(zaman);
      kaydet();
      toast('Taslak kaydedildi (otomatik)');
    }
  });
})();
