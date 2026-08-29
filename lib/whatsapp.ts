// Real, automatic WhatsApp forwarding via the official Meta WhatsApp
// Cloud API. This replaces the prototype's `wa.me` link (which only
// pre-fills a message someone still has to tap "send" on) with an actual
// server-to-server API call that lands in the clinic's WhatsApp inbox
// with no human action required.
//
// Requires (see .env.example):
//   WHATSAPP_PHONE_NUMBER_ID   — the Cloud API sender's Phone Number ID
//   WHATSAPP_ACCESS_TOKEN      — a permanent System User access token
//   WHATSAPP_HOSPITAL_NUMBER   — the clinic's WhatsApp number, digits only
//
// See SETUP.md for how to obtain these from Meta for Developers.
//
// IMPORTANT — WhatsApp's 24-hour session window:
// Meta only allows a business to send a free-form text message (what
// sendWhatsAppMessage() below does) to a number that has messaged the
// Business number within the last 24 hours. Outside that window, Meta
// rejects the call unless you use a pre-approved *message template*.
// In practice that means: the very first owner message of the day may
// fail to deliver as free text if nobody at the clinic has texted the
// Business number recently. Two ways to make delivery reliable:
//   1. Get one simple template approved in Meta Business Manager, e.g.
//      "Vetora Live: {{1}} hastası için yeni mesaj: {{2}}" — then use
//      sendWhatsAppTemplateMessage() instead, which always works,
//      24-hour window or not.
//   2. Or just have clinic staff send any message to the Business
//      number once a day to keep the window open, and keep using
//      sendWhatsAppMessage(). Simpler to set up, less robust.
// Template approval usually takes minutes to a couple of hours once
// submitted — see SETUP.md for the exact steps.

export async function sendWhatsAppMessage(text: string): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const to = process.env.WHATSAPP_HOSPITAL_NUMBER;

  if (!phoneNumberId || !accessToken || !to) {
    return { ok: false, error: 'WhatsApp entegrasyonu yapılandırılmamış (ortam değişkenleri eksik).' };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json?.error?.message ?? `WhatsApp API hatası (${res.status})` };
    }
    return { ok: true, messageId: json.messages?.[0]?.id ?? '' };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Bilinmeyen ağ hatası' };
  }
}

// Template-based send — works even outside the 24-hour session window.
// `templateName` must match an APPROVED template in Meta Business Manager
// (WhatsApp Manager → Message Templates), with the same number of {{n}}
// placeholders as `params`, in order.
export async function sendWhatsAppTemplateMessage(
  templateName: string,
  params: string[]
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const to = process.env.WHATSAPP_HOSPITAL_NUMBER;

  if (!phoneNumberId || !accessToken || !to) {
    return { ok: false, error: 'WhatsApp entegrasyonu yapılandırılmamış (ortam değişkenleri eksik).' };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'tr' },
          components: [
            {
              type: 'body',
              parameters: params.map((p) => ({ type: 'text', text: p })),
            },
          ],
        },
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json?.error?.message ?? `WhatsApp API hatası (${res.status})` };
    }
    return { ok: true, messageId: json.messages?.[0]?.id ?? '' };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Bilinmeyen ağ hatası' };
  }
}
