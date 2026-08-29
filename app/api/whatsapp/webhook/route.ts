import { NextRequest, NextResponse } from 'next/server';

// Optional but recommended: Meta asks for a webhook URL when you set up
// the WhatsApp product, used for delivery-status callbacks and (if you
// ever want it) inbound replies from the clinic's WhatsApp number back
// into the app. Point Meta's "Callback URL" at
// https://<your-domain>/api/whatsapp/webhook and set "Verify token" to
// the same value as WHATSAPP_VERIFY_TOKEN in your environment.

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Delivery statuses and any inbound replies land here. For the MVP we
  // just log them — wire this up to update `messages.whatsapp_message_id`
  // rows or to create a `records`/notification entry once you need it.
  console.log('WhatsApp webhook event:', JSON.stringify(body));
  return NextResponse.json({ received: true });
}
