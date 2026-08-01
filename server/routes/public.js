'use strict';
/** Herkese acik sayfalar: ana sayfa, yazi, hakkimda, giris, RSS, sitemap. */
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const md = require('../../public/js/md.js');
const u = require('../util');
const { posts, users, views } = require('../db');
const auth = require('../auth');
const flash = require('../flash');

const router = express.Router();

/* ── ana sayfa ───────────────────────────────────────────────────────────── */

router.get('/', (req, res) => {
  const yayinda = posts.published();
  res.render('anasayfa', {
    sayfa: {
      baslik: config.siteTitle,
      aciklama: config.siteDesc,
      yol: '/',
      ldJson: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Blog',
        name: config.siteTitle, url: config.siteUrl + '/',
        description: config.siteDesc,
        author: { '@type': 'Person', name: config.siteName },
      }),
    },
    yazilar: yayinda.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: md.excerpt(p.body),
      meta: u.dateTR(p.published_at)
        + (config.okumaSuresiGoster ? ' · ' + u.readMin(p.body) + ' dk okuma' : '')
        + ' · ' + p.views + ' okunma',
    })),
  });
});

/* ── tek yazi ────────────────────────────────────────────────────────────── */

router.get('/yazi/:slug', (req, res) => {
  const p = posts.publishedBySlug(String(req.params.slug || ''));
  if (!p) {
    return res.status(404).render('yazi-yok', {
      sayfa: { baslik: 'Yazı bulunamadı — ' + config.siteName, aciklama: 'Aradığınız yazı bulunamadı.', yol: req.path, indeksle: false },
    });
  }

  views.bump(p.id, u.viewerKey(req.ip, req.get('user-agent'), config.sessionSecret));
  const guncel = posts.byId(p.id);
  const ozet = md.plain(p.body).slice(0, 200);

  res.render('yazi', {
    sayfa: {
      baslik: p.title + ' — ' + config.siteName,
      aciklama: ozet,
      yol: '/yazi/' + p.slug,
      ogTur: 'article',
      gorsel: p.cover || '/assets/hero.jpg',
      ldJson: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: p.title, description: ozet,
        datePublished: u.iso(p.published_at), dateModified: u.iso(p.updated_at),
        image: config.siteUrl + (p.cover || '/assets/hero.jpg'),
        author: { '@type': 'Person', name: config.siteName },
        mainEntityOfPage: config.siteUrl + '/yazi/' + p.slug,
      }),
    },
    yazi: guncel,
    meta: u.dateTR(p.published_at) + (config.okumaSuresiGoster ? ' · ' + u.readMin(p.body) + ' dk okuma' : ''),
    govde: md.render(p.body),
  });
});

/* ── hakkimda ────────────────────────────────────────────────────────────── */

router.get('/hakkimda', (req, res) => {
  res.render('hakkimda', {
    sayfa: {
      baslik: 'Hakkımda — ' + config.siteName,
      aciklama: 'Ali Arslan kimdir: tarih okumaları, araştırmalar ve geçmişin bugüne bıraktığı izler.',
      yol: '/hakkimda',
      gorsel: '/assets/portrait.jpg',
    },
  });
});

/* ── giris ───────────────────────────────────────────────────────────────── */

const girisLimit = rateLimit({
  windowMs: 15 * 60e3,
  limit: 20,                       // 15 dakikada en fazla 20 deneme (IP basina)
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Çok fazla deneme yapıldı.',
  handler: (req, res) => {
    auth.authLog(`RATE-LIMIT /giris ip=${req.ip}`);
    res.status(429).render('hata', {
      kod: 429,
      baslik: 'Çok fazla deneme',
      mesaj: 'Kısa sürede çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.',
      sayfa: { baslik: 'Çok fazla deneme — ' + config.siteName, aciklama: '', yol: '/giris', indeksle: false },
    });
  },
});

const guvenliDevam = (v) => (/^\/panel(\/[A-Za-z0-9\-/]*)?$/.test(String(v || '')) ? String(v) : '/panel');

