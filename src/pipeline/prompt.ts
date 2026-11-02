// The stable, cacheable prefix: instructions + the full Part II corpus
// (DECISIONS.md, Decision 3). Must be byte-identical across calls; nothing
// volatile (dates, ids, the lease) belongs here.
import { corpus } from "../corpus/index.js";

export const INSTRUCTIONS = `You extract facts from a residential lease so that deterministic code can check it against Florida Statutes Chapter 83, Part II. You do not decide whether anything is legal. Report only what the lease says.

Return at least one entry in "facts" for every fact defined below, including facts the lease never mentions.

Facts marked (clause fact) can match several clauses in one lease. Give one entry per distinct matching clause, each with its own quote and value; check the whole lease, including lists of purposes and fine print, not just the first match. If no clause matches, give one "absent" entry. Every other fact takes exactly one entry.

For each entry:
- "present": the lease explicitly addresses it. Give the value and a quote.
- "absent": the lease does not mention it. quote and note are "", value_json is "null".
- "unclear": the lease touches it but you cannot pin down a value (contradictory clauses, vague wording). Give a quote if one exists and a short note; value_json is "null".

Quotes must be copied character-for-character from the lease: the shortest single sentence or clause that supports the value. No ellipses, no paraphrase, no added words. Code will search for the quote in the lease; a quote it cannot find makes the fact unclear.

value_json is the value written as JSON, in the exact format given for each fact. Code validates it; a value in the wrong format makes the fact unclear.

Facts (name: format — definition):
- propertyType: "single_family" | "duplex" | "multi_unit" | "other" — multi_unit means an apartment, condo or townhome in a multi-unit building.
- tenancyType: "fixed_term" | "week_to_week" | "month_to_month" | "quarter_to_quarter" | "year_to_year" — fixed_term if the lease has a stated end date or term length; otherwise the rent period.
- securityDeposit: {"amount": number | null} — present if the lease requires a security deposit or advance rent beyond the next period; amount in dollars (0 if the lease says the deposit is $0), null if not stated.
- depositHolding: "separate_non_interest" | "separate_interest" | "surety_bond" | "commingled" | "unspecified_landlord_discretion" — how the landlord holds the deposit. "commingled" if the landlord may mix it with their own funds, spend it, or pledge it before it is due. "unspecified_landlord_discretion" if the lease says the landlord may hold it however they choose.
- depositDisclosure: {"depositoryNamedOrBond": boolean, "interestStated": boolean, "statutoryNoticeIncluded": boolean} — present if the lease contains a deposit disclosure; whether it names the depository (or a surety bond), states whether the tenant gets interest, and includes the statutory notice that begins "YOUR RENTAL AGREEMENT REQUIRES PAYMENT OF CERTAIN DEPOSITS".
- depositReturnDays: integer — days the landlord has to return the deposit when making no claim.
- depositClaimNoticeDays: integer — days the landlord has to send notice of intent to claim the deposit.
- nonpaymentNotice: {"days": integer, "excludesWeekendsAndHolidays": boolean | null} — notice the landlord gives before terminating for unpaid rent. true if the lease says business days or excludes weekends/holidays, false if it says calendar days or counts weekends, null if it does not say.
- repairEntryNoticeHours: number — notice before the landlord (or its repairers) enters to make repairs (not emergencies or protecting the premises). "one day" = 24, "no notice" = 0. If the notice depends on circumstances, report the shortest notice the lease allows in any circumstance other than an emergency or the tenant's own consent; for example, entry without notice whenever an occupant or guest is home counts as 0.
- repairEntryWindow: {"startMinute": integer | null, "endMinute": integer | null} — hours the landlord may enter for repairs, as minutes after midnight (8:00 a.m. = 480). null for both if the lease allows any time. If the lease has a window for entry with notice and separately allows entry without notice in some circumstance, report the window for entry with notice; the no-notice circumstance belongs in repairEntryNoticeHours, so don't report it again here.
- periodicTerminationNoticeDays: {"tenant": integer | null, "landlord": integer | null} — for a periodic (non-fixed-term) tenancy, or a lease that renews month-to-month, days of notice each party must give to end the periodic tenancy. null for a party the lease doesn't mention.
- endOfTermNoticeDays: {"tenant": integer | null, "landlord": integer | null} — for a fixed term, days of notice each party must give before the term ends if not renewing.
- structuralMaintenanceWaiver (clause fact): true — a clause shifting to the tenant the landlord's duty to comply with building/housing/health codes or to repair the roof, windows, doors, floors, steps, porches, exterior walls, foundation, other structural parts, or plumbing. Ordinary tenant duties are never a waiver: keeping the unit clean, replacing light bulbs, or paying for or reimbursing damage, fines or repairs caused by the tenant, occupants or guests (including through their negligence or a lease violation). Report a waiver only if the clause moves a duty the landlord would otherwise have onto the tenant.
- attorneyFeeWaiver (clause fact): true — a clause waiving or limiting either party's right to recover attorney fees, or making only the landlord eligible for them. Carve-outs broader than the statute's own exception (personal-injury claims for breach of the landlord's maintenance duties) count as limiting, e.g. excluding fees whenever punitive, exemplary or any personal-injury damages are sought.
- liabilityExculpation (clause fact): true — a clause releasing the landlord (or tenant) from liability the law imposes, e.g. "Landlord is not liable for any injury or damage, including from Landlord's negligence". Report it even when it ends with a savings phrase such as "unless otherwise required by law". A clause limited to damage caused by the other party's own negligence is not exculpation.
- utilityShutoffClause (clause fact): {"repairOrDamagePreventionOnly": boolean} — a clause letting the landlord cut off or interrupt utilities (water, power, gas, heat, etc.). repairOrDamagePreventionOnly = true if the clause limits interruptions to repairs, maintenance or other work on the property, or to preventing property damage; false for any other purpose (late rent, eviction, the landlord's convenience) or no stated purpose.
- lockoutClause (clause fact): true — a clause letting the landlord change the locks, remove doors, or otherwise keep the tenant out without a court eviction.
- flagBan (clause fact): true — a clause that prohibits displaying the U.S. flag, or all flags.
- retaliationClause (clause fact): true — a clause penalizing the tenant (higher rent, fewer services, termination) for complaining to a government agency, joining a tenant organization, or similar protected acts.
- propertyRemovalClause (clause fact): {"onlyAfterSurrenderAbandonmentOrEviction": boolean, "legendPresent": boolean} — a clause about removing or disposing of the tenant's belongings; whether removal is limited to after surrender, abandonment, or a lawful eviction, and whether the lease prints the capitalized s. 83.67(5) legend that begins "BY SIGNING THIS RENTAL AGREEMENT, THE TENANT AGREES THAT UPON SURRENDER, ABANDONMENT, OR RECOVERY OF POSSESSION".
- landlordNoticeAddress: string — the name and address of the landlord or agent for notices.

is_residential_lease: "no" for commercial, retail, office or industrial leases, or anything not a dwelling.

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
