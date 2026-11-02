// The sample leases on the home page. All fictional, taken from the golden set, so
// each replay can be compared with labels a person approved.
export interface Sample {
  id: string;
  title: string;
  blurb: string;
  /** Lease file the replay was recorded from. */
  source: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "clean",
    title: "A clean apartment lease",
    blurb: "Every clause sits close to a line the statute draws, and none crosses it.",
    source: "evals/leases/01-clean-apartment.txt",
  },
  {
    id: "deposit",
    title: "Deposit terms that break the rules",
    blurb: "The deposit goes into the operating account, refunds take too long, and late rent means new locks.",
    source: "evals/leases/02-landlord-friendly-apartment.txt",
  },
  {
    id: "notice",
    title: "A 3-day notice that counts weekends",
    blurb: "A scanned lease where the pay-or-leave notice counts Saturdays and Sundays, plus a ban on flags.",
    source: "evals/hard/hard-03-scanned-midrise.txt",
  },
  {
    id: "as-is",
    title: "An “as is” lease with no repair duty",
    blurb: "The landlord promises no repairs, the refund deadline hides in a later section, and holdover notice is too short.",
    source: "evals/hard/hard-02-small-building-as-is.txt",
  },
  {
    id: "mixed",
    title: "A long lease with problems in the fine print",
    blurb: "Sixteen thousand characters of community rules, with removal and shutoff rights tucked into a list of entry purposes.",
    source: "evals/hard/hard-01-garden-community.txt",
  },
  {
    id: "commercial",
    title: "A commercial office lease",
    blurb: "Florida's residential statute doesn't apply, so LeaseTrace says so and stops.",
    source: "evals/leases/08-commercial-office.txt",
  },
];
