// The hard golden set: long leases where the clauses that matter are buried in
// boilerplate, split across sections, phrased the way real forms phrase them, and
// surrounded by look-alikes. Patterns come from what the first real-lease runs got
// wrong (entry-purpose lists, savings phrases, force majeure, crime-only disclaimers,
// reimbursement clauses), reworded from scratch. All names and places are fictional.
import type { LibraryKey } from "./library.js";

export interface Label {
  ruleId: string;
  citation: string;
  severity: "violation" | "void" | "notice" | "review";
  /** Text of the clause as written in the section (placeholders allowed); null = no clause to point at. */
  quote: string | null;
  note: string;
  optional?: boolean;
}

export interface Custom {
  t: string;
  x: string;
  labels?: Label[];
  /** This clause is a compliant look-alike; the note says why. */
  near?: string;
  /** This clause is outside Part II; the topic it should be listed under. */
  oos?: string;
}

export type Section = LibraryKey | Custom;

export interface HardSpec {
  id: string;
  split: "dev" | "test";
  summary: string;
  terms: { O: string; R: string; P: string };
  style: "numbered" | "articles" | "caps" | "scan";
  title: string;
  preamble: string;
  sections: Section[];
  /** Labels with no clause (something the lease leaves out). */
  spanless?: Label[];
}

const L = (ruleId: string, citation: string, severity: Label["severity"], quote: string | null, note: string, optional = false): Label =>
  optional ? { ruleId, citation, severity, quote, note, optional } : { ruleId, citation, severity, quote, note };

