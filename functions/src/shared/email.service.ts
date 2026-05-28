import { Resend } from 'resend';

// Resend client — initialized lazily so the secret is available at call time
// (Firebase secrets are injected at runtime, not at module load time)
function getResend(): Resend {
  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) throw new Error('RESEND_API_KEY secret is not set');
  return new Resend(apiKey);
}

const FROM_ADDRESS = 'noreply@em.watsturen.nl';
const OWNER_EMAIL = 'info@watsturen.nl';

export interface ContactEmailPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface QuoteEmailPayload {
  userName: string;
  userEmail: string;
  quoteId: string;
  offerteNr: string;
  projectTitle: string;
  projectType: string;
  complexity: string;
  priceMin: number;
  priceMax: number;
  hoursMin: number;
  hoursMax: number;
  features: string[];
  briefStoragePath: string;
  offerteStoragePath: string;
  offerteHtml: string;
  /** Pre-signed download URL for the brief file (valid 30 days) */
  briefSignedUrl: string;
  /** Pre-signed download URL for the HTML offer (valid 30 days) */
  offerteSignedUrl: string;
}

/**
 * Sends a notification email to the owner when a contact form is submitted.
 */
export async function sendContactNotification(payload: ContactEmailPayload): Promise<void> {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: OWNER_EMAIL,
    replyTo: payload.email,
    subject: `Nieuw contactbericht: ${payload.subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Nieuw contactformulier</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 100px;">Naam</td>
            <td style="padding: 8px 0;">${escapeHtml(payload.name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">E-mail</td>
            <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(payload.email)}">${escapeHtml(payload.email)}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Onderwerp</td>
            <td style="padding: 8px 0;">${escapeHtml(payload.subject)}</td>
          </tr>
        </table>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;" />
        <h3 style="color: #1a1a2e;">Bericht</h3>
        <p style="white-space: pre-wrap; background: #f9f9f9; padding: 16px; border-radius: 8px;">${escapeHtml(payload.message)}</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">
          Verzonden via watsturen.nl contactformulier
        </p>
      </div>
    `,
  });
}

/**
 * Sends a confirmation email to the user after contact form submission.
 */
export async function sendContactConfirmation(payload: ContactEmailPayload): Promise<void> {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: payload.email,
    subject: `Bedankt voor je bericht, ${payload.name.split(' ')[0]}!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Bericht ontvangen</h2>
        <p>Hoi ${escapeHtml(payload.name.split(' ')[0])},</p>
        <p>Bedankt voor je bericht! Ik heb het ontvangen en neem binnen 24 uur contact met je op.</p>
        <blockquote style="border-left: 3px solid #6c63ff; padding-left: 16px; color: #555; margin: 16px 0;">
          <strong>${escapeHtml(payload.subject)}</strong><br/>
          <span style="white-space: pre-wrap;">${escapeHtml(payload.message)}</span>
        </blockquote>
        <p>Tot snel,<br/><strong>Dirk</strong></p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">
          watsturen.nl — fullstack developer
        </p>
      </div>
    `,
  });
}

/**
 * Sends a notification email to the owner when a quote is generated.
 * Includes the storage path so the owner can retrieve and edit the HTML offer.
 */
