// Public, unauthenticated page — required by both the Play Store listing
// and (once a real clinic name/address/contact are filled in below) KVKK.
// This is a draft: the bracketed [ ] placeholders must be replaced with the
// clinic's real legal details before this is relied on for a Play Store
// submission or shown to patients' owners.
export const metadata = {
  title: 'Gizlilik Politikası — Börü Care',
};

export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto p-6 text-sm leading-relaxed text-text">
      <h1 className="text-xl font-bold mb-1">Gizlilik Politikası</h1>
      <p className="text-xs text-text3 mb-6">Son güncelleme: [gg.aa.yyyy]</p>

      <p className="mb-4">
        Bu gizlilik politikası, <strong>Börü Care</strong> uygulaması ([Klinik/İşletme Adı] tarafından
        işletilmektedir) üzerinden toplanan kişisel verilerin nasıl işlendiğini açıklar. Uygulama; veteriner
        kliniğinde yatılı tedavi gören hastaların (hayvanların) takibi ve hasta sahipleriyle iletişim amacıyla
        kullanılır.
      </p>

      <h2 className="font-bold mt-6 mb-2">1. Veri Sorumlusu</h2>
      <p className="mb-4">
        [Klinik/İşletme Adı]<br />
        Adres: [Adres]<br />
        E-posta: [İletişim E-postası]<br />
        Telefon: [İletişim Telefonu]
      </p>

      <h2 className="font-bold mt-6 mb-2">2. Toplanan Veriler</h2>
      <p className="mb-2">Uygulama, klinik personeli tarafından girilen ve barındırılan aşağıdaki verileri işler:</p>
      <p className="mb-1">• Hasta sahibi bilgileri: ad soyad, telefon numarası, e-posta adresi (opsiyonel).</p>
      <p className="mb-1">• Hasta (hayvan) bilgileri: ad, tür, cins, yaş, cinsiyet, kafes/oda numarası, sağlık kayıtları (vital bulgular, ameliyat/anestezi kayıtları, notlar, ilaç/tedavi bilgileri, röntgen/kan tahlili gibi işlem kayıtları) ve klinikte çekilen fotoğraflar.</p>
      <p className="mb-1">• Personel hesap bilgileri: ad soyad, e-posta, görev/rol — sadece klinik çalışanları için.</p>
      <p className="mb-4">• Teknik veriler: oturum açma için gerekli minimal çerez/oturum bilgisi. Reklam veya üçüncü taraf analiz amaçlı takip çerezi kullanılmaz.</p>

      <h2 className="font-bold mt-6 mb-2">3. Verilerin Toplanma Amacı</h2>
      <p className="mb-1">• Yatılı hastanın tedavi sürecinin klinik personeli tarafından kaydedilip takip edilmesi.</p>
      <p className="mb-1">• Hasta sahibinin, kendisine özel olarak verilen bağlantı veya QR kod üzerinden hastasının güncel durumunu (durum, yapılan işlemler, fotoğraflar) görebilmesi.</p>
      <p className="mb-4">• Gerektiğinde hasta sahibiyle WhatsApp üzerinden iletişime geçilebilmesi.</p>

      <h2 className="font-bold mt-6 mb-2">4. Verilerin Paylaşımı</h2>
      <p className="mb-1">
        Veriler, barındırma ve veritabanı altyapısı için <strong>Supabase</strong> (yurt dışında konumlanmış
        sunucular) üzerinde saklanır. Hasta sahibiyle iletişim, kendi WhatsApp uygulaması üzerinden doğrudan
        kurulur; mesaj içeriği bu uygulama tarafından WhatsApp dışında üçüncü bir tarafla paylaşılmaz.
      </p>
      <p className="mb-4">
        Veriler; klinik personeli/yöneticisi dışında, yasal zorunluluk olmadıkça üçüncü kişilerle paylaşılmaz,
        satılmaz veya reklam amacıyla kullanılmaz.
      </p>

      <h2 className="font-bold mt-6 mb-2">5. Hasta Sahibinin Erişimi</h2>
      <p className="mb-4">
        Hasta sahibi, kendisine iletilen özel bağlantı/QR kod ile yalnızca kendi hastasına ait bilgileri
        görüntüleyebilir; bir hesap oluşturması veya şifre girmesi gerekmez. Bu bağlantı, hasta taburcu olduktan
        sonra da (kayıtlara erişim amacıyla) aktif kalabilir; kliniğin talebi üzerine devre dışı bırakılabilir.
      </p>

      <h2 className="font-bold mt-6 mb-2">6. Verilerin Saklanma Süresi</h2>
      <p className="mb-4">
        Hasta ve hasta sahibi verileri, klinik kayıtlarının yasal saklama süresi boyunca veya klinik yönetiminin
        belirlediği süre boyunca saklanır. Kayıtların ve fotoğrafların kalıcı olarak silinmesi, yalnızca yetkili
        klinik yöneticisi tarafından uygulama üzerinden talep edilebilir.
      </p>

      <h2 className="font-bold mt-6 mb-2">7. Haklarınız (KVKK m.11)</h2>
      <p className="mb-1">Kişisel verisi işlenen hasta sahipleri; verilerinin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, eksik/yanlış işlenmişse düzeltilmesini isteme, KVKK'da öngörülen şartlarda silinmesini/yok edilmesini isteme haklarına sahiptir.</p>
      <p className="mb-4">Bu haklarınızı kullanmak için yukarıdaki iletişim bilgilerinden kliniğe ulaşabilirsiniz.</p>

      <h2 className="font-bold mt-6 mb-2">8. Uygulama İzinleri</h2>
      <p className="mb-4">
        Uygulama; hasta fotoğrafı eklerken cihazınızın kamerasına/galerisine tarayıcı üzerinden erişim
        isteyebilir. Bu erişim yalnızca klinik personeli tarafından, ilgili işlem sırasında ve tarayıcının kendi
        izin mekanizmasıyla kullanılır. Konum, mikrofon, kişi listesi gibi başka bir izin istenmez.
      </p>

      <h2 className="font-bold mt-6 mb-2">9. İletişim</h2>
      <p className="mb-4">
        Bu politika hakkında sorularınız için: [İletişim E-postası]
      </p>

      <p className="text-xs text-text3 mt-8">
        Bu metin bir taslaktır; köşeli parantez içindeki alanların klinik tarafından gerçek bilgilerle
        doldurulması ve nihai metnin yayınlanmadan önce gözden geçirilmesi gerekir.
      </p>
    </div>
  );
}
