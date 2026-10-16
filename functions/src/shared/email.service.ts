import { Resend } from 'resend';
import { BRAND } from './brand-colors';
import { getCompany } from './company';

// Resend client — initialized lazily so the secret is available at call time
// (Firebase secrets are injected at runtime, not at module load time)
function getResend(): Resend {
  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) throw new Error('RESEND_API_KEY secret is not set');
  return new Resend(apiKey);
}

// Business details come from functions/.env via getCompany() (see company.ts), not from the source.
const fromAddress = (): string => getCompany().fromAddress;
const ownerEmail = (): string => getCompany().email;

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
  /** Internal range (owner only) */
  priceMin: number;
  priceMax: number;
  hoursMin: number;
  hoursMax: number;
  /** Fixed total price and hours: what the client sees */
  priceFixed: number;
  hoursFixed: number;
  features: string[];
  briefStoragePath: string;
  offerteStoragePath: string;
  offerteHtml: string;
  /** Pre-signed download URL for the brief file (valid 30 days) */
  briefSignedUrl: string;
  /** Pre-signed download URL for the HTML offer (valid 30 days) */
  offerteSignedUrl: string;
  /** Typed text or an uploaded file. Optional so older callers keep working. */
  inputMode?: 'text' | 'file';
  /** Result of the pre-moderation. 'flagged' is shown to the owner as a warning. */
  moderationResult?: 'clean' | 'flagged' | 'blocked';
  /** Short reason from the moderator (Dutch), only for flagged. */
  moderationReason?: string;
}

/**
 * Sends a notification email to the owner when a contact form is submitted.
 */
