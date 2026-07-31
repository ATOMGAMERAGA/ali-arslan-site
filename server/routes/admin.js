'use strict';
/** Yonetici paneli ve yazi editoru. Butun yollar oturum + CSRF korumalidir. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const config = require('../config');
const u = require('../util');
const { posts, autosave } = require('../db');
const auth = require('../auth');
const flash = require('../flash');

const router = express.Router();
router.use(auth.requireLogin);

const sayfaBasi = (baslik) => ({
  baslik: baslik + ' — ' + config.siteName,
  aciklama: 'Yönetici paneli.',
  yol: '/panel',
  indeksle: false,
});

/* ── panel ───────────────────────────────────────────────────────────────── */

function panelVerisi(silinecek) {
  return {
    sayfa: sayfaBasi('Yönetici Paneli'),
    istatistik: posts.stats(),
    satirlar: posts.all().map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      tagCls: p.status === 'published' ? 'tag-accent' : 'tag-outline',
      statusLabel: p.status === 'published' ? 'Yayında' : 'Taslak',
      canView: p.status === 'published',
      meta: p.status === 'published'
        ? u.dateTR(p.published_at) + ' · ' + p.views + ' okunma'
        : 'Son düzenleme: ' + u.dateTR(p.updated_at || p.published_at),
    })),
    silinecek: silinecek || null,
  };
}

router.get('/', (req, res) => res.render('panel', panelVerisi(null)));

// JavaScript kapaliyken silme onayi: ayni panel, onay penceresi acik gelir.
router.get('/sil/:id', (req, res) => {
  const p = posts.byId(String(req.params.id || ''));
  if (!p) return res.redirect(303, '/panel');
  res.render('panel', panelVerisi({ id: p.id, title: p.title }));
});

router.post('/sil/:id', (req, res) => {
  const p = posts.byId(String(req.params.id || ''));
  if (!p) {
    flash.set(res, 'bulunamadi');
    return res.redirect(303, '/panel');
  }
  posts.remove(p.id);
  autosave.clear(p.id);
  temizleYetimGorseller();
  auth.authLog(`POST-DELETE id=${p.id} slug=${JSON.stringify(p.slug)} user=${JSON.stringify(req.user.username)}`);
  flash.set(res, 'silindi');
  res.redirect(303, '/panel');
});

/* ── editor ──────────────────────────────────────────────────────────────── */

function editorVerisi(mevcut) {
  const anahtar = mevcut ? mevcut.id : 'new';
  const taslak = autosave.get(anahtar);
  return {
    sayfa: sayfaBasi(mevcut ? 'Yazıyı Düzenle' : 'Yeni Yazı'),
    sayfaScript: '/js/editor.js',
    eylem: mevcut ? '/panel/kaydet/' + mevcut.id : '/panel/kaydet',
    anahtar,
    editorBaslik: mevcut ? 'Yazıyı Düzenle' : 'Yeni Yazı',
    yayinlaEtiketi: mevcut ? 'Güncelle ve Yayımla' : 'Yayımla',
    simdi: u.nowTR(),
    kaydedildi: taslak ? u.timeSecTR(taslak.savedatms) : '',
    edBaslik: taslak ? taslak.title : (mevcut ? mevcut.title : ''),
    edGovde: taslak ? taslak.body : (mevcut ? mevcut.body : ''),
    edKapak: taslak ? taslak.cover : (mevcut ? mevcut.cover : ''),
  };
}

router.get('/yeni', (req, res) => res.render('editor', editorVerisi(null)));

router.get('/duzenle/:id', (req, res) => {
  const p = posts.byId(String(req.params.id || ''));
  if (!p) return res.redirect(303, '/panel');
  res.render('editor', editorVerisi(p));
});

const temizKapak = (v) => (/^\/uploads\/[A-Za-z0-9._-]+$/.test(String(v || '')) || /^\/assets\/[A-Za-z0-9._-]+$/.test(String(v || '')) ? String(v) : '');

router.post(['/kaydet', '/kaydet/:id'], (req, res) => {
  const durum = req.body.durum === 'published' ? 'published' : 'draft';
  const baslik = String(req.body.baslik || '').trim().slice(0, 200) || 'Adsız Yazı';
  const govde = String(req.body.govde || '').slice(0, 400000);
  const kapak = temizKapak(req.body.kapak);
  const id = req.params.id ? String(req.params.id) : null;
  const mevcut = id ? posts.byId(id) : null;

  if (id && !mevcut) {
    flash.set(res, 'bulunamadi');
    return res.redirect(303, '/panel');
  }

  if (durum === 'published' && !govde.trim()) {
    flash.set(res, 'bosYazi');
    return res.redirect(303, mevcut ? '/panel/duzenle/' + mevcut.id : '/panel/yeni');
  }

  const simdi = Date.now();

  if (mevcut) {
    // Yayimlanmis yazinin adresi degismez (eski baglantilar kirilmasin diye);
    // henuz taslak olan yazinin adresi baslikla birlikte guncellenir.
    const slug = mevcut.status === 'published' ? mevcut.slug : benzersizSlug(baslik, mevcut.id);
    posts.update({
      id: mevcut.id, slug, title: baslik, body: govde, cover: kapak, status: durum,
      published_at: (durum === 'published' && mevcut.status !== 'published') ? simdi : mevcut.published_at,
      updated_at: simdi,
    });
    autosave.clear(mevcut.id);
    temizleYetimGorseller();
    flash.set(res, durum === 'published' ? 'guncellendi' : 'taslak');
  } else {
    const yeni = u.yeniId();
    posts.insert({
      id: yeni, slug: benzersizSlug(baslik, yeni), title: baslik, body: govde, cover: kapak,
      status: durum, views: 0, published_at: simdi, updated_at: simdi,
    });
    autosave.clear('new');
    flash.set(res, durum === 'published' ? 'yayinlandi' : 'taslak');
  }

  res.redirect(303, '/panel');
});

