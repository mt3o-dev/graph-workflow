/** BankProfile registry — the ordered set of layouts `generic-tabular-pdf`
 *  tries against a statement's header line. Add a new profile here to
 *  support a new real-world bank layout without touching the parser. */
import { debitCreditProfile } from './debit-credit.profile.js';
import { signedAmountProfile } from './signed-amount.profile.js';
import type { BankProfile } from './types.js';

export const bankProfiles: readonly BankProfile[] = [signedAmountProfile, debitCreditProfile];

export type { BankProfile, ParsedRowCandidate } from './types.js';
export { debitCreditProfile } from './debit-credit.profile.js';
export { signedAmountProfile } from './signed-amount.profile.js';
