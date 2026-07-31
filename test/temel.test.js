'use strict';
/**
 * Kritik davranislarin testi:  node --test test/
 *   · Markdown ciktisinin HTML enjeksiyonuna kapali olmasi
 *   · Adres (slug) uretimi ve Turkce karakterler
 *   · Sifre ozeti ve dogrulama
 */
const test = require('node:test');
const assert = require('node:assert');

const md = require('../public/js/md.js');
const { slugify, dateTR, readMin } = require('../server/util');

/* ── Markdown güvenliği ────────────────────────────────────────────────── */

test('ham HTML metne dönüşür, çalıştırılmaz', () => {
  const out = md.render('<script>alert(1)</script>');
  assert.ok(!out.includes('<script'), 'script etiketi geçmemeli');
  assert.ok(out.includes('&lt;script&gt;'));
});

test('img alt metnindeki tırnak kaçışlanır', () => {
  const out = md.render('![kotu"onerror=alert(1) x](/assets/hero.jpg)');
  assert.ok(!/alt="[^"]*"[a-z]/i.test(out), 'alt niteliğinden çıkılamamalı');
  assert.ok(out.includes('&quot;'));
});

test('javascript: bağlantıları reddedilir', () => {
  for (const kotu of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>']) {
    const out = md.render(`[tikla](${kotu})`);
    assert.ok(!out.includes('href='), `reddedilmeli: ${kotu}`);
  }
});

test('yalnızca kendi sunucumuzdaki ve https görseller kabul edilir', () => {
  assert.ok(md.render('![a](/uploads/abc123.jpg)').includes('src="/uploads/abc123.jpg"'));
  assert.ok(md.render('![a](/assets/hero.jpg)').includes('src="/assets/hero.jpg"'));
  assert.ok(md.render('![a](https://ornek.com/x.jpg)').includes('src="https://ornek.com/x.jpg"'));
  assert.ok(!md.render('![a](/etc/passwd)').includes('<img'));
  assert.ok(!md.render('![a](http://ornek.com/x.jpg)').includes('<img'));
});

test('dizin geçişi (path traversal) engellenir', () => {
  assert.ok(!md.render('![a](/uploads/../../etc/passwd)').includes('<img'));
});

/* ── Markdown biçimlendirme ────────────────────────────────────────────── */

test('başlık, kalın, eğik, alıntı, liste ve çizgi', () => {
  const kaynak = '## Başlık\n\nBir **kalın** ve bir *eğik*.\n\n> Alıntı\n\n- bir\n- iki\n\n1. üç\n\n---';
  const out = md.render(kaynak);
  assert.ok(out.includes('<h2>Başlık</h2>'));
  assert.ok(out.includes('<strong>kalın</strong>'));
  assert.ok(out.includes('<em>eğik</em>'));
  assert.ok(out.includes('<blockquote>Alıntı</blockquote>'));
  assert.ok(out.includes('<ul><li>bir</li><li>iki</li></ul>'));
  assert.ok(out.includes('<ol><li>üç</li></ol>'));
  assert.ok(out.includes('<hr class="hr">'));
});

test('özet 170 karakterde kesilir ve işaretleme temizlenir', () => {
  const uzun = 'kelime '.repeat(80);
  const o = md.excerpt('## Başlık\n\n' + uzun);
  assert.ok(o.length <= 172, 'özet 170 karakteri geçmemeli: ' + o.length);
  assert.ok(!o.includes('#'));
  assert.ok(o.endsWith('…'));
});

/* ── yardımcılar ───────────────────────────────────────────────────────── */

test('slug Türkçe karakterleri doğru çevirir', () => {
  assert.strictEqual(slugify('Taş Sokaklarda Cümle Aramak'), 'tas-sokaklarda-cumle-aramak');
  assert.strictEqual(slugify('Rıhtımda Akşam'), 'rihtimda-aksam');
  assert.strictEqual(slugify('ÇĞİIÖŞÜ âîû'), 'cgiiosu-aiu');
  assert.strictEqual(slugify('   '), 'yazi');
  assert.strictEqual(slugify('!!!'), 'yazi');
  assert.ok(slugify('a'.repeat(200)).length <= 90);
});

test('tarih Türkçe biçimde yazılır', () => {
  assert.strictEqual(dateTR(new Date(2026, 6, 12, 12, 0, 0).getTime()), '12 Temmuz 2026');
});

test('okuma süresi en az 1 dakikadır', () => {
  assert.strictEqual(readMin(''), 1);
  assert.strictEqual(readMin('kelime '.repeat(180).trim()), 1);
  assert.strictEqual(readMin('kelime '.repeat(540).trim()), 3);
});

/* ── şifre ─────────────────────────────────────────────────────────────── */

test('şifre özeti doğrulanır, yanlış şifre reddedilir', () => {
  // auth.js config'e bagli oldugu icin gerekli en az ayari veriyoruz.
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-icin-yeterince-uzun-bir-anahtar-0123456789';
  process.env.DATA_DIR = process.env.DATA_DIR || require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'okuryazar-test-'));
  const { hashPassword, verifyPassword } = require('../server/auth');

  const ozet = hashPassword('Arslan1324!');
  assert.ok(ozet.startsWith('scrypt$'));
  assert.ok(!ozet.includes('Arslan1324!'), 'düz şifre özette görünmemeli');
  assert.strictEqual(verifyPassword('Arslan1324!', ozet), true);
  assert.strictEqual(verifyPassword('arslan1324!', ozet), false);
  assert.strictEqual(verifyPassword('', ozet), false);
  assert.strictEqual(verifyPassword('Arslan1324!', 'bozuk-veri'), false);

  // Ayni sifre her seferinde farkli ozet uretmeli (rastgele tuz).
  assert.notStrictEqual(hashPassword('aynisifre'), hashPassword('aynisifre'));
});
