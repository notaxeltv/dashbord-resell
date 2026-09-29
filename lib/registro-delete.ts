import { createHash, randomInt } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomRegistroKey(length = 8) {
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += ALPHABET[randomInt(ALPHABET.length)];
  }
  return value;
}

export function hashRegistroKey(code: string) {
  const pepper = process.env.REGISTRO_CODE_PEPPER || "dark-ghost-registro";
  return createHash("sha256")
    .update(`${pepper}:${code.trim().toUpperCase()}`)
    .digest("hex");
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "email";
  return `${name.slice(0, 1)}***@${domain}`;
}

export function registroRecipientEmails(profileEmails: string[]) {
  const override = (process.env.REGISTRO_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const emails = (override.length > 0 ? override : profileEmails)
    .map((email) => email.trim())
    .filter(Boolean);

  const unique = [...new Set(emails.map((email) => email.toLowerCase()))];
  if (unique.length !== 2) return null;
  return emails.slice(0, 2);
}

export async function sendRegistroKeyEmail(to: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REGISTRO_EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error(
      "Mancano RESEND_API_KEY e REGISTRO_EMAIL_FROM su Vercel. Senza quelle le chiavi non partono.",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Chiave per eliminare il registro",
      text: [
        "Dark Ghost Cards",
        "",
        `La tua chiave è: ${code}`,
        "L'altra chiave è stata inviata all'altra email del team.",
        "Inseritele entrambe nella pagina Registro entro 10 minuti.",
        "Se non hai chiesto tu questa cancellazione, ignora il messaggio.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Invio email non riuscito: ${body.slice(0, 180)}`);
  }
}
