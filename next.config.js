/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // e-Klinik belgeleri (tomografi/röntgen görüntüleri özellikle) 8mb'ı
    // kolayca aşabiliyordu ve o durumda Next.js isteği bizim kodumuza hiç
    // ulaştırmadan reddediyordu — kullanıcıya "hiçbir şey olmadı" gibi
    // görünen asıl neden buydu. Uygulama tarafındaki 25MB üst sınırın
    // (lib/actions/labResults.ts) üzerine biraz pay bırakıyoruz.
    serverActions: { bodySizeLimit: '30mb' },
    // sharp, native/derlenmiş bir ikili dosya (.node) içeriyor. Next.js'in
    // webpack ile Server Action kodunu paketleme (bundling) süreci bu tür
    // dosyaları düzgün taşıyamayabiliyor — yerel ortamda sorunsuz görünüp
    // Vercel'e deploy edildiğinde çalışma anında sessizce bozulabiliyor. Bu
    // paketi "external" işaretlemek, Next.js'e onu paketlemek yerine
    // çalışma anında normal bir Node.js require() ile yüklemesini
    // söylüyor — native modüllerin doğru şekilde çalışması için önerilen
    // yöntem bu.
    serverComponentsExternalPackages: ['sharp'],
  },
};

module.exports = nextConfig;
