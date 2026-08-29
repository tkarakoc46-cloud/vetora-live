# Vetora Live — Gerçek Sisteme Geçiş Kurulum Rehberi

Bu belge, `/tmp/vetora-production` altındaki kod tabanını **gerçekten çalışan, canlı bir
uygulamaya** dönüştürmek için açman gereken hesapları ve izleyeceğin adımları anlatır.
Kodun kendisi hazır ve derleniyor (`npm run build` başarıyla geçti) — eksik olan tek şey
gerçek altyapı hesapları.

Toplam süre: hesapları açmak ve bağlamak yaklaşık 30-45 dakika. WhatsApp iş hesabı
doğrulaması (bkz. Adım 4) birkaç saat ile birkaç gün arası sürebilir — bu adımı **en
başta** başlatman öneriliyor, diğer adımları beklerken paralel ilerler.

---

## Adım 1 — GitHub (kod deposu)

1. https://github.com adresinde ücretsiz bir hesap aç (yoksa).
2. Yeni, **private (özel)** bir repo oluştur, örn. `vetora-live`.
3. Bana bu reponun adını/bağlantısını ver — kodu oraya senin adına push edeceğim
   (ya da sen `git push` ile kendin yükleyebilirsin, kod zaten hazır).

## Adım 2 — Supabase (veritabanı + kimlik doğrulama + fotoğraf depolama)

1. https://supabase.com → ücretsiz hesap aç → **New Project**.
2. Proje adı: `vetora-live`, güçlü bir veritabanı şifresi belirle (bir yere kaydet),
   bölge olarak Avrupa'ya yakın bir bölge seç (örn. Frankfurt).
3. Proje oluşunca sol menüden **SQL Editor** → New query → `supabase/schema.sql`
   dosyasının tüm içeriğini yapıştır → **Run**. Bu, tüm tabloları, güvenlik
   kurallarını (RLS) ve fotoğraf deposunu tek seferde kurar.
4. Sol menüden **Project Settings → API** sayfasına git, şu üç değeri kopyala:
   - `Project URL` → `.env` dosyasında `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` anahtarı → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` anahtarı → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Bu anahtarı asla
     paylaşma / tarayıcıya koyma** — sadece Vercel'in sunucu ortam değişkenlerine
     girecek.
5. **İlk personel/yönetici hesaplarını oluştur:**
   - Sol menüden **Authentication → Users → Add user** ile her personel/yönetici
     için bir e-posta+şifre hesabı oluştur (örn. `can.ozturk@vetora.com`).
   - Sonra **SQL Editor**'de her kullanıcı için bir satır ekle (kullanıcı
     oluşturunca görünen UUID'yi kullan):
     ```sql
     insert into profiles (id, full_name, role, email) values
       ('<auth-user-uuid>', 'Can Öztürk', 'ADMIN', 'can.ozturk@vetora.com');
     ```
   - `role` alanı `ADMIN`, `VETERINER`, `TEKNISYEN` veya `RESEPSIYON` olabilir.
   - Bu, prototipteki sabit demo şifrelerin yerini alan **gerçek, hash'lenmiş
     şifre sistemi** — Supabase şifreleri kendisi güvenli şekilde saklıyor, kodun
     hiçbir yerinde açık şifre yok.

## Adım 3 — Vercel (barındırma / yayınlama)

1. https://vercel.com → GitHub hesabınla giriş yap.
2. **Add New → Project** → Adım 1'de oluşturduğun repoyu seç → Import.
3. **Environment Variables** kısmına `.env.example` dosyasındaki tüm değişkenleri
   gerçek değerleriyle gir (Supabase'ten Adım 2'de aldıkların + WhatsApp'tan
   Adım 4'te alacakların).
4. **Deploy** butonuna bas. 1-2 dakikada `https://vetora-live-xxxx.vercel.app`
   gibi bir adreste canlıya alınır.
5. (Opsiyonel) Kendi alan adını bağlamak istersen (örn. `app.vetoralive.com`):
   Vercel → Project → Settings → Domains → alan adını gir, DNS sağlayıcında
   gösterilen kaydı ekle.

## Adım 4 — WhatsApp otomatik iletim (Meta WhatsApp Cloud API)

