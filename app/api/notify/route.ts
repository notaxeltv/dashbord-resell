import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Route Handler server-side per l'invio di notifiche verso Telegram e/o
 * WhatsApp (via Twilio). I provider sono opzionali e indipendenti: vengono
 * attivati solo se le relative variabili d'ambiente sono configurate.
 * Se nessuna è presente, la richiesta risponde con `skipped` senza errori.
 */

async function sendTelegram(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { channel: "telegram", skipped: true };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram: ${body}`);
  }

  return { channel: "telegram", sent: true };
}

async function sendWhatsapp(message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.TWILIO_WHATSAPP_TO;

  if (!accountSid || !authToken || !from || !to) {
    return { channel: "whatsapp", skipped: true };
  }

  const body = new URLSearchParams({ From: from, To: to, Body: message });
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64",
  );

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WhatsApp (Twilio): ${text}`);
  }

  return { channel: "whatsapp", sent: true };
}

export async function POST(request: Request) {
  let message: unknown;

  try {
    const body = await request.json();
    message = body?.message;
  } catch {
    return NextResponse.json(
      { error: "Corpo della richiesta non valido." },
      { status: 400 },
    );
  }

  if (typeof message !== "string" || message.trim() === "") {
    return NextResponse.json(
      { error: "Il campo 'message' è obbligatorio." },
      { status: 400 },
    );
  }

  const results = await Promise.allSettled([
    sendTelegram(message),
    sendWhatsapp(message),
  ]);

  return NextResponse.json({
    results: results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : { error: result.reason instanceof Error ? result.reason.message : String(result.reason) },
    ),
  });
}
