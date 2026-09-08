// Personel, hasta sahibinin telefonunu "05xx xxx xx xx" gibi Türkiye'de
// alışılmış yerel biçimde giriyor (bkz. app/patients/new/page.tsx), ama
// WhatsApp Cloud API numarayı ülke koduyla, boşluksuz ve başında artı/sıfır
// OLMADAN istiyor (ör. "905321234567"). Bu, personelin girdiği ne olursa
// olsun o biçime çevirmeye çalışan basit, kural tabanlı bir yardımcı.
// Hiçbir zaman kesin doğrulama yapmaz — sadece "elimizden gelen en iyi
// tahmin"; format hâlâ tanınmıyorsa null döner ve çağıran taraf mesaj
// göndermeyi sessizce atlar (bkz. lib/actions/labResults.ts).
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('90') && digits.length === 12) return digits; // 90 5xx xxx xx xx
  if (digits.startsWith('0') && digits.length === 11) return '90' + digits.slice(1); // 0 5xx xxx xx xx
  if (digits.startsWith('5') && digits.length === 10) return '90' + digits; // 5xx xxx xx xx
  return null;
}