Önemli: **0533 502 4724 numaranı hiçbir şekilde değiştirmene veya WhatsApp
uygulamasından çıkarmana gerek yok.** Bu numara sadece mesajların *gideceği*
adres olacak — Meta'nın sistemine ayrı, özel bir "gönderici" numarası/hesabı
kaydediyoruz, o da mesajları senin mevcut numarana gönderiyor (tıpkı biri sana
normal WhatsApp mesajı atmış gibi).

1. https://developers.facebook.com → hesap aç (kişisel Facebook hesabınla
   girebilirsin) → **My Apps → Create App → "Other" → "Business"** türünü seç.
2. Uygulama panelinde **Add Product → WhatsApp → Set up**.
3. Meta sana test amaçlı geçici bir numara ve token verir — bununla hemen test
   edebilirsin (bkz. Adım 5). Üretime geçmek için:
   - **WhatsApp → API Setup** sayfasından `Phone number ID`'yi kopyala →
     `WHATSAPP_PHONE_NUMBER_ID`.
   - Kalıcı bir erişim anahtarı (System User token) oluştur: **Business
     Settings → Users → System Users → Add** → bir sistem kullanıcısı oluştur →
     WhatsApp uygulamana `whatsapp_business_messaging` izniyle ata → **Generate
     Token** (süresiz/uzun ömürlü seç) → `WHATSAPP_ACCESS_TOKEN`.
   - `WHATSAPP_HOSPITAL_NUMBER` = `905335024724` (senin mevcut numaran, ülke
     koduyla, boşluksuz).
   - `WHATSAPP_VERIFY_TOKEN` = kendi belirlediğin rastgele bir metin (örn.
     `vetora-webhook-2026`).
4. **İş doğrulaması (Business Verification):** Test aşamasında Meta sadece
   önceden eklediğin en fazla 5 "test alıcı" numarasına mesaj göndermene izin
   verir. Gerçek/sınırsız kullanım için **Business Settings → Security Center
   → Start Verification** ile işletmeni doğrulaman gerekiyor (vergi
   levhası/ticaret sicili gibi belgeler istenebilir). Bu genelde birkaç saat,
   bazen 1-2 gün sürer — başvuruyu şimdiden başlatman iyi olur.
5. **(Şiddetle önerilir) Bir mesaj şablonu onaylat:** WhatsApp, "24 saatlik
   pencere" dışında sadece önceden onaylı şablon mesajlara izin veriyor, yoksa
   ilk mesaj bazen iletilemeyebilir. **WhatsApp Manager → Message Templates →
   Create Template** ile örneğin şunu oluştur ve onaya gönder (genelde
   dakikalar içinde onaylanıyor):
   ```
   Ad: hasta_mesaji
   Kategori: Utility
   Dil: Türkçe
   Gövde: Vetora Live: {{1}} hastası için yeni mesaj: {{2}}
   ```
   Onaylandıktan sonra kod tarafında `lib/whatsapp.ts` içindeki
   `sendWhatsAppTemplateMessage('hasta_mesaji', [hastaAdi, mesaj])` fonksiyonunu
   kullanacak şekilde `lib/actions/ownerMessage.ts` içinde tek satır değiştirmen
   yeterli — bunu birlikte yaparız.

## Adım 5 — Test et

1. Vercel'de yayınlanan adrese git → `/login/admin` → Adım 2.5'te oluşturduğun
   yönetici hesabıyla giriş yap.
2. Supabase → Table Editor → `patients` tablosuna elle bir test hastası ekle
   (veya "hasta ekleme" ekranını birlikte kodlarız — şu an hastalar Supabase
   panelinden ya da SQL ile ekleniyor, hızlı bir sonraki adım olarak staff
   arayüzüne "yeni hasta ekle" formu koyabilirim).
3. O hastanın satırındaki `access_token` değerini kopyala, tarayıcıda
   `<vercel-adresin>/p/<access_token>` adresini aç — bu, hasta sahibinin
   göreceği ekran.
4. O ekrandan bir mesaj gönder → birkaç saniye içinde 0533 502 4724 numarana
   gerçek bir WhatsApp mesajı gelmeli.