router.get('/giris', (req, res) => {
  if (req.user) return res.redirect(302, guvenliDevam(req.query.devam));
  res.render('giris', {
    sayfa: { baslik: 'Yönetici Girişi — ' + config.siteName, aciklama: 'Yönetici girişi.', yol: '/giris', indeksle: false },
    kullanici: '',
    devam: guvenliDevam(req.query.devam),
    hata: '',
  });
});

router.post('/giris', girisLimit, (req, res) => {
  const devam = guvenliDevam(req.body.devam);
  const kullanici = String(req.body.kullanici || '').trim().slice(0, 64);
  const sifre = String(req.body.sifre || '').slice(0, 200);

  const sayfaVerisi = (hata) => ({
    sayfa: { baslik: 'Yönetici Girişi — ' + config.siteName, aciklama: 'Yönetici girişi.', yol: '/giris', indeksle: false },
    kullanici, devam, hata,
  });

  const kilit = auth.loginLock(req.ip);
  if (kilit) {
    auth.authLog(`LOCKED ip=${req.ip} tries=${kilit.tries}`);
    return res.status(429).render('giris', sayfaVerisi(
      `Çok fazla başarısız deneme. ${kilit.minutes} dakika sonra tekrar deneyin.`));
  }

  const kayit = users.get(kullanici.toLowerCase());
  const dogru = kayit && auth.verifyPassword(sifre, kayit.pass_hash);

  if (!dogru) {
    auth.noteFailure(req.ip, kullanici);
    return res.status(401).render('giris', sayfaVerisi('Kullanıcı adı veya şifre hatalı.'));
  }

  auth.noteSuccess(req.ip, kayit.username);
  auth.startSession(res, kayit.username, req.ip, req.get('user-agent'));
  flash.set(res, 'hosgeldiniz');
  res.redirect(303, devam);
});

router.post('/cikis', (req, res) => {
  if (req.user) auth.authLog(`LOGOUT user=${JSON.stringify(req.user.username)} ip=${req.ip}`);
  auth.endSession(req, res);
  flash.set(res, 'cikildi');
  res.redirect(303, '/');
});

/* ── besleme, site haritasi, robots ──────────────────────────────────────── */

router.get('/rss.xml', (req, res) => {
  const yayinda = posts.published().slice(0, 30);
  const x = u.xmlEscape;
  const govde = yayinda.map((p) => `    <item>
      <title>${x(p.title)}</title>
      <link>${x(config.siteUrl + '/yazi/' + p.slug)}</link>
      <guid isPermaLink="true">${x(config.siteUrl + '/yazi/' + p.slug)}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <description>${x(md.excerpt(p.body))}</description>
    </item>`).join('\n');

  res.type('application/rss+xml; charset=utf-8').send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${x(config.siteTitle)}</title>
    <link>${x(config.siteUrl)}/</link>
    <atom:link href="${x(config.siteUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
    <description>${x(config.siteDesc)}</description>
    <language>tr</language>
    <lastBuildDate>${new Date(yayinda[0]?.published_at || Date.now()).toUTCString()}</lastBuildDate>
${govde}
  </channel>
</rss>
`);
});

router.get('/sitemap.xml', (req, res) => {
  const x = u.xmlEscape;
  const sabit = [['/', '1.0'], ['/hakkimda', '0.6']];
  const satirlar = sabit.map(([yol, oncelik]) => `  <url><loc>${x(config.siteUrl + yol)}</loc><priority>${oncelik}</priority></url>`)
    .concat(posts.published().map((p) => `  <url><loc>${x(config.siteUrl + '/yazi/' + p.slug)}</loc><lastmod>${u.iso(p.updated_at).slice(0, 10)}</lastmod><priority>0.8</priority></url>`));
  res.type('application/xml; charset=utf-8')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${satirlar.join('\n')}\n</urlset>\n`);
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain; charset=utf-8').send(
    `User-agent: *\nDisallow: /panel\nDisallow: /giris\nAllow: /\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
});

router.get('/site.webmanifest', (req, res) => {
  res.type('application/manifest+json').send(JSON.stringify({
    name: config.siteTitle,
    short_name: config.siteName,
    description: config.siteDesc,
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f2f2',
    theme_color: '#b68235',
    icons: [
      { src: '/favicon.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }, null, 2));
});

module.exports = router;
