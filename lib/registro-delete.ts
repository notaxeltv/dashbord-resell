import { createHash, randomInt } from "crypto";
import nodemailer from "nodemailer";

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

const GMAIL_USER = "darkghost.cards@gmail.com";

export async function sendRegistroKeyEmail(to: string, code: string) {
  const user = process.env.GMAIL_USER?.trim() || GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") ?? "";
  if (!pass) {
    throw new Error(
      "Manca GMAIL_APP_PASSWORD. In Google Account crea una password per le app e mettila su Vercel, poi rideploya.",
    );
  }

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  await transport.sendMail({
    from: `Dark Ghost Cards <${user}>`,
    to,
    subject: "Chiave per eliminare il registro",
    text: [
      "Dark Ghost Cards",
      "",
      `La tua chiave è: ${code}`,
      "L'altra chiave è stata inviata all'altra email del team.",
      "Inseritele entrambe nella pagina Registro entro 10 minuti.",
      "Se non hai chiesto tu questa cancellazione, ignora il messaggio.",
    ].join("\n"),
  });
}
