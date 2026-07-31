/**
 * Ali Arslan blogunun metin bicimlendiricisi (Markdown'un guvenli bir alt kumesi).
 *
 * Ayni dosya hem sunucuda (require) hem tarayicida (window.aaMarkdown) calisir;
 * boylece editordeki onizleme ile yayimlanan yazi birebir ayni sonucu verir.
 *
 * Guvenlik: girdi ONCE kacislanir (&, <, >, ", '), yani yaziya HTML yazilsa bile
 * metin olarak gorunur; ardindan yalnizca bizim urettigimiz etiketler eklenir.
 * Gorsel/baglanti adresleri beyaz listeden gecer (javascript: vb. engellenir).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.aaMarkdown = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Gorsel adresleri: yalnizca kendi sunucumuz veya acik https adresleri.
  function imgSrc(u) {
    u = String(u || '').trim();
    if (/^\/(uploads|assets)\/[A-Za-z0-9._-]+$/.test(u)) return u;
    if (/^https:\/\/[^\s"'<>]+$/i.test(u)) return u;
    return '';
  }

  // Baglanti adresleri: http(s), site ici yollar ve e-posta.
  function linkHref(u) {
    u = String(u || '').trim();
    if (/^https?:\/\/[^\s"'<>]+$/i.test(u)) return u;
    if (/^\/[^\s"'<>]*$/.test(u)) return u;
    if (/^mailto:[^\s"'<>]+$/i.test(u)) return u;
    return '';
  }

  function inline(t) {
    return t
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (m, alt, u) {
        var s = imgSrc(u);
        return s ? '<img src="' + s + '" alt="' + alt + '" class="plate" loading="lazy">' : '';
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, text, u) {
        var s = linkHref(u);
        if (!s) return text;
        var external = /^https?:/i.test(s);
        return '<a href="' + s + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + text + '</a>';
      });
  }

  function render(src) {
    var lines = String(src == null ? '' : src).split('\n');
    var out = [], para = [], list = null, quote = [];

    var flushP = function () {
      if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; }
    };
    var flushL = function () {
      if (list) {
        out.push('<' + list.t + '>' + list.items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</' + list.t + '>');
        list = null;
      }
    };
    var flushQ = function () {
      if (quote.length) { out.push('<blockquote>' + quote.map(inline).join('<br>') + '</blockquote>'); quote = []; }
    };

    for (var i = 0; i < lines.length; i++) {
      var l = esc(lines[i]), t = l.trim(), m;
      if (!t) { flushP(); flushL(); flushQ(); continue; }

      if ((m = t.match(/^(#{1,3})\s+(.*)/))) {
        flushP(); flushL(); flushQ();
        var h = m[1].length <= 2 ? 2 : 3;
        out.push('<h' + h + '>' + inline(m[2]) + '</h' + h + '>');
        continue;
      }
      if (/^---+$/.test(t)) { flushP(); flushL(); flushQ(); out.push('<hr class="hr">'); continue; }
      if ((m = t.match(/^&gt;\s?(.*)/))) { flushP(); flushL(); quote.push(m[1]); continue; }
      if ((m = t.match(/^[-*•]\s+(.*)/))) {
        flushP(); flushQ();
        if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; }
        list.items.push(m[1]); continue;
      }
      if ((m = t.match(/^\d+[.)]\s+(.*)/))) {
        flushP(); flushQ();
        if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', items: [] }; }
        list.items.push(m[1]); continue;
      }
      flushL(); flushQ(); para.push(t);
    }
    flushP(); flushL(); flushQ();
    return out.join('');
  }

  // Yazi listesindeki ozet: isaretleme temizlenir, 170 karakterde kesilir.
  function excerpt(src) {
    var t = String(src == null ? '' : src)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#>*`_-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return t.length > 170 ? t.slice(0, 170).replace(/\s\S*$/, '') + '…' : t;
  }

  // Duz metin (RSS ozeti, meta description, OpenGraph icin).
  function plain(src) {
    return String(src == null ? '' : src)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#>*`_]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return { render: render, excerpt: excerpt, plain: plain, esc: esc };
});