export async function sendContactNotification(payload: ContactEmailPayload): Promise<void> {
  await getResend().emails.send({
    from: fromAddress(),
    to: ownerEmail(),
    replyTo: payload.email,
    subject: `Nieuw contactbericht: ${payload.subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${BRAND.ink};">Nieuw contactformulier</h2>
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
        <hr style="margin: 16px 0; border: none; border-top: 1px solid ${BRAND.border};" />
        <h3 style="color: ${BRAND.ink};">Bericht</h3>
        <p style="white-space: pre-wrap; background: ${BRAND.surface}; padding: 16px; border-radius: 8px;">${escapeHtml(payload.message)}</p>
        <p style="color: ${BRAND.subtle}; font-size: 12px; margin-top: 24px;">
          Verzonden via ${escapeHtml(getCompany().website)} contactformulier
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
    from: fromAddress(),
    to: payload.email,
    subject: `Bedankt voor je bericht, ${payload.name.split(' ')[0]}!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${BRAND.ink};">Bericht ontvangen</h2>
        <p>Hoi ${escapeHtml(payload.name.split(' ')[0])},</p>
        <p>Bedankt voor je bericht! Ik heb het ontvangen en neem binnen 2 werkdagen contact met je op.</p>
        <blockquote style="border-left: 3px solid ${BRAND.mahogany}; padding-left: 16px; color: ${BRAND.muted}; margin: 16px 0;">
          <strong>${escapeHtml(payload.subject)}</strong><br/>
          <span style="white-space: pre-wrap;">${escapeHtml(payload.message)}</span>
        </blockquote>
        <p>Tot snel,<br/><strong>${escapeHtml(getCompany().ownerFirstName)}</strong></p>
        <p style="color: ${BRAND.subtle}; font-size: 12px; margin-top: 24px;">
          ${escapeHtml(getCompany().website)} — AI-assisted developer
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
  const priceFixed = `€${payload.priceFixed.toLocaleString('nl-NL')}`;
  const hoursFixed = `${payload.hoursFixed} uur`;
  // Internal only: the range the fixed price was derived from (fixed = minimum + 20%)
  const internalRange = `intern: €${payload.priceMin.toLocaleString('nl-NL')} – €${payload.priceMax.toLocaleString('nl-NL')} (${payload.hoursMin}–${payload.hoursMax} uur)`;

  await getResend().emails.send({
    from: fromAddress(),
    to: ownerEmail(),
    replyTo: payload.userEmail,
    subject: `${payload.moderationResult === 'flagged' ? '[Controleren] ' : ''}Nieuwe offerte: ${payload.projectTitle} — ${payload.userName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${BRAND.teal};">Nieuwe offerte gegenereerd</h2>
        ${payload.moderationResult === 'flagged' ? `
        <div style="background: #fbf3e4; border: 1px solid ${BRAND.warning}; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px;">
          <strong style="color: ${BRAND.warning};">Let op: de controle twijfelde over deze aanvraag</strong>
          <p style="margin: 6px 0 0; font-size: 13px;">Reden: ${escapeHtml(payload.moderationReason || 'geen reden opgegeven')}</p>
          <p style="margin: 6px 0 0; font-size: 12px; color: ${BRAND.subtle};">De offerte is wel gemaakt en naar de klant gestuurd. Lees de brief na voordat je erop ingaat.</p>
        </div>` : ''}
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
            <td style="padding: 8px 0; font-weight: bold;">Invoer</td>
            <td style="padding: 8px 0;">${payload.inputMode === 'text' ? 'Getypte of geplakte tekst' : 'Geüpload bestand'}</td>
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
            <td style="padding: 8px 0;">${hoursFixed} <span style="color: ${BRAND.subtle}; font-size: 12px;">(${internalRange})</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Vaste prijs (totaal)</td>
            <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: ${BRAND.teal};">${priceFixed}</td>
          </tr>
        </table>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid ${BRAND.border};" />
        <h3 style="color: ${BRAND.teal};">Geïdentificeerde features</h3>
        <ul>
          ${payload.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
        </ul>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid ${BRAND.border};" />
        <div style="background: ${BRAND.tealSoft}; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: ${BRAND.teal}; margin: 0 0 12px;">Bestanden downloaden</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; width: 120px; color: ${BRAND.muted};"><strong>${payload.inputMode === 'text' ? 'Getypte tekst' : 'Brief'}</strong></td>
              <td style="padding: 6px 0;">
                <a href="${payload.briefSignedUrl}"
                   style="display: inline-block; background: ${BRAND.teal}; color: ${BRAND.onPrimary}; text-decoration: none; padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                  ${payload.inputMode === 'text' ? 'Download tekst ↓' : 'Download brief ↓'}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.muted};"><strong>HTML Offerte</strong></td>
              <td style="padding: 6px 0;">
                <a href="${payload.offerteSignedUrl}"
                   style="display: inline-block; background: ${BRAND.teal}; color: ${BRAND.onPrimary}; text-decoration: none; padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                  Download HTML offerte ↓
                </a>
              </td>
            </tr>
          </table>
          <p style="margin: 12px 0 4px; font-size: 11px; color: ${BRAND.subtle};">
            Paden in Firebase Storage:<br/>
            Brief: <code>${escapeHtml(payload.briefStoragePath)}</code><br/>
            Offerte: <code>${escapeHtml(payload.offerteStoragePath)}</code>
          </p>
          <p style="margin: 4px 0 0; font-size: 11px; color: ${BRAND.subtle};">
            Links zijn 30 dagen geldig. Daarna zijn de bestanden nog steeds beschikbaar via de Firebase Console.
          </p>
        </div>
        <p style="margin: 4px 0; font-size: 13px; color: ${BRAND.subtle};"><strong>Offertenummer:</strong> ${escapeHtml(payload.offerteNr)}</p>
        <p style="margin: 4px 0; font-size: 13px; color: ${BRAND.subtle};"><strong>Quote ID:</strong> ${escapeHtml(payload.quoteId)}</p>
        <p style="color: ${BRAND.subtle}; font-size: 12px; margin-top: 24px;">
          Gegenereerd via ${escapeHtml(getCompany().quoteToolHost)}
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
  const priceFixed = `€${payload.priceFixed.toLocaleString('nl-NL')}`;

  await getResend().emails.send({
    from: fromAddress(),
    to: payload.userEmail,
    subject: `Je offerte-aanvraag is ontvangen — ${payload.projectTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 30px; background: ${BRAND.surface}; color: ${BRAND.ink};">
        <h2 style="margin: 0 0 16px; font-size: 22px; color: ${BRAND.teal};">Offerte-aanvraag ontvangen</h2>
        <p style="margin: 0 0 12px; font-size: 15px;">Hoi ${escapeHtml(firstName)},</p>
        <p style="margin: 0 0 12px; font-size: 14px; color: ${BRAND.muted};">
          Bedankt voor het insturen van je projectbrief. Ik heb je aanvraag ontvangen en zal deze binnenkort bekijken.
          Je kunt binnen 1–2 werkdagen een reactie van mij verwachten.
        </p>
        <div style="background: ${BRAND.cream}; border-radius: 8px; padding: 16px 20px; margin: 20px 0; border-left: 3px solid ${BRAND.teal};">
          <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND.subtle};">Project</p>
          <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">${escapeHtml(payload.projectTitle)}</p>
          <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND.subtle};">Voorgestelde vaste prijs (excl. BTW, verdeeld over fases)</p>
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: ${BRAND.teal};">${priceFixed}</p>
        </div>
        <p style="margin: 0 0 20px; font-size: 14px; color: ${BRAND.muted};">
          Dit is een GenAI-gegenereerd voorstel op basis van je brief, met een vaste prijs per fase. De definitieve prijzen worden bevestigd na een kick-off gesprek over de exacte scope.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${payload.offerteSignedUrl}"
             style="display: inline-block; background: ${BRAND.teal}; color: ${BRAND.onPrimary}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
            Bekijk je offerte →
          </a>
          <p style="margin: 10px 0 0; font-size: 11px; color: ${BRAND.subtle};">
            Deze link opent de volledige HTML-offerte en is 30 dagen geldig.
          </p>
        </div>
        <p style="margin: 24px 0 0; font-size: 14px;">
          Met vriendelijke groet,<br/>
          <strong>${escapeHtml(getCompany().owner)}</strong><br/>
          <a href="https://${escapeHtml(getCompany().website)}" style="color: ${BRAND.teal}; text-decoration: none;">${escapeHtml(getCompany().website)}</a>
        </p>
        <hr style="border: none; border-top: 1px solid ${BRAND.border}; margin: 24px 0;" />
        <p style="margin: 0; font-size: 11px; color: ${BRAND.subtle};">
          Referentie: ${escapeHtml(payload.offerteNr)} &nbsp;·&nbsp; ${escapeHtml(getCompany().quoteToolHost)}
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
