/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // e-Klinik belgeleri (tomografi/röntgen görüntüleri özellikle) 8mb'ı
    // kolayca aşabiliyordu ve o durumda Next.js isteği bizim kodumuza hiç
    // ulaştırmadan reddediyordu — kullanıcıya "hiçbir şey olmadı" gibi
    // görünen asıl neden buydu. Uygulama tarafındaki 25MB üst sınırın
    // (lib/actions/labResults.ts) üzerine biraz pay bırakıyoruz.
    serverActions: { bodySizeLimit: '30mb' },
  },
};

module.exports = nextConfig;
