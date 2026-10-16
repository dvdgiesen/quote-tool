/**
 * Blocklist of disposable e-mail services, shared by the contact form and the quote tool.
 * Not complete (new services appear all the time), but it removes the cheapest way to create
 * many accounts.
 */
const BLOCKED_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net',
  'guerrillamail.org', 'spam4.me', 'trashmail.com', 'trashmail.me',
  'dispostable.com', 'maildrop.cc', 'spamgourmet.com', 'fakeinbox.com',
  '10minutemail.com', 'temp-mail.org', 'tempmailo.com', 'tempail.com',
  'getnada.com', 'mailnesia.com', 'moakt.com', 'mohmal.com',
  'emailondeck.com', 'burnermail.io', 'mintemail.com', 'throwawaymail.com',
  'mailcatch.com', 'inboxkitten.com', 'discard.email', 'getairmail.com',
  'mailsac.com', 'mytemp.email',
]);

/** True when the address belongs to a blocked domain or a subdomain of one. */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().split('@')[1]?.toLowerCase();
  if (!domain) return false;
  for (const blocked of BLOCKED_DOMAINS) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}