export async function sendQuoteNotification(payload: QuoteEmailPayload): Promise<void> {
  const priceRange = `€${payload.priceMin.toLocaleString('nl-NL')} – €${payload.priceMax.toLocaleString('nl-NL')}`;
  const hoursRange = `${payload.hoursMin}–${payload.hoursMax} uur`;

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: OWNER_EMAIL,
    replyTo: payload.userEmail,
    subject: `Nieuwe offerte: ${payload.projectTitle} — ${payload.userName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0a4f7e;">Nieuwe offerte gegenereerd</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 160px;">Klant</td>
            <td style="padding: 8px 0;">${escapeHtml(payload.userName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">E-mail</td>
            <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(payload.userEmail)}">${escapeHtml(payload.userEmail)}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Project</td>
            <td style="padding: 8px 0;">${escapeHtml(payload.projectTitle)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Type</td>
            <td style="padding: 8px 0;">${escapeHtml(payload.projectType)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Complexiteit</td>
            <td style="padding: 8px 0;">${escapeHtml(payload.complexity)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Geschatte uren</td>
            <td style="padding: 8px 0;">${hoursRange}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Prijsrange</td>
            <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: #0a4f7e;">${priceRange}</td>
          </tr>
        </table>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;" />
        <h3 style="color: #0a4f7e;">Geïdentificeerde features</h3>
        <ul>
          ${payload.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
        </ul>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;" />
        <div style="background: #e8f4fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #0a4f7e; margin: 0 0 12px;">Bestanden downloaden</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; width: 120px; color: #555;"><strong>Brief</strong></td>
              <td style="padding: 6px 0;">
                <a href="${payload.briefSignedUrl}"
                   style="display: inline-block; background: #0a4f7e; color: #fff; text-decoration: none; padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                  Download brief ↓
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #555;"><strong>HTML Offerte</strong></td>
              <td style="padding: 6px 0;">
                <a href="${payload.offerteSignedUrl}"
                   style="display: inline-block; background: #0a4f7e; color: #fff; text-decoration: none; padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                  Download HTML offerte ↓
                </a>
              </td>
            </tr>
          </table>
          <p style="margin: 12px 0 4px; font-size: 11px; color: #888;">
            Paden in Firebase Storage:<br/>
            Brief: <code>${escapeHtml(payload.briefStoragePath)}</code><br/>
            Offerte: <code>${escapeHtml(payload.offerteStoragePath)}</code>
          </p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #888;">
            Links zijn 30 dagen geldig. Daarna zijn de bestanden nog steeds beschikbaar via de Firebase Console.
          </p>
        </div>
        <p style="margin: 4px 0; font-size: 13px; color: #888;"><strong>Offertenummer:</strong> ${escapeHtml(payload.offerteNr)}</p>
        <p style="margin: 4px 0; font-size: 13px; color: #888;"><strong>Quote ID:</strong> ${escapeHtml(payload.quoteId)}</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">
          Gegenereerd via quote.watsturen.nl
        </p>
      </div>
    `,
  });
}

/**
 * Sends a simple confirmation email to the client after a quote is generated.
 * The full offer is available in the quote tool — no HTML offer in the email body.
 */
export async function sendQuoteConfirmation(payload: QuoteEmailPayload): Promise<void> {
  const firstName = payload.userName.split(' ')[0];
  const priceRange = `€${payload.priceMin.toLocaleString('nl-NL')} – €${payload.priceMax.toLocaleString('nl-NL')}`;

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: payload.userEmail,
    subject: `Je offerte-aanvraag is ontvangen — ${payload.projectTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 30px; background: #fff; color: #1a1a2e;">
        <h2 style="margin: 0 0 16px; font-size: 22px; color: #6366f1;">Offerte-aanvraag ontvangen</h2>
        <p style="margin: 0 0 12px; font-size: 15px;">Hoi ${escapeHtml(firstName)},</p>
        <p style="margin: 0 0 12px; font-size: 14px; color: #475569;">
          Bedankt voor het insturen van je projectbrief. Ik heb je aanvraag ontvangen en zal deze binnenkort bekijken.
          Je kunt binnen 1–2 werkdagen een reactie van mij verwachten.
        </p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px 20px; margin: 20px 0; border-left: 3px solid #6366f1;">
          <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Project</p>
          <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">${escapeHtml(payload.projectTitle)}</p>
          <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Indicatieve prijsrange</p>
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: #6366f1;">${priceRange}</p>
        </div>
        <p style="margin: 0 0 20px; font-size: 14px; color: #475569;">
          Dit is een GenAI-gegenereerde indicatie op basis van je brief. De definitieve prijs wordt afgesproken na een kick-off gesprek.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${payload.offerteSignedUrl}"
             style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
            Bekijk je offerte →
          </a>
          <p style="margin: 10px 0 0; font-size: 11px; color: #94a3b8;">
            Deze link opent de volledige HTML-offerte en is 30 dagen geldig.
          </p>
        </div>
        <p style="margin: 24px 0 0; font-size: 14px;">
          Met vriendelijke groet,<br/>
          <strong>Dirk van der Giesen</strong><br/>
          <a href="https://watsturen.nl" style="color: #6366f1; text-decoration: none;">watsturen.nl</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="margin: 0; font-size: 11px; color: #94a3b8;">
          Referentie: ${escapeHtml(payload.offerteNr)} &nbsp;·&nbsp; quote.watsturen.nl
        </p>
      </div>
    `,
  });
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
