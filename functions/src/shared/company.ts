/**
 * Business details that appear in offers and e-mails: footer, signature, sender, owner notifications.
 *
 * The values come from environment variables (functions/.env, see functions/.env.example), so the
 * source code, and with it the public showcase repository, only contains fictional example data.
 * Firebase loads functions/.env at deploy time and exposes it as process.env.
 */

export interface Company {
  name: string;
  /** Full name of the person who signs the offer. */
  owner: string;
  ownerFirstName: string;
  address: string;
  /** Contact address on offers, and where owner notifications are sent. */
  email: string;
  phone: string;
  /** Chamber of Commerce number (KvK). */
  kvk: string;
  vat: string;
  /** Host name without https://, for example "voorbeeld.example". */
  website: string;
  quoteToolHost: string;
  /** Sender address of all e-mails (must be a domain verified at the e-mail provider). */
  fromAddress: string;
  /** Letters in front of the offer number, for example "VW" gives "VW-1A2B3C4D". */
  offerPrefix: string;
}

/** Fictional defaults. The reserved ".example" domain can never belong to a real person. */
export const EXAMPLE_COMPANY = {
  COMPANY_NAME: 'Voorbeeld Webstudio',
  COMPANY_OWNER: 'Jan Jansen',
  COMPANY_ADDRESS: 'Voorbeeldstraat 1, 1234 AB Voorbeeldstad',
  COMPANY_EMAIL: 'info@voorbeeld.example',
  COMPANY_PHONE: '06 12345678',
  COMPANY_KVK: '12345678',
  COMPANY_VAT: 'NL000000000B01',
  COMPANY_WEBSITE: 'voorbeeld.example',
  COMPANY_QUOTE_TOOL_HOST: 'quote.voorbeeld.example',
  COMPANY_FROM_EMAIL: 'noreply@voorbeeld.example',
  COMPANY_OFFER_PREFIX: 'VW',
} as const;

type CompanyKey = keyof typeof EXAMPLE_COMPANY;

let warnedAboutDefaults = false;

function read(key: CompanyKey): string {
  const value = process.env[key]?.trim();
  return value ? value : EXAMPLE_COMPANY[key];
}

export function getCompany(): Company {
  if (!warnedAboutDefaults && !process.env['COMPANY_EMAIL']) {
    warnedAboutDefaults = true;
    console.warn(
      'COMPANY_* is not set: offers and e-mails use fictional example details, and owner ' +
        'notifications go to an example address. Create functions/.env (see functions/.env.example).',
    );
  }
  const owner = read('COMPANY_OWNER');
  return {
    name: read('COMPANY_NAME'),
    owner,
    ownerFirstName: owner.split(' ')[0],
    address: read('COMPANY_ADDRESS'),
    email: read('COMPANY_EMAIL'),
    phone: read('COMPANY_PHONE'),
    kvk: read('COMPANY_KVK'),
    vat: read('COMPANY_VAT'),
    website: read('COMPANY_WEBSITE'),
    quoteToolHost: read('COMPANY_QUOTE_TOOL_HOST'),
    fromAddress: read('COMPANY_FROM_EMAIL'),
    offerPrefix: read('COMPANY_OFFER_PREFIX'),
  };
}

/** "WS-1A2B3C4D": the offer number shown on the offer, in the e-mails and in Firestore. */
export function offerNumber(quoteId: string): string {
  return `${getCompany().offerPrefix}-${quoteId.slice(0, 8).toUpperCase()}`;
}
