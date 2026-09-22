import { vi } from 'vitest';
import { z } from 'zod';
import {
  PhoneAuthSchema,
  DiscoveryQuerySchema,
  BIO_MAX_LENGTH,
  LANGUAGE_CODES,
  MAX_PREFERRED_LANGUAGES,
} from '@hobbie/shared';

export const VALID_UUIDS = {
  alex: '00000000-0000-0000-0000-000000000001',
  sam: '00000000-0000-0000-0000-000000000002',
  activity1: '11111111-1111-1111-1111-111111111111',
  activity2: '22222222-2222-2222-2222-222222222222',
  request1: '33333333-3333-3333-3333-333333333333',
  request2: '44444444-4444-4444-4444-444444444444',
};

const UuidSchema = z.string().uuid();

/**
 * Mirrors the checklist-level Postgres CHECK constraints on public.profiles for
 * the bio/languages columns added in 20260922000001.
 */
function validateProfileColumnConstraints(
  payload: any
): { code: string; message: string } | null {
  if (payload?.bio !== undefined && payload.bio !== null) {
    if (typeof payload.bio !== 'string' || payload.bio.length > BIO_MAX_LENGTH) {
      return {
        code: '23514',
        message:
          'new row for relation "profiles" violates check constraint "check_bio_length"',
      };
    }
  }

  if (payload?.preferred_languages !== undefined) {
    const languages = payload.preferred_languages;
    const isValid =
      Array.isArray(languages) &&
      languages.length <= MAX_PREFERRED_LANGUAGES &&
      languages.every((code: unknown) =>
        (LANGUAGE_CODES as readonly string[]).includes(code as string)
      );
    if (!isValid) {
      return {
        code: '23514',
        message:
          'new row for relation "profiles" violates check constraint "check_preferred_languages"',
      };
    }
  }

  return null;
}

export interface ContractMockOptions {
  rpcOverrides?: Record<string, (args: any) => any>;
  tableData?: Record<string, any>;
}

/**
 * Creates a schema-validating Supabase mock client.
 * Rejects invalid payloads according to PostgreSQL constraints and @hobbie/shared schemas.
 */