5. Personel girişiyle o hastaya bir fotoğraf ekle → hasta sahibi ekranını
   kapatmadan bekle, ~5 saniye içinde fotoğraf otomatik olarak belirmeli
   (sayfa yenilemeden).

## Adım 6 — Mobil uygulama (APK)

Önce açık konuşayım: **gerçek bir .apk dosyasını benim burada (bu sohbet
içinde) derleyip sana atmam mümkün değil.** Bunu denedim — bir Android
uygulaması derlemek için gereken araçlar (Android SDK, Gradle) internetin
belirli, kısıtlı adreslerden indirilmesini gerektiriyor ve çalıştığım ortamın
ağ erişimi buna kapalı (senin bilgisayarına bağlantı üzerinden de denedim,
aynı kısıtlama orada da geçerli — teknik bir sınır, çözemediğim bir şey
değil, gerçekten erişilemiyor).

İyi haber: kodu buna hazırladım, ve senin **~2 dakikanı alacak, hiç kod
bilgisi gerektirmeyen** iki seçenek var:

### Seçenek A — Anında, hiç kurulum yok ("uygulama gibi" telefona ekleme)

Vercel'de site yayına girdikten sonra, telefonunda Chrome ile o adresi aç →
sağ üstteki ⋮ menüsü → **"Ana ekrana ekle"**. Bu, telefonun ana ekranına
gerçek bir uygulama ikonu gibi Vetora Live'ı ekler — tam ekran açılır,
tarayıcı çubuğu görünmez, normal bir uygulamadan görsel olarak ayırt
edilemez. Kodda bunun için gereken her şeyi (uygulama ikonu, isim, tam ekran
modu) zaten ekledim (`public/manifest.json`, `public/icons/`).

### Seçenek B — Gerçek, kurulabilir bir .apk dosyası

Vercel adresin yayına girdikten sonra:

1. Telefon veya bilgisayarından https://www.pwabuilder.com adresine git.
2. Üstteki kutuya Vercel adresini yapıştır (örn.
   `https://vetora-live.vercel.app`) → **Start**.
3. Analiz bitince **"Package For Stores"** → **Android** kartını seç.
4. Varsayılan ayarlarla **Generate** de → birkaç saniye içinde bir `.apk`
   (veya `.aab`) dosyası indirilir.
5. O dosyayı Android telefonuna aktar (WhatsApp'tan kendine gönder, e-posta,
   veya USB kablo) → dosyaya dokun → "Bilinmeyen kaynaklardan yükleme"
   izni iste (telefon soracak) → **Yükle**.

Bu, PWABuilder'ın (Google/Microsoft destekli, ücretsiz, resmi bir araç)
sunucularında gerçekleşen bir derleme — benim burada yapamadığım işi orada
saniyeler içinde yapıyor. Bu adımı da birlikte, ekran paylaşarak ya da
adım adım yürüyerek tamamlayabiliriz; Vercel adresin hazır olunca haber ver.

---

## Bana ne vermen gerekiyor

Yukarıdaki adımları tamamladıkça şunları paylaşman yeterli, kalanını ben
bağlarım / test ederim:

- [ ] GitHub repo adı
- [ ] Supabase `Project URL`, `anon` anahtarı (service_role anahtarını **bana
      değil**, sadece Vercel'in ortam değişkenlerine gir)
- [ ] Vercel proje adresi
- [ ] WhatsApp `Phone number ID` ve doğrulama durumun (test mi, onaylı mı)

## Sırada ne var (bu ilk sürümde henüz olmayanlar)

- Yönetici panelinden yeni hasta / yeni personel ekleme ekranları (şu an
  Supabase panelinden elle ekleniyor)
- Prototipteki diğer ekranlar (raporlar, denetim kaydı, bildirim tercihleri
  vb.) — mimari hazır, aynı desenle hızlıca eklenebilir
- QR kod üretimi (şu an sadece metin bağlantısı var)
- E-posta/SMS ile şifre sıfırlama akışı (Supabase Auth bunu hazır destekliyor,
  sadece arayüzünü ekledik)

Bunlardan hangisini önce istersen onunla devam edelim.
