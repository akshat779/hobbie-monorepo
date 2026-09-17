import { InterestId, InterestIdSchema, UserSummary } from '@hobbie/shared';

/**
 * Discovery feed item: the shared `ActivityPublic` domain contract narrowed to
 * guarantee the public coordinate and computed distance used by the radar.
 */
export type { DiscoveryActivity } from '@hobbie/shared';

export type TtlUrgency = 'fresh' | 'moderate' | 'expiring' | 'expired';

export interface TtlStatus {
  minutesLeft: number;
  formattedTtl: string;
  urgency: TtlUrgency;
}

/**
 * Host identity projection for the discovery radar. Derived from the shared
 * `UserSummarySchema` contract rather than re-declaring the same fields.
 */
export type HostProfile = Pick<
  UserSummary,
  'id' | 'name' | 'trustScore' | 'isVerified' | 'avatarUrl'
>;

export type GenderFilterOption = 'all' | 'men_only' | 'women_only' | 'coed';
export type AgeGroupOption = 'all' | '18_24' | '25_34' | '35_plus';

export interface DiscoveryFiltersState {
  radiusKm: number;
  gender: GenderFilterOption;
  ageGroup: AgeGroupOption;
}

/**
 * Client-only demographic filter inputs. These are applied in-memory over the
 * fetched feed and are deliberately kept out of the network query contract.
 */
export interface DiscoveryDemographicFilters {
  gender?: GenderFilterOption;
  ageGroup?: AgeGroupOption;
}

/**
 * Network query parameters for the discovery feed.
 *
 * Mirrors the shared `DiscoveryQuerySchema` field-for-field: coordinates are
 * `latitude` / `longitude`, and the interest taxonomy is the `interestIds`
 * array rather than a disjointed single `category` string.
 */
export interface DiscoveryQueryParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  interestIds?: InterestId[];
  enabled?: boolean;
}

/**
 * Converts a single-select category chip into the taxonomy array required by the
 * query contract. Unknown keys are rejected by the shared schema rather than
 * blind-cast into `InterestId`.
 */
export function selectedCategoryToInterestIds(category: string): InterestId[] | undefined {
  if (category === 'all') return undefined;
  const parsed = InterestIdSchema.safeParse(category);
  return parsed.success ? [parsed.data] : undefined;
}
