#!/usr/bin/env node
'use strict';
/**
 * Ilk kurulumda tasarimdaki ornek yazilari ekler (yalnizca hic yazi yoksa).
 * Sitenin bos gorunmemesi icindir; panelden silip kendi yazilarinizi
 * yazabilirsiniz.  Tekrar calistirmak zararsizdir.
 */
const { posts, close } = require('../server/db');
const { slugify } = require('../server/util');

const p1 = `Bir şehri okumakla bir romanı okumak arasında sandığımızdan az fark var. İkisi de sabır ister; ikisi de en güzel cümlelerini acele edene göstermez.

Geçen yaz, taş sokaklarında yürüdüğüm o eski şehirde bunu bir kez daha düşündüm. Kemerlerin altından geçerken insan, iyi kurulmuş bir paragrafın içinden geçiyormuş gibi oluyor: her taş yerli yerinde, her boşluk hesaplı.

## Yolun Grameri

Yol da bir dildir. Meydanlar büyük harfle başlar, ara sokaklar virgüllerle ilerler, denize açılan her boşluk bir nokta gibi insanı durdurur. **Yürümek, okumaktır.** Adım temposu değiştikçe cümlenin ritmi de değişir.

> İyi bir cümle taş gibidir; üstünden yüz yıl geçer, yerinden oynamaz.

Eve dönerken defterime şunu yazmışım: *Gördüğünü anlatma; gördüğünün sende bıraktığı boşluğu anlat.* Edebiyat, sanırım, tam olarak o boşluğun haritasını çıkarma işi.

Yazmak da böyle bir yürüyüş: nereye çıkacağını bilmeden sokağa girmek, kaybolmayı göze almak ve bir köşeyi dönünce meydanı bulmak.`;

const p2 = `Akşam, rıhtıma iner usulca,
gün, suya bırakır adını;
martı ne bilsin saat kaçtır —
o, rüzgârdan sorar yarını.

Ben bir taşın üstünde otururum,
denizi ezberler gibi;
dalga, gelip gelip düzeltir
kıyının bozuk cümlelerini.

Uzakta bir tekne, bir mırıltı,
gökte incelen bir bulut;
ne çok şey söylüyor sussun diye
içimde büyüttüğüm umut.

---

*Bu şiir, bir temmuz akşamı, denize karşı yazıldı.*`;

const p3 = `Bir romanı bitirdiğimizde kapağını kapatırız ama kahramanları kapatamayız. Onlar taşınır bizimle: mutfakta çay demlerken, otobüs beklerken, uykuyla uyanıklık arasında.

## Misafirler

Kitaplıkta değil, hafızada yaşarlar. Kimi sessiz bir misafirdir, yılda bir uğrar; kimi hiç çıkmaz evden. İnsan bazen kendi hayatındaki bir kararı, yıllar önce okuduğu bir kahramana danışarak verir — *o olsa ne yapardı?*

İyi yazılmış bir kahraman, gerçek insanlardan daha kalıcıdır; çünkü onu her okuyuşta yeniden yaşarız, oysa hatıralar yalnızca eskir.

> Okumak, başkasının hayatında kendi yüzünü bulmaktır.

Belki de bu yüzden roman okuyoruz: kalabalıklaşmak için. İçimizde bir masa kuruluyor; Anna'lar, Raskolnikov'lar, Mümtaz'lar aynı sofraya oturuyor ve biz, ev sahibi olarak, hepsinden birer parça oluyoruz.`;

const gun = (s) => new Date(s).getTime();

const tohumlar = [
  { id: 'seed1', title: 'Taş Sokaklarda Cümle Aramak', body: p1, cover: '/assets/hero.jpg', views: 0, at: gun('2026-07-12T18:30:00') },
  { id: 'seed2', title: 'Rıhtımda Akşam', body: p2, cover: '/assets/sea.jpg', views: 0, at: gun('2026-07-19T21:10:00') },
  { id: 'seed3', title: 'Roman Kahramanlarıyla Yaşamak', body: p3, cover: '', views: 0, at: gun('2026-07-27T09:45:00') },
];

if (posts.all().length > 0) {
  console.log('Veritabanında zaten yazı var — örnek yazılar eklenmedi.');
} else {
  for (const t of tohumlar) {
    posts.insert({
      id: t.id, slug: slugify(t.title), title: t.title, body: t.body, cover: t.cover,
      status: 'published', views: t.views, published_at: t.at, updated_at: t.at,
    });
  }
  console.log(`${tohumlar.length} örnek yazı eklendi.`);
}
close();