function benzersizSlug(baslik, id) {
  let slug = u.slugify(baslik);
  if (posts.slugTaken(slug, id)) slug = slug + '-' + id;
  return slug;
}

/* ── otomatik kayit ──────────────────────────────────────────────────────── */

router.post('/otokayit', (req, res) => {
  const anahtar = String(req.body.anahtar || 'new').slice(0, 40);
  if (anahtar !== 'new' && !posts.byId(anahtar)) {
    return res.status(404).json({ ok: false, hata: 'Yazı bulunamadı' });
  }
  autosave.put(
    anahtar,
    String(req.body.baslik || '').slice(0, 200),
    String(req.body.govde || '').slice(0, 400000),
    temizKapak(req.body.kapak)
  );
  res.json({ ok: true, saat: u.timeSecTR(Date.now()) });
});

/* ── gorsel yukleme ──────────────────────────────────────────────────────── */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 6 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|avif|tiff)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Yalnızca görsel dosyaları yükleyebilirsiniz.'));
  },
}).single('gorsel');

router.post('/gorsel', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      const mesaj = err.code === 'LIMIT_FILE_SIZE'
        ? `Görsel çok büyük (en fazla ${config.maxUploadMb} MB).`
        : (err.message || 'Görsel yüklenemedi.');
      return res.status(400).json({ ok: false, hata: mesaj });
    }
    // CSRF kontrolu multer'dan SONRA yapilir: alanlar ancak simdi okunabilir.
    if (!auth.safeEqual(req.body?._csrf || req.get('x-csrf-token'), req.csrf)) {
      auth.authLog(`CSRF-REJECT POST /panel/gorsel ip=${req.ip}`);
      return res.status(403).json({ ok: false, hata: 'Oturum doğrulaması başarısız. Sayfayı yenileyin.' });
    }
    if (!req.file) return res.status(400).json({ ok: false, hata: 'Dosya seçilmedi.' });

    const enFazla = req.body.tur === 'kapak' ? 1600 : 1400;
    const ad = crypto.randomBytes(12).toString('hex') + '.jpg';
    const hedef = path.join(config.uploadDir, ad);

    try {
      // Gorsel yeniden kodlanir: icine gizlenmis kod/HTML ve EXIF verisi
      // (konum bilgisi dahil) tamamen atilir.
      await sharp(req.file.buffer, { limitInputPixels: 40e6, failOn: 'error' })
        .rotate()
        .resize({ width: enFazla, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true, progressive: true })
        .toFile(hedef);
    } catch (e) {
      auth.authLog(`UPLOAD-FAIL ip=${req.ip} err=${JSON.stringify(String(e.message).slice(0, 120))}`);
      return res.status(400).json({ ok: false, hata: 'Görsel okunamadı ya da bozuk.' });
    }

    res.json({ ok: true, url: '/uploads/' + ad });
  });
});

/**
 * Hicbir yazida kullanilmayan yuklenmis gorselleri siler. Yazi silindiginde ve
 * duzenleme kaydedildiginde calisir; 10 dakikadan yeni dosyalara dokunmaz
 * (editorde yuklenip henuz kaydedilmemis olabilirler).
 */
function temizleYetimGorseller() {
  try {
    const kullanilan = posts.usedImagePaths();
    // Henuz kaydedilmemis taslaklardaki (otomatik kayit) gorseller de korunur.
    const re = /\/uploads\/[A-Za-z0-9._-]+/g;
    for (const t of autosave.all()) {
      if (t.cover) kullanilan.add(t.cover);
      let m;
      while ((m = re.exec(t.body || ''))) kullanilan.add(m[0]);
    }
    const esik = Date.now() - 10 * 60e3;
    for (const ad of fs.readdirSync(config.uploadDir)) {
      const yol = '/uploads/' + ad;
      if (kullanilan.has(yol)) continue;
      const tam = path.join(config.uploadDir, ad);
      const st = fs.statSync(tam);
      if (st.mtimeMs > esik) continue;
      fs.unlinkSync(tam);
    }
  } catch { /* temizlik basarisiz olursa site calismaya devam eder */ }
}

module.exports = router;