export const SPECS: HardSpec[] = [
  {
    id: "hard-01-garden-community",
    split: "dev",
    summary: "Long garden-community lease. Entry-purpose list hides a removal right and a repair shutoff; a broad liability limit hides behind 'unless otherwise required by law'.",
    terms: { O: "Owner", R: "Resident", P: "Apartment" },
    style: "numbered",
    title: "APARTMENT LEASE AGREEMENT\nCypress Hollow Apartments",
    preamble:
      'This Lease is made on April 3, 2027 between Cypress Hollow Owner, LLC, acting through its managing agent Larkspur Residential (together, "Owner"), and Tamsin Greer and Luis Ocampo (together, "Resident"). Owner leases to Resident Apartment 1123 (the "Apartment") at Cypress Hollow Apartments, 5600 Old Cheney Highway, Orlando, Florida 32807, a 312-unit apartment community, for a term beginning May 1, 2027 and ending April 30, 2028. Monthly rent is $1,795.00.',
    sections: [
      "rent_payment",
      "late_fee",
      {
        t: "Security Deposit",
        x: "Resident has paid a security deposit of $1,000.00. Owner will hold the deposit in a separate non-interest-bearing account at Seminole River Bank, 300 S. Orange Avenue, Orlando, Florida 32801. Resident is not entitled to interest on the deposit.\n\n[[NOTICE]]",
      },
      "occupants",
      "use",
      "guests",
      "conduct",
      "smoking",
      "parking",
      "trash",
      "pool",
      "insurance",
      {
        t: "Limitation of Liability",
        x: "Unless otherwise required by law, Owner is not liable to Resident, occupants or guests for any personal injury or for any damage to or loss of personal property, from any cause, including fire, smoke, rain, flood, water leaks, hail, lightning, wind, explosions, theft, or the acts of other residents.",
        labels: [
          L("liability-exculpation", "83.47(1)(b)", "void", "Unless otherwise required by law, Owner is not liable to Resident, occupants or guests for any personal injury or for any damage to or loss of personal property, from any cause, including fire, smoke, rain, flood, water leaks, hail, lightning, wind, explosions, theft, or the acts of other residents.", "label policy row 2: broad limit with a savings phrase"),
        ],
      },
      "security_disclaimer",
      "lockout_service",
      {
        t: "Access by Owner",
        x: "Owner and Owner's contractors may enter the Apartment for the purposes listed below after giving Resident at least 24 hours' notice, and only between 7:30 a.m. and 8:00 p.m., except in an emergency or to protect or preserve the premises. The permitted purposes are: (a) to make repairs or perform maintenance; (b) to show the Apartment to prospective residents, lenders or buyers; (c) to perform pest control; (d) to replace air conditioning filters and test smoke detectors; (e) to remove window coverings, decorations or other items that violate the Community Policies; and (f) to interrupt water or electrical service when needed to complete repairs.",
        labels: [
          L("property-removal", "83.67(5)", "violation", "(e) to remove window coverings, decorations or other items that violate the Community Policies;", "label policy row 5: entry purpose that removes the tenant's things"),
          L("utility-shutoff", "83.67(1)", "review", "(f) to interrupt water or electrical service when needed to complete repairs.", "label policy row 1: repair interruption"),
        ],
      },
      "mold",
      "pests",
      "smoke_detectors",
      "alterations",
      "appliances",
      "ac_filters",
      "damage_reimbursement",
      {
        t: "Repairs",
        x: "Owner will comply with applicable building, housing and health codes and will maintain the roof, windows, exterior walls, foundation, other structural components and plumbing in reasonable repair. Owner will make other repairs within a reasonable time after Resident's written request.",
      },
      "hurricane",
      "packages",
      "keys",
      "satellite",
      "grills",
      "window_coverings",
      "pets",
      {
        t: "Default by Resident",
        x: "If Resident fails to pay rent when due, Owner may deliver a written notice demanding payment of the rent or possession of the Apartment within 3 days, excluding Saturday, Sunday, and legal holidays. Owner may recover possession of the Apartment only through a court eviction.",
      },
      {
        t: "Notice of Non-Renewal",
        x: "If either party does not intend to renew this Lease, that party must give the other written notice at least 60 days before the end of the Lease term. If neither party gives notice, this Lease will continue month-to-month, and either party may end the month-to-month tenancy by written notice given at least 30 days before the end of a monthly period.",
        near: "60 days is the statutory maximum; 30 days for the month-to-month renewal is the minimum",
      },
      {
        t: "Deposit Accounting",
        x: "Within 15 days after Resident surrenders the Apartment, Owner will return the deposit if Owner makes no claim on it. If Owner intends to impose a claim, Owner will send written notice of the claim by certified mail or e-mail within 30 days after Resident surrenders the Apartment.",
      },
      {
        t: "Property Left Behind",
        x: "If Resident surrenders or abandons the Apartment, Owner may remove and dispose of personal property Resident leaves behind.\n\n[[LEGEND]]",
        near: "removal only after surrender/abandonment, with the statutory legend",
      },
      "jury",
      "sublet",
      "community_policies",
      "joint_liability",
      "email_consent",
      {
        t: "Attorney Fees",
        x: "In any lawsuit concerning this Lease or the Apartment, the prevailing party may recover reasonable attorney fees and court costs from the nonprevailing party.",
      },
      {
        t: "Notices to Owner",
        x: "Notices to Owner must be delivered to Larkspur Residential, Cypress Hollow Leasing Office, 5600 Old Cheney Highway, Orlando, Florida 32807.",
      },
      "radon",
      "severability",
      "entire_agreement",
      "governing_law",
    ],
  },
  {
    id: "hard-02-small-building-as-is",
    split: "dev",
    summary: "Eight-unit building. An AS-IS clause removes the repair duty; the deposit deadline sits in a later section; holdover notice is 15 days.",
    terms: { O: "Landlord", R: "Tenant", P: "Unit" },
    style: "articles",
    title: "RESIDENTIAL LEASE",
    preamble:
      'Bellweather Properties, Inc. ("Landlord") leases to Imani Okonkwo ("Tenant") Unit 4 (the "Unit") of the eight-unit apartment building at 1907 Fern Street, West Palm Beach, Florida 33401, for a term of twelve months beginning August 1, 2027 and ending July 31, 2028, at a monthly rent of $1,520.00.',
    sections: [
      "rent_payment",
      "late_fee",
      {
        t: "Security Deposit",
        x: "Tenant has paid a security deposit of $1,520.00, which Landlord holds in a separate interest-bearing account at Palm Coast Savings, 120 Clematis Street, West Palm Beach, Florida 33401. Tenant will receive simple interest on the deposit at 5 percent per year.\n\n[[NOTICE]]",
      },
      {
        t: "Condition of Unit",
        x: "Tenant has inspected the Unit and accepts it in its present, AS-IS condition. Landlord has no obligation to make repairs, replacements or improvements to the Unit or the building except those Landlord elects to make in its sole discretion.",
        labels: [
          L("maintenance-waiver", "83.51(1)", "void", "Landlord has no obligation to make repairs, replacements or improvements to the Unit or the building except those Landlord elects to make in its sole discretion.", "multi-unit building: the landlord's code, structural and plumbing duties can't be waived"),
        ],
      },
      "occupants",
      "use",
      "conduct",
      "smoking",
      "parking",
      "trash",
      "insurance",
      "mold",
      "pests",
      "smoke_detectors",
      "alterations",
      "appliances",
      "ac_filters",
      "repair_requests",
      "damage_reimbursement",
      "hurricane",
      "sublet",
      "keys",
      "inspection",
      "pets",
      "guests",
      {
        t: "Entry",
        x: "Landlord may enter the Unit with at least twenty-four (24) hours' notice, between 8:00 a.m. and 7:00 p.m., to inspect, make repairs, or show the Unit, and at any time in an emergency.",
      },
      {
        t: "Default",
        x: "If Tenant fails to pay rent when due, Landlord may give Tenant a written three-day notice, excluding Saturday, Sunday, and legal holidays, demanding payment or possession.",
      },
      {
        t: "Non-Renewal",
        x: "Either party who does not intend to renew must give the other written notice at least thirty (30) days before the end of the term.",
      },
      {
        t: "Holdover",
        x: "If Tenant remains in the Unit after the Lease term with Landlord's consent, the tenancy will be month-to-month at the rent then in effect, and either party may end it by giving the other at least fifteen (15) days' written notice.",
        labels: [
          L("periodic-termination-notice", "83.57(3)", "void", "If Tenant remains in the Unit after the Lease term with Landlord's consent, the tenancy will be month-to-month at the rent then in effect, and either party may end it by giving the other at least fifteen (15) days' written notice.", "15 < 30 days for the month-to-month holdover"),
        ],
      },
      "move_out_cleaning",
      {
        t: "Return of Deposit",
        x: "Within forty-five (45) days after Tenant vacates, Landlord will return the security deposit, less any amounts Landlord is entitled to deduct, together with an itemized statement of any deductions.",
        labels: [
          L("deposit-return-deadline", "83.49(3)(a)", "void", "Within forty-five (45) days after Tenant vacates, Landlord will return the security deposit, less any amounts Landlord is entitled to deduct, together with an itemized statement of any deductions.", "45 > 15 days"),
          L("deposit-claim-deadline", "83.49(3)(a)", "void", "Within forty-five (45) days after Tenant vacates, Landlord will return the security deposit, less any amounts Landlord is entitled to deduct, together with an itemized statement of any deductions.", "the itemized statement is the claim notice: 45 > 30 days; arguable, since the clause never says 'claim'", true),
        ],
      },
      {
        t: "Attorney Fees",
        x: "The prevailing party in any action to enforce this Lease may recover reasonable attorney fees and costs.",
      },
      {
        t: "Notices",
        x: "Notices to Landlord shall be sent to Bellweather Properties, Inc., 2200 N. Flagler Drive, Suite 4, West Palm Beach, Florida 33407.",
      },
      "radon",
      "lead",
      "email_consent",
      "severability",
      "entire_agreement",
      "governing_law",
    ],
  },
  {
    id: "hard-03-scanned-midrise",
    split: "dev",
    summary: "Scanned-looking mid-rise lease (wrapped lines, page headers). Deposit may sit in the operating account, notice counts weekends, a balcony rule bans flags, abandoned-property clause lacks the legend.",
    terms: { O: "Lessor", R: "Lessee", P: "Apartment" },
    style: "scan",
    title: "LEASE AGREEMENT - HARBORSIDE APARTMENTS",
    preamble:
      'Lessor: Harborside Pensacola LP ("Lessor"). Lessee: Desmond Achebe ("Lessee"). Apartment: No. 507, Harborside Apartments, 44 Palafox Wharf Road, Pensacola, Florida 32502, in a 96-unit apartment building (the "Apartment"). Term: March 1, 2028 through February 28, 2029. Rent: $1,640.00 per month.',
    sections: [
      "rent_payment",
      {
        t: "Security Deposit",
        x: "Lessee has paid a security deposit of $1,400.00. The deposit may be held in any account maintained by Lessor, including Lessor's operating account, at Gulf Breeze Bank, 18 Garden Street, Pensacola, Florida 32502. Lessee will not receive interest on the deposit. If Lessor makes no claim, the deposit will be returned within 15 days after the Lease ends; notice of any claim will be sent within 30 days after the Lease ends.",
        labels: [
          L("deposit-holding", "83.49(1)", "violation", "The deposit may be held in any account maintained by Lessor, including Lessor's operating account,", "commingled with operating funds"),
        ],
      },
      "late_fee",
      {
        t: "Rent Default",
        x: "If rent is not paid when due, Lessor may terminate this Lease after delivering a written demand for payment or possession and allowing Lessee three (3) calendar days, including weekends and holidays, to comply.",
        labels: [L("nonpayment-notice", "83.56(3)", "void", "allowing Lessee three (3) calendar days, including weekends and holidays, to comply.", "counts weekends and holidays")],
      },
      "occupants",
      "use",
      "conduct",
      "smoking",
      "parking",
      "trash",
      "pool",
      "insurance",
      "mold",
      "pests",
      "smoke_detectors",
      "alterations",
      "appliances",
      {
        t: "Balconies and Patios",
        x: "Nothing may be hung from, attached to, or displayed on any balcony, patio, railing or window, including flags of any kind, banners, signs, laundry or towels.",
        labels: [L("flag-ban", "83.67(4)", "void", "Nothing may be hung from, attached to, or displayed on any balcony, patio, railing or window, including flags of any kind, banners, signs, laundry or towels.", "bans flags of any kind")],
      },
      "hurricane",
      "packages",
      "keys",
      "grills",
      "sublet",
      {
        t: "Access",
        x: "Lessor may enter the Apartment to make repairs or inspect it upon 24 hours' notice between 8:00 a.m. and 6:00 p.m., and at any time in an emergency.",
      },
      {
        t: "Maintenance",
        x: "Lessor will keep the building's structure, roof and plumbing in good repair and comply with applicable housing codes. Lessee will keep the Apartment clean.",
      },
      "damage_reimbursement",
      "pets",
      "jury",
      {
        t: "End of Term",
        x: "Lessee will give Lessor written notice at least 30 days before the end of the term if Lessee will not renew.",
      },
      {
        t: "Abandoned Property",
        x: "After Lessee surrenders or abandons the Apartment, Lessor may remove and dispose of any personal property remaining in it, and Lessor will have no liability for that property.",
        labels: [L("property-removal", "83.67(5)", "void", "After Lessee surrenders or abandons the Apartment, Lessor may remove and dispose of any personal property remaining in it, and Lessor will have no liability for that property.", "waiver without the 83.67(5) legend")],
      },
      {
        t: "Attorney Fees",
        x: "The prevailing party in any action under this Lease may recover reasonable attorney fees.",
      },
      {
        t: "Notices",
        x: "Notices to Lessor: Harborside Pensacola LP, Management Office, 44 Palafox Wharf Road, Pensacola, Florida 32502.",
      },
      "radon",
      "severability",
      "governing_law",
    ],
    spanless: [L("deposit-disclosure", "83.49(2)", "notice", null, "bank and interest stated, but no 83.49(2)(d) statutory notice")],
  },
  {
    id: "hard-04-single-family-long",
    split: "dev",
    summary: "Long single-family house lease. Plumbing shift is allowed for a house; 12-hour entry notice, a gag on code complaints, and a water cutoff for unpaid utility bills are not.",
    terms: { O: "Landlord", R: "Tenant", P: "Home" },
    style: "caps",
    title: "SINGLE-FAMILY RESIDENTIAL LEASE",
    preamble:
      'Landlord: Marguerite Ashby ("Landlord"). Tenant: Corwin and Delia Pruitt ("Tenant"). Home: 4417 Sandpiper Lane, Sarasota, Florida 34231, a detached single-family house (the "Home"). Term: one year, from June 1, 2028 through May 31, 2029. Rent: $2,850.00 per month.',
    sections: [
      "rent_payment",
      "late_fee",
      {
        t: "Security Deposit",
        x: "Tenant has paid a security deposit of $2,850.00. Instead of holding the deposit in a separate account, Landlord has posted a surety bond with the Clerk of the Circuit Court of Sarasota County as provided by law. Tenant will receive simple interest on the deposit at 5 percent per year. If Landlord makes no claim, Landlord will return the deposit and interest within 15 days after the Lease ends; Landlord will send notice of any claim within 30 days after the Lease ends.\n\n[[NOTICE]]",
      },
      "use",
      "smoking",
      "insurance",
      {
        t: "Maintenance by Tenant",
        x: "Because the Home is a single-family residence, Landlord and Tenant agree in writing that Tenant will maintain and repair the plumbing system, including drains, fixtures and the water heater, at Tenant's expense. Landlord will maintain the roof, foundation and exterior walls. Tenant will mow the lawn and keep the yard free of debris.",
        near: "allowed in writing for a single-family home (83.51(1))",
      },
      "mold",
      "pests",
      "smoke_detectors",
      "alterations",
      "appliances",
      "ac_filters",
      "hurricane",
      {
        t: "Utilities Furnished by Landlord",
        x: "Water and sewer service for the Home are billed to Landlord. Tenant will reimburse Landlord for water and sewer charges within 10 days after receiving a copy of each bill. If Tenant does not reimburse those charges when due, Landlord may have water service to the Home discontinued until Tenant pays.",
        labels: [L("utility-shutoff", "83.67(1)", "violation", "If Tenant does not reimburse those charges when due, Landlord may have water service to the Home discontinued until Tenant pays.", "cutoff for nonpayment")],
      },
      {
        t: "Access",
        x: "Landlord may enter the Home to inspect it, make repairs, or show it to prospective tenants or buyers upon at least twelve (12) hours' notice to Tenant, between 9:00 a.m. and 6:00 p.m.",
        labels: [L("repair-entry-notice", "83.53(2)", "void", "Landlord may enter the Home to inspect it, make repairs, or show it to prospective tenants or buyers upon at least twelve (12) hours' notice to Tenant, between 9:00 a.m. and 6:00 p.m.", "12 < 24 hours")],
      },
      {
        t: "Reports to Authorities",
        x: "Tenant agrees to give Landlord written notice of any condition in the Home and thirty (30) days to correct it before reporting the condition to any governmental authority. If Tenant reports a condition to a governmental authority before that period ends, Landlord may terminate this Lease on thirty (30) days' notice.",
        labels: [L("retaliation", "83.64(1)", "violation", "If Tenant reports a condition to a governmental authority before that period ends, Landlord may terminate this Lease on thirty (30) days' notice.", "penalizes a complaint to a government agency")],
      },
      "sublet",
      "satellite",
      "pets",
      "guests",
      {
        t: "Default",
        x: "If rent is not paid when due, Landlord may deliver a written notice allowing Tenant three days, excluding Saturday, Sunday, and legal holidays, to pay the rent or deliver possession.",
      },
      {
        t: "Non-Renewal",
        x: "Either party who does not intend to renew this Lease must give the other written notice at least sixty (60) days before the end of the term.",
      },
      "jury",
      {
        t: "Attorney Fees",
        x: "The prevailing party in any lawsuit concerning this Lease may recover reasonable attorney fees and court costs.",
      },
      {
        t: "Notices",
        x: "Notices to Landlord: Marguerite Ashby, 1120 Bayfront Drive, Unit 6, Sarasota, Florida 34236.",
      },
      "radon",
      "lead",
      "move_out_cleaning",
      "severability",
      "entire_agreement",
      "governing_law",
    ],
  },
  {
    id: "hard-05-lakefront-community",
    split: "test",
    summary: "Large community lease. Two removal rights hide in the entry-purpose list, a rekey-on-default remedy hides in the default section, plus force majeure and a crime-only disclaimer.",
    terms: { O: "Management", R: "Resident", P: "Apartment Home" },
    style: "numbered",
    title: "LAKE MIRROR RESIDENCES\nAPARTMENT LEASE CONTRACT",
    preamble:
      'This Apartment Lease Contract is between Lake Mirror Residences Holdings, LLC, by its manager Trellis Property Services ("Management"), and Anika Sorensen ("Resident"). Management leases to Resident Apartment Home 2214 (the "Apartment Home") at Lake Mirror Residences, 1200 Lake Mirror Drive, Lakeland, Florida 33801, a 264-unit apartment community. The Lease term begins September 1, 2028 and ends August 31, 2029. Monthly rent is $1,615.00.',
    sections: [
      "rent_payment",
      "late_fee",
      "admin_fee",
      {
        t: "Security Deposit",
        x: "Resident's security deposit is $800.00. Management holds it in a separate non-interest-bearing account at Polk Lakes Bank, 220 S. Florida Avenue, Lakeland, Florida 33801. Resident does not earn interest on the deposit. Management will return the deposit within 15 days after move-out if it makes no claim, and will send notice of any claim within 30 days after move-out.\n\n[[NOTICE]]",
      },
      "occupants",
      "use",
      "guests",
      "conduct",
      "smoking",
      "parking",
      "trash",
      "pool",
      "insurance",
      "security_disclaimer",
      {
        t: "Crime",
        x: "Management is not liable for loss or injury caused by the criminal conduct of other persons, unless otherwise provided by law.",
        near: "label policy row 8: third-party crime only",
      },
      {
        t: "Entry",
        x: "Management may enter the Apartment Home after giving at least 24 hours' notice, between 7:30 a.m. and 8:00 p.m., for any of the following purposes: (a) making repairs or improvements; (b) showing the Apartment Home to prospective residents, appraisers or insurers; (c) pest control and filter changes; (d) removing perishable food from a refrigerator or freezer after a power outage; (e) removing any item that blocks a smoke detector or fire sprinkler; and (f) inspecting for compliance with this Lease. Management may also enter at any time in an emergency or to protect or preserve the premises.",
        labels: [
          L("property-removal", "83.67(5)", "violation", "(d) removing perishable food from a refrigerator or freezer after a power outage;", "label policy row 5: entry purpose that removes the tenant's things"),
          L("property-removal", "83.67(5)", "violation", "(e) removing any item that blocks a smoke detector or fire sprinkler;", "label policy row 5: hazards included"),
        ],
      },
      "mold",
      "pests",
      "smoke_detectors",
      "alterations",
      "appliances",
      "ac_filters",
      "damage_reimbursement",
      {
        t: "Repairs",
        x: "Management will comply with applicable building, housing and health codes and will keep the roof, windows, exterior walls, foundation, structural components and plumbing in reasonable repair.",
      },
      "lockout_service",
      "hurricane",
      "packages",
      "keys",
      "window_coverings",
      "pets",
      {
        t: "Default and Remedies",
        x: "If Resident fails to pay rent when due, Management may deliver a written notice demanding payment or possession within 3 days, excluding Saturday, Sunday, and legal holidays. If Resident's right of occupancy is terminated for default, Management may file an eviction action, and upon termination of Resident's right of occupancy for default Management may change or rekey the locks to the Apartment Home.",
        labels: [L("lockout", "83.67(2)", "violation", "upon termination of Resident's right of occupancy for default Management may change or rekey the locks to the Apartment Home.", "self-help lockout")],
      },
      {
        t: "Events Beyond Management's Control",
        x: "Management will not be in default of this Lease, and its obligations will be suspended, while performance is prevented by hurricane, flood, fire, pandemic, governmental order, labor dispute or other causes beyond Management's reasonable control.",
        labels: [L("liability-exculpation", "83.47(1)(b)", "review", "Management will not be in default of this Lease, and its obligations will be suspended, while performance is prevented by hurricane, flood, fire, pandemic, governmental order, labor dispute or other causes beyond Management's reasonable control.", "label policy row 6: force majeure")],
      },
      {
        t: "Ending the Lease",
        x: "If either party does not intend to renew, it must give written notice at least 60 days before the end of the Lease term.",
      },
      {
        t: "Personal Property After Move-Out",
        x: "Management will remove personal property from the Apartment Home only after Resident surrenders or abandons it or after a lawful eviction.\n\n[[LEGEND]]",
        near: "compliant removal, with the legend",
      },
      "jury",
      "sublet",
      "community_policies",
      "joint_liability",
      {
        t: "Attorney Fees",
        x: "In any legal action concerning this Lease, the prevailing party may recover reasonable attorney fees and court costs.",
      },
      {
        t: "Notices",
        x: "Notices to Management must be delivered to Trellis Property Services, Lake Mirror Residences Leasing Office, 1200 Lake Mirror Drive, Lakeland, Florida 33801.",
      },
      "email_consent",
      "radon",
      "severability",
      "entire_agreement",
      "governing_law",
    ],
  },
  {
    id: "hard-06-townhome-as-is",
    split: "test",
    summary: "Townhome community lease: 'as is' with no repair duty, 75-day move-out notice, a fee carve-out for any personal-injury claim, and a utility clause 'as permitted by law'.",
    terms: { O: "Landlord", R: "Tenant", P: "Townhome" },
    style: "articles",
    title: "TOWNHOME LEASE AGREEMENT\nWillow Run Townhomes",
    preamble:
      'Willow Run Rentals, LLC ("Landlord") leases to Bastian Kroll and Ngozi Kroll (together, "Tenant") Townhome 31 (the "Townhome") at Willow Run Townhomes, 3300 Willow Run Circle, Tallahassee, Florida 32308, a community of 48 attached townhomes owned and rented by Landlord. The term is twelve months, from January 1, 2029 through December 31, 2029. Monthly rent is $1,980.00.',
    sections: [
      "rent_payment",
      "late_fee",
      {
        t: "Security Deposit",
        x: "Tenant has paid a security deposit of $1,980.00, held in a separate non-interest-bearing account at Capital City Trust Bank, 301 S. Monroe Street, Tallahassee, Florida 32301. Tenant is not entitled to interest. Landlord will return the deposit within 15 days after the Lease ends if it makes no claim and will give written notice of any claim within 30 days after the Lease ends.\n\n[[NOTICE]]",
      },
      {
        t: "Condition and Repairs",
        x: "Tenant has inspected the Townhome and accepts it as is. Except as expressly provided in this Lease, Landlord will not be required to make any repairs to the Townhome.",
        labels: [L("maintenance-waiver", "83.51(1)", "void", "Except as expressly provided in this Lease, Landlord will not be required to make any repairs to the Townhome.", "multi-unit community; no repair duty is provided elsewhere")],
      },
      "occupants",
      "use",
      "conduct",
      "smoking",
      "parking",
      "trash",
      "pool",
      "insurance",
      "mold",
      "pests",
      "smoke_detectors",
      "alterations",
      "appliances",
      "ac_filters",
      "repair_requests",
      "damage_reimbursement",
      "hurricane",
      {
        t: "Utilities",
        x: "Tenant will place electric and internet service in Tenant's name. Water, sewer and trash service are furnished by Landlord and billed back monthly. Landlord may suspend utility services furnished by Landlord only as permitted by applicable law.",
        labels: [L("utility-shutoff", "83.67(1)", "review", "Landlord may suspend utility services furnished by Landlord only as permitted by applicable law.", "label policy row 7")],
      },
      {
        t: "Entry",
        x: "Landlord may enter the Townhome to make repairs or inspect it after giving at least 24 hours' notice, between 8:00 a.m. and 8:00 p.m., and at any time in an emergency.",
      },
      "sublet",
      "keys",
      "pets",
      "guests",
      {
        t: "Default",
        x: "If rent is not paid when due, Landlord may deliver a written demand for payment or possession giving Tenant 3 days, excluding Saturday, Sunday, and legal holidays.",
      },
      {
        t: "Notice to Vacate",
        x: "Tenant must give Landlord written notice of intent to vacate at least seventy-five (75) days before the end of the Lease term.",
        labels: [L("end-of-term-notice", "83.575(1)", "void", "Tenant must give Landlord written notice of intent to vacate at least seventy-five (75) days before the end of the Lease term.", "75 > 60 days")],
      },
      {
        t: "Attorney Fees",
        x: "The prevailing party in any action arising under this Lease may recover reasonable attorney fees; however, no attorney fees may be recovered by either party in any claim for personal injury.",
        labels: [L("attorney-fee-waiver", "83.48", "void", "however, no attorney fees may be recovered by either party in any claim for personal injury.", "label policy row 3: broader than 83.48's own carve-out")],
      },
      "jury",
      {
        t: "Notices",
        x: "Notices to Landlord: Willow Run Rentals, LLC, 3300 Willow Run Circle, Office, Tallahassee, Florida 32308.",
      },
      "radon",
      "move_out_cleaning",
      "severability",
      "entire_agreement",
      "governing_law",
    ],
  },
  {
    id: "hard-07-duplex-month-to-month",
    split: "test",
    summary: "Month-to-month duplex with addenda. Termination notice 'by the 15th' (about 15 days), a 35-day claim deadline in the deposit addendum, and a disclosure without the statutory notice.",
    terms: { O: "Owner", R: "Tenant", P: "Residence" },
    style: "caps",
    title: "MONTH-TO-MONTH RENTAL AGREEMENT",
    preamble:
      'Owner: Rafael and Lucia Montoya ("Owner"). Tenant: Petra Lindqvist ("Tenant"). Residence: the north unit of the duplex at 812 Tamarind Avenue, Fort Myers, Florida 33901 (the "Residence"). This is a month-to-month tenancy beginning February 1, 2029. Rent is $1,350.00 per month.',
    sections: [
      {
        t: "Ending the Tenancy",
        x: "Either party may end this month-to-month tenancy by written notice delivered on or before the fifteenth (15th) day of a month, effective at the end of that month.",
        labels: [L("periodic-termination-notice", "83.57(3)", "void", "Either party may end this month-to-month tenancy by written notice delivered on or before the fifteenth (15th) day of a month, effective at the end of that month.", "about 15 days, < 30")],
      },
      "rent_payment",
      "late_fee",
      {
        t: "Security Deposit",
        x: "Tenant has paid a security deposit of $1,350.00, which Owner holds in a separate non-interest-bearing account at Caloosa Community Bank, 2040 First Street, Fort Myers, Florida 33901. Tenant will not receive interest on the deposit. See the Deposit Addendum for return of the deposit.",
      },
      "use",
      "smoking",
      "insurance",
      {
        t: "Repairs",
        x: "Because the Residence is one half of a duplex, Owner and Tenant agree in writing that Tenant will make and pay for repairs to the plumbing fixtures and drains inside the Residence. Owner will maintain the roof, foundation, exterior walls and the plumbing lines outside the Residence.",
        near: "allowed in writing for a duplex (83.51(1))",
      },
      "mold",
      "pests",
      "smoke_detectors",
      "alterations",
      "ac_filters",
      "hurricane",
      {
        t: "Entry",
        x: "Owner will give Tenant at least 24 hours' notice before entering to make repairs and will enter only between 8:00 a.m. and 8:00 p.m., except in an emergency.",
      },
      {
        t: "Locks",
        x: "Tenant may not add or change locks without Owner's consent and must give Owner a key to any approved lock.",
        near: "the tenant can't change locks: not a lockout",
      },
      "pets",
      "guests",
      {
        t: "Unpaid Rent",
        x: "If rent is not paid when due, Owner may give Tenant a written notice to pay or vacate within 3 days, excluding Saturday, Sunday, and legal holidays.",
      },
      {
        t: "Attorney Fees",
        x: "The prevailing party in any action concerning this Agreement may recover reasonable attorney fees.",
      },
      "radon",
      "governing_law",
      {
        t: "Deposit Addendum",
        x: "1. If Owner makes no claim on the deposit, Owner will return it within 15 days after Tenant vacates. 2. If Owner intends to impose a claim on the deposit, Owner will mail written notice of the claim within thirty-five (35) days after Tenant vacates. 3. Tenant must provide a forwarding address in writing.",
        labels: [L("deposit-claim-deadline", "83.49(3)(a)", "void", "Owner will mail written notice of the claim within thirty-five (35) days after Tenant vacates.", "35 > 30 days")],
      },
      {
        t: "Owner's Address for Notices",
        x: "Rafael Montoya, 15 Edison Avenue, Fort Myers, Florida 33901.",
      },
    ],
    spanless: [L("deposit-disclosure", "83.49(2)", "notice", null, "bank and interest stated, but no 83.49(2)(d) statutory notice")],
  },
  {
    id: "hard-08-scanned-condo",
    split: "test",
    summary: "Scanned condo lease. Two-business-day pay-or-quit, repair entry from 7:00 a.m., and a release from all claims buried in an indemnity paragraph; the U.S. flag is expressly allowed.",
    terms: { O: "Unit Owner", R: "Renter", P: "Unit" },
    style: "scan",
    title: "CONDOMINIUM LEASE - BAYVIEW TERRACE",
    preamble:
      'Unit Owner: Whitcombe Holdings, LLC ("Unit Owner"). Renter: Jonah Feldstein ("Renter"). Unit: Unit 806, Bayview Terrace Condominium, 700 Bayshore Drive, Fort Lauderdale, Florida 33304, a 140-unit condominium building (the "Unit"). Term: April 1, 2029 to March 31, 2030. Rent: $2,950.00 per month.',
    sections: [
      "rent_payment",
      "late_fee",
      {
        t: "Security Deposit",
        x: "Renter has paid a security deposit of $2,950.00, which Unit Owner holds in a separate non-interest-bearing account at New River Savings Bank, 100 SE 3rd Avenue, Fort Lauderdale, Florida 33301. Renter is not entitled to interest. The deposit will be returned within 15 days after the Lease ends if no claim is made, and notice of any claim will be sent within 30 days after the Lease ends.\n\n[[NOTICE]]",
      },
      {
        t: "Association",
        x: "Renter must comply with the Declaration of Condominium and the rules of the Bayview Terrace Condominium Association, including its move-in fee, elevator reservation and two-vehicle limit. The Association must approve this Lease before occupancy.",
        oos: "condominium association rules",
      },
      {
        t: "Rent Default",
        x: "If rent is not paid when due, Unit Owner may terminate this Lease after delivering a written demand and allowing Renter two (2) business days to pay the rent or deliver possession of the Unit.",
        labels: [L("nonpayment-notice", "83.56(3)", "void", "allowing Renter two (2) business days to pay the rent or deliver possession of the Unit.", "2 < 3 days")],
      },
      "occupants",
      "use",
      "conduct",
      "smoking",
      "insurance",
      {
        t: "Indemnity and Release",
        x: "Renter will indemnify Unit Owner against claims arising from the acts of Renter, occupants and guests. Renter releases Unit Owner and the Association from all claims for injury, loss or damage to persons or property in or about the Unit or the condominium, from any cause whatsoever.",
        labels: [L("liability-exculpation", "83.47(1)(b)", "void", "Renter releases Unit Owner and the Association from all claims for injury, loss or damage to persons or property in or about the Unit or the condominium, from any cause whatsoever.", "broad release")],
      },
      "mold",
      "pests",
      "smoke_detectors",
      "alterations",
      "appliances",
      "ac_filters",
      "hurricane",
      {
        t: "Entry for Repairs",
        x: "Unit Owner or its contractors may enter the Unit to make repairs between 7:00 a.m. and 7:00 p.m., on not less than 24 hours' notice, and at any time in an emergency.",
        labels: [L("repair-entry-hours", "83.53(2)", "void", "Unit Owner or its contractors may enter the Unit to make repairs between 7:00 a.m. and 7:00 p.m., on not less than 24 hours' notice, and at any time in an emergency.", "starts before 7:30 a.m.")],
      },
      {
        t: "Maintenance",
        x: "Unit Owner will keep the Unit's plumbing, fixtures and appliances in good repair and comply with applicable housing codes; the Association maintains the building structure and roof.",
      },
      {
        t: "Flag",
        x: "Notwithstanding any Association rule, Renter may display one portable, removable United States flag, not larger than 4 1/2 feet by 6 feet, in a respectful manner.",
        near: "the statutory flag right, expressly kept",
      },
      "sublet",
      "pets",
      "guests",
      {
        t: "Non-Renewal",
        x: "The party not renewing must give written notice at least 45 days before the end of the term.",
      },
      {
        t: "Attorney Fees",
        x: "The prevailing party in any action on this Lease may recover reasonable attorney fees and costs.",
      },
      {
        t: "Notices",
        x: "Notices to Unit Owner: Whitcombe Holdings, LLC, 2600 E. Las Olas Boulevard, Suite 3, Fort Lauderdale, Florida 33301.",
      },
      "jury",
      "radon",
      "severability",
      "governing_law",
    ],
  },
];
