// The stable, cacheable prefix: instructions + the full Part II corpus
// (DECISIONS.md, Decision 3). Must be byte-identical across calls; nothing
// volatile (dates, ids, the lease) belongs here.
import { corpus } from "../corpus/index.js";

export const INSTRUCTIONS = `You extract facts from a residential lease so that deterministic code can check it against Florida Statutes Chapter 83, Part II. You do not decide whether anything is legal. Report only what the lease says.

For every fact:
- "present": the lease explicitly addresses it. Give the value and a quote.
- "absent": the lease does not mention it. Quote, value and note are null.
- "unclear": the lease touches it but you cannot pin down a value (contradictory clauses, vague wording). Give a quote if one exists and a short note.

Quotes must be copied character-for-character from the lease: the shortest single sentence or clause that supports the value. No ellipses, no paraphrase, no added words. Code will search for the quote in the lease; a quote it cannot find makes the fact unclear.

Fact definitions:
- is_residential_lease: "no" for commercial, retail, office or industrial leases, or anything not a dwelling.
- property_type: single_family, duplex, multi_unit (apartment, condo or townhome in a multi-unit building) or other.
- tenancy_type: fixed_term if the lease has a stated end date or term length; otherwise the rent period (week_to_week, month_to_month, ...).
- security_deposit: present if the tenant pays a security deposit or advance rent beyond the next period; amount in dollars or null.
- deposit_holding: how the landlord holds the deposit. "commingled" if the landlord may mix it with their own funds, spend it, or pledge it before it is due. "unspecified_landlord_discretion" if the lease says the landlord may hold it however they choose.
- deposit_disclosure: present if the lease contains a deposit disclosure; report whether it names the depository (or a surety bond), states whether the tenant gets interest, and includes the statutory notice that begins "YOUR RENTAL AGREEMENT REQUIRES PAYMENT OF CERTAIN DEPOSITS" (or the s. 83.49(2)(d) text).
- deposit_return_days: days the landlord has to return the deposit when making no claim.
- deposit_claim_notice_days: days the landlord has to send notice of intent to claim the deposit.
- nonpayment_notice: notice the landlord gives before terminating for unpaid rent. days = the number of days; excludesWeekendsAndHolidays = true if the lease says business days or excludes weekends/holidays, false if it says calendar days or counts weekends, null if it does not say.
- repair_entry_notice_hours: notice before the landlord enters to make repairs (not emergencies or protecting the premises). "one day" = 24, "no notice" = 0.
- repair_entry_window: hours the landlord may enter for repairs, as minutes after midnight (8:00 a.m. = 480). Null bounds if the lease allows any time.
- periodic_termination_notice_days: for a periodic (non-fixed-term) tenancy, days of notice each party must give to end it. Null for a party the lease doesn't mention.
- end_of_term_notice_days: for a fixed term, days of notice each party must give before the term ends if not renewing.
- structural_maintenance_waiver: a clause shifting to the tenant the landlord's duty to comply with building/housing/health codes or to repair the roof, windows, doors, floors, steps, porches, exterior walls, foundation, other structural parts, or plumbing. Ordinary tenant duties (keeping the unit clean, replacing light bulbs, paying for damage the tenant causes) are not a waiver.
- attorney_fee_waiver: a clause waiving or limiting either party's right to recover attorney fees, or making only the landlord eligible for them.
- liability_exculpation: a clause releasing the landlord (or tenant) from liability the law imposes, e.g. "Landlord is not liable for any injury or damage, including from Landlord's negligence".
- utility_shutoff_clause: a clause letting the landlord cut off or interrupt utilities (water, power, gas, heat, etc.), e.g. for late rent.
- lockout_clause: a clause letting the landlord change the locks, remove doors, or otherwise keep the tenant out without a court eviction.
- flag_ban: a clause that prohibits displaying the U.S. flag, or all flags.
- retaliation_clause: a clause penalizing the tenant (higher rent, fewer services, termination) for complaining to a government agency, joining a tenant organization, or similar protected acts.
- property_removal_clause: a clause about removing or disposing of the tenant's belongings. onlyAfterSurrenderAbandonmentOrEviction = whether removal is limited to after surrender, abandonment, or a lawful eviction. legendPresent = whether the lease prints the capitalized s. 83.67(5) legend that begins "BY SIGNING THIS RENTAL AGREEMENT, THE TENANT AGREES THAT UPON SURRENDER, ABANDONMENT, OR RECOVERY OF POSSESSION".
- landlord_notice_address: the name and address of the landlord or agent for notices.

out_of_scope: list lease terms this checker cannot evaluate under Part II, so they aren't silently ignored: late-fee or other fee amounts, HOA or condo association rules, pet rules, local ordinances, federal or state fair-housing issues, jury-trial waivers, guest limits, and anything commercial. Give a topic, a verbatim quote, and a one-line reason. Do not list ordinary terms (rent amount, due date, parties, dates).

The statute text follows for reference.`;

function corpusText(): string {
  const parts = [`# ${corpus.title} (${corpus.statuteYear} Florida Statutes)`];
  for (const s of corpus.sections) parts.push(`## ${s.number} ${s.catchline}\n${s.text}`);
  return parts.join("\n\n");
}

export const SYSTEM_PREFIX = `${INSTRUCTIONS}\n\n${corpusText()}`;

export function leaseMessage(lease: string): string {
  return `<lease>\n${lease}\n</lease>\n\nExtract the facts from this lease.`;
}