export function createContractMockSupabase(options: ContractMockOptions = {}) {
  const mockRpc = vi.fn(async (fn: string, args: any) => {
    if (options.rpcOverrides && options.rpcOverrides[fn]) {
      return options.rpcOverrides[fn](args);
    }

    if (fn === 'get_nearby_activities') {
      const parsed = DiscoveryQuerySchema.safeParse({
        latitude: args?.user_lat,
        longitude: args?.user_lng,
        radiusKm: args?.radius_km,
      });

      if (!parsed.success) {
        return {
          data: null,
          error: {
            code: 'XX000',
            message: `PostGIS query error: coordinates or radius out of bounds: ${JSON.stringify(
              parsed.error.flatten()
            )}`,
          },
        };
      }

      return {
        data: [
          {
            id: VALID_UUIDS.activity1,
            host_id: VALID_UUIDS.alex,
            interest_id: 'football',
            title: 'Turf Football 5v5',
            description: 'Friendly match',
            tier: 'physical',
            lat: 12.9716,
            lng: 77.5946,
            venue_name: 'Turf Arena',
            filter_gender: 'any',
            filter_age_min: null,
            filter_age_max: null,
            expires_at: new Date(Date.now() + 7200000).toISOString(),
            max_participants: 10,
            current_participants_count: 6,
            distance_meters: 650,
            created_at: new Date().toISOString(),
            status: 'open',
            image_urls: null,
          },
          {
            id: VALID_UUIDS.activity2,
            host_id: VALID_UUIDS.sam,
            interest_id: 'badminton',
            title: 'Badminton Doubles',
            description: 'Need 2 more',
            tier: 'physical',
            lat: 12.978,
            lng: 77.599,
            venue_name: 'Smash Zone',
            filter_gender: 'any',
            filter_age_min: null,
            filter_age_max: null,
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            max_participants: 4,
            current_participants_count: 2,
            distance_meters: 1200,
            created_at: new Date().toISOString(),
            status: 'open',
            image_urls: null,
          },
        ],
        error: null,
      };
    }

    if (fn === 'request_to_join_activity') {
      const validActivityId = UuidSchema.safeParse(args?.p_activity_id);
      if (!validActivityId.success) {
        return {
          data: null,
          error: {
            code: '22P02',
            message: `invalid input syntax for type uuid: "${args?.p_activity_id}"`,
          },
        };
      }

      const validUserId = UuidSchema.safeParse(args?.p_user_id);
      if (!validUserId.success) {
        return {
          data: null,
          error: {
            code: '22P02',
            message: `invalid input syntax for type uuid: "${args?.p_user_id}"`,
          },
        };
      }

      const message = args?.p_message || '';
      if (typeof message === 'string' && message.length > 150) {
        return {
          data: null,
          error: {
            code: '22001',
            message: 'value too long for type character varying(150)',
          },
        };
      }

      return {
        data: {
          id: VALID_UUIDS.request1,
          activity_id: args.p_activity_id,
          user_id: args.p_user_id,
          message: args.p_message || '',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
        error: null,
      };
    }

    if (fn === 'accept_join_request_tx') {
      const validReqId = UuidSchema.safeParse(args?.p_request_id);
      if (!validReqId.success) {
        return {
          data: null,
          error: {
            code: '22P02',
            message: `invalid input syntax for type uuid: "${args?.p_request_id}"`,
          },
        };
      }

      const validHostId = UuidSchema.safeParse(args?.p_host_id);
      if (!validHostId.success) {
        return {
          data: null,
          error: {
            code: '22P02',
            message: `invalid input syntax for type uuid: "${args?.p_host_id}"`,
          },
        };
      }

      return {
        data: {
          success: true,
          activity_id: VALID_UUIDS.activity1,
          request_id: args.p_request_id,
          user_id: VALID_UUIDS.sam,
          current_participants_count: 4,
          status: 'open',
        },
        error: null,
      };
    }

    if (fn === 'decline_join_request') {
      const validReqId = UuidSchema.safeParse(args?.p_request_id);
      if (!validReqId.success) {
        return {
          data: null,
          error: {
            code: '22P02',
            message: `invalid input syntax for type uuid: "${args?.p_request_id}"`,
          },
        };
      }

      const validHostId = UuidSchema.safeParse(args?.p_host_id);
      if (!validHostId.success) {
        return {
          data: null,
          error: {
            code: '22P02',
            message: `invalid input syntax for type uuid: "${args?.p_host_id}"`,
          },
        };
      }

      return {
        data: {
          success: true,
          activity_id: VALID_UUIDS.activity1,
          request_id: args.p_request_id,
          status: 'declined',
        },
        error: null,
      };
    }

    if (fn === 'leave_activity') {
      const validActivityId = UuidSchema.safeParse(args?.p_activity_id);
      if (!validActivityId.success) {
        return {
          data: null,
          error: {
            code: '22P02',
            message: `invalid input syntax for type uuid: "${args?.p_activity_id}"`,
          },
        };
      }

      const validUserId = UuidSchema.safeParse(args?.p_user_id);
      if (!validUserId.success) {
        return {
          data: null,
          error: {
            code: '22P02',
            message: `invalid input syntax for type uuid: "${args?.p_user_id}"`,
          },
        };
      }

      return {
        data: {
          success: true,
          activity_id: args.p_activity_id,
          user_id: args.p_user_id,
          new_host_id: VALID_UUIDS.alex,
          current_participants_count: 5,
          status: 'open',
        },
        error: null,
      };
    }

    return {
      data: null,
      error: { code: '42883', message: `function ${fn} does not exist` },
    };
  });

  const builders: Record<string, any> = {};

  const mockFrom = vi.fn((tableName: string) => {
    if (builders[tableName]) {
      return builders[tableName];
    }

    let currentSelect: string | null = null;
    let currentInFilter: { column: string; values: any[] } | null = null;
    let eqFilters: Record<string, any> = {};

    const builder: any = {
      then: (onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => {
        let result: any = { data: [], error: null };
        if (tableName === 'profiles') {
          result = {
            data: [
              {
                id: 'host-1',
                name: 'Alex Rivera',
                trust_score: 4.95,
                is_verified: true,
                avatar_url: null,
              },
              {
                id: 'host-2',
                name: 'Sam Chen',
                trust_score: 4.88,
                is_verified: true,
                avatar_url: null,
              },
              {
                id: VALID_UUIDS.alex,
                name: 'Alex Rivera',
                trust_score: 4.95,
                is_verified: true,
                avatar_url: null,
              },
              {
                id: VALID_UUIDS.sam,
                name: 'Sam Chen',
                trust_score: 4.88,
                is_verified: true,
                avatar_url: null,
              },
            ],
            error: null,
          };
        }
        return Promise.resolve(result).then(onfulfilled, onrejected);
      },
      select: vi.fn((sel?: string, opts?: any) => {
        currentSelect = sel || '*';
        return builder;
      }),
      eq: vi.fn((col: string, val: any) => {
        eqFilters[col] = val;
        return builder;
      }),
      in: vi.fn((col: string, values: any[]) => {
        currentInFilter = { column: col, values };
        return builder;
      }),
      order: vi.fn(() => builder),
      insert: vi.fn((payload: any) => {
        if (tableName === 'profiles') {
          const phoneValidation = PhoneAuthSchema.safeParse({ phone: payload?.phone });
          if (!phoneValidation.success) {
            return {
              select: () => ({
                single: async () => ({
                  data: null,
                  error: {
                    code: '23514',
                    message: 'new row for relation "profiles" violates check constraint "check_e164_phone"',
                  },
                }),
              }),
            };
          }

          if (payload.birth_date) {
            const birth = new Date(payload.birth_date);
            const ageDate = new Date(Date.now() - birth.getTime());
            const age = Math.abs(ageDate.getUTCFullYear() - 1970);
            if (age < 18) {
              return {
                select: () => ({
                  single: async () => ({
                    data: null,
                    error: {
                      code: '23514',
                      message: 'new row for relation "profiles" violates check constraint "check_age_minimum"',
                    },
                  }),
                }),
              };
            }
          }

          const columnError = validateProfileColumnConstraints(payload);
          if (columnError) {
            return {
              select: () => ({
                single: async () => ({ data: null, error: columnError }),
              }),
            };
          }
        }

        if (tableName === 'join_requests') {
          const actValid = UuidSchema.safeParse(payload?.activity_id);
          const usrValid = UuidSchema.safeParse(payload?.user_id);
          if (!actValid.success || !usrValid.success) {
            return {
              select: () => ({
                single: async () => ({
                  data: null,
                  error: {
                    code: '22P02',
                    message: 'invalid input syntax for type uuid',
                  },
                }),
              }),
            };
          }
        }

        const returnedData = {
          id: payload.id || VALID_UUIDS.request1,
          ...payload,
          created_at: new Date().toISOString(),
        };

        return {
          select: () => ({
            single: async () => ({
              data: returnedData,
              error: null,
            }),
          }),
        };
      }),
      update: vi.fn((payload: any) => {
        let validationError: { code: string; message: string } | null = null;

        if (tableName === 'profiles') {
          if (payload?.phone !== undefined) {
            const phoneValidation = PhoneAuthSchema.safeParse({ phone: payload.phone });
            if (!phoneValidation.success) {
              validationError = {
                code: '23514',
                message: 'new row for relation "profiles" violates check constraint "check_e164_phone"',
              };
            }
          }

          if (!validationError && payload?.birth_date) {
            const birth = new Date(payload.birth_date);
            const ageDate = new Date(Date.now() - birth.getTime());
            const age = Math.abs(ageDate.getUTCFullYear() - 1970);
            if (age < 18) {
              validationError = {
                code: '23514',
                message: 'new row for relation "profiles" violates check constraint "check_age_minimum"',
              };
            }
          }

          if (!validationError) {
            validationError = validateProfileColumnConstraints(payload);
          }
        }

        const chain = {
          eq: vi.fn(() => chain),
          select: vi.fn(() => ({
            single: async () => {
              if (validationError) {
                return { data: null, error: validationError };
              }
              return {
                data: {
                  id: eqFilters['id'] ?? VALID_UUIDS.alex,
                  ...payload,
                  updated_at: new Date().toISOString(),
                },
                error: null,
              };
            },
          })),
        };
        return chain;
      }),
      upsert: vi.fn((payload: any) => {
        if (tableName === 'profiles') {
          const phoneValidation = PhoneAuthSchema.safeParse({ phone: payload?.phone });
          if (!phoneValidation.success) {
            return {
              select: () => ({
                single: async () => ({
                  data: null,
                  error: {
                    code: '23514',
                    message: 'new row for relation "profiles" violates check constraint "check_e164_phone"',
                  },
                }),
              }),
            };
          }

          if (payload.birth_date) {
            const birth = new Date(payload.birth_date);
            const ageDate = new Date(Date.now() - birth.getTime());
            const age = Math.abs(ageDate.getUTCFullYear() - 1970);
            if (age < 18) {
              return {
                select: () => ({
                  single: async () => ({
                    data: null,
                    error: {
                      code: '23514',
                      message: 'new row for relation "profiles" violates check constraint "check_age_minimum"',
                    },
                  }),
                }),
              };
            }
          }

          const columnError = validateProfileColumnConstraints(payload);
          if (columnError) {
            return {
              select: () => ({
                single: async () => ({ data: null, error: columnError }),
              }),
            };
          }
        }

        const returnedData = {
          id: payload.id || VALID_UUIDS.alex,
          ...payload,
          updated_at: new Date().toISOString(),
        };

        return {
          select: () => ({
            single: async () => ({
              data: returnedData,
              error: null,
            }),
          }),
        };
      }),
      single: vi.fn(async () => {
        if (tableName === 'profiles') {
          return {
            data: {
              id: VALID_UUIDS.alex,
              phone: '+919876543210',
              name: 'Alex Rivera',
              birth_date: '1998-05-15',
              gender: 'male',
              interests: ['football', 'badminton'],
              trust_score: 4.95,
              is_verified: true,
              interaction_count: 5,
              avatar_url: null,
              bio: null,
              preferred_languages: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }),
      maybeSingle: vi.fn(async () => {
        if (tableName === 'profiles') {
          return {
            data: {
              id: VALID_UUIDS.alex,
              phone: '+919876543210',
              name: 'Alex Rivera',
              birth_date: '1998-05-15',
              gender: 'male',
              interests: ['football', 'badminton'],
              trust_score: 4.95,
              is_verified: true,
              interaction_count: 5,
              avatar_url: null,
              bio: null,
              preferred_languages: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }),
    };

    builders[tableName] = builder;
    return builder;
  });

  return {
    rpc: mockRpc,
    from: mockFrom,
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'test-access-token' } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: VALID_UUIDS.alex } }, error: null })),
      setSession: vi.fn(),
      signOut: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({
        unsubscribe: vi.fn(),
      }),
    })),
    getChannels: vi.fn(() => []),
    removeChannel: vi.fn(async () => 'ok'),
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(async (path: string, file: ArrayBuffer, opts?: any) => {
          if (bucket !== 'avatars') {
            return { data: null, error: { message: `Bucket not found: ${bucket}` } };
          }
          const owner = path.split('/')[0];
          if (!owner || !/[0-9a-f-]{36}/.test(owner)) {
            return {
              data: null,
              error: {
                message:
                  'new row for relation "objects" violates row-level security policy for table "objects"',
              },
            };
          }
          if (!file || file.byteLength === 0) {
            return { data: null, error: { message: 'The file is empty' } };
          }
          const allowed = ['image/jpeg', 'image/png', 'image/webp'];
          if (opts?.contentType && !allowed.includes(opts.contentType)) {
            return { data: null, error: { message: 'mime type not supported' } };
          }
          return { data: { path, id: 'mock-object-id' }, error: null };
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: {
            publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        })),
      })),
    },
  };
}
