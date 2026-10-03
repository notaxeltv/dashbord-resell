/**
 * Invio notifiche Telegram/WhatsApp lato server, senza dipendere da una
 * sessione utente autenticata. Usato sia dalla Route Handler `/api/notify`
 * (chiamata dal browser con una sessione) sia dal digest giornaliero
 * `/api/cron/daily-digest` (chiamato da Vercel Cron, senza utente loggato).
 */

export type NotifyResult =
  | { channel: "telegram" | "whatsapp"; skipped: true }
  | { channel: "telegram" | "whatsapp"; sent: true }
  | { error: string };

function telegramChatIds(): string[] {
  return (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(/[,;\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function sendTelegram(message: string): Promise<NotifyResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = telegramChatIds();

  if (!token || chatIds.length === 0) {
    return { channel: "telegram", skipped: true };
  }

  const failures: string[] = [];

  for (const chatId of chatIds) {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      failures.push(body.slice(0, 180));
    }
  }

  if (failures.length > 0) {
    throw new Error(`Telegram: ${failures.join(" | ")}`);
  }

  return { channel: "telegram", sent: true };
}

export async function sendWhatsapp(message: string): Promise<NotifyResult> {
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

/** Invia lo stesso messaggio su tutti i canali configurati (best-effort). */
export async function sendServerNotification(message: string) {
  const results = await Promise.allSettled([
    sendTelegram(message),
    sendWhatsapp(message),
  ]);

  return results.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : { error: result.reason instanceof Error ? result.reason.message : String(result.reason) },
  );
}
