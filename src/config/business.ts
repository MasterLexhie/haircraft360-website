/**
 * Haircraft360 business facts.
 *
 * SOURCE: haircraft360-business-profile.md (prepared 10 Nov 2026), which took
 * these values from a public Google Places listing mirror (record fetched
 * 14 Sep 2026). NONE of these values has been confirmed by the owner yet.
 * Flip a `verified` flag to true only after the owner confirms that value.
 */

export interface VerifiableFact<T> {
  value: T;
  verified: boolean;
  source: string;
}

const LISTING_SOURCE = "Public Google Places listing mirror (ranked.ng), record fetched 14 Sep 2026";

export const business = {
  brandName: "Haircraft360",
  /** Longer listing title — keep for search metadata only if the owner approves. */
  listingTitle: {
    value: "HAIRCRAFT360 LOCTICIAN IN IBADAN",
    verified: false,
    source: LISTING_SOURCE,
  } satisfies VerifiableFact<string>,
  category: {
    value: "Loctician / hair salon",
    verified: false,
    source: LISTING_SOURCE,
  } satisfies VerifiableFact<string>,
  address: {
    value: {
      line1: "N5, 64B Basorun Road",
      landmark: "Beside OLAREM filling station",
      city: "Ibadan 200258",
      state: "Oyo State, Nigeria",
    },
    verified: false,
    source: LISTING_SOURCE,
  } satisfies VerifiableFact<{ line1: string; landmark: string; city: string; state: string }>,
  phone: {
    value: { display: "0805 845 5564", e164: "+2348058455564" },
    verified: false,
    source: LISTING_SOURCE,
  } satisfies VerifiableFact<{ display: string; e164: string }>,
  /** The listed hours seed the sample opening hours in Settings. */
  listedHoursSummary: {
    value: "Monday–Saturday, 8:00 am–9:00 pm · Sunday closed",
    verified: false,
    source: LISTING_SOURCE,
  } satisfies VerifiableFact<string>,
  /** Search link from the business profile. Not a verified map pin. */
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Haircraft360+Loctician+Ibadan",
  ratingSnapshot: {
    value: { rating: 5.0, count: 50, platform: "Google", fetched: "14 September 2026" },
    verified: false,
    /** Must stay false until the owner approves showing it. The public site hides it while false. */
    approvedForDisplay: false,
    source: LISTING_SOURCE,
  },
  /** No salon-written description, social links, or policies were supplied. */
  description: null as string | null,
  socialLinks: [] as { label: string; href: string }[],
  policies: [] as { label: string; href: string }[],
} as const;

/**
 * Preview/prototype mode shows verification notices across the site.
 * Set NEXT_PUBLIC_PREVIEW_MODE=false only once every fact above is owner-verified.
 */
export const PREVIEW_MODE = process.env.NEXT_PUBLIC_PREVIEW_MODE !== "false";

export const fullAddress = [
  business.address.value.line1,
  business.address.value.landmark,
  business.address.value.city,
  business.address.value.state,
].join(", ");
