/**
 * SERP-328 E2E session fixtures.
 *
 * These are the "simulated multi-tenant login" personas the SERP-328
 * acceptance asks the harness to exercise. All identifiers are synthetic
 * (repo convention: synthetic 8-4-4-4-12 UUIDs, never production rows).
 */
import type { UserSession } from '../../src/services/auth';

const PREFIX = 'e2e00000';

export function orgAAdminSession(): UserSession {
  return {
    person_id: 'person-0e2e-orga-admin-01',
    person_uuid: `${PREFIX}-0000-4000-8000-000000000001`,
    name: 'E2E Org A Admin',
    email: 'e2e-admin-a@starq.mv',
    seats: ['owner'],
    acting_as: 'owner',
    seat_label: 'Owner',
    csrf: 'e2e-csrf-token-a',
    allowed_entities: ['starq-tech', 'club-ignition'],
    organisations: [
      {
        id: 'tenant-starq',
        slug: 'starq-tech',
        name: 'Starq Technologies Pvt Ltd',
        books: [
          { id: 'book-starq-tech', code: 'STQ', name: 'Starq Technologies', is_default: true, archetype_id: 'general_business' },
          { id: 'book-starq-dyn', code: 'DYN', name: 'Starq Dynamics', is_default: false, archetype_id: 'software_services' },
        ],
      },
      {
        id: 'tenant-ignition',
        slug: 'club-ignition',
        name: 'Club Ignition Pvt Ltd',
        books: [
          { id: 'book-ignition-ink', code: 'INK', name: 'Ignition Ink', is_default: true, archetype_id: 'garage_service' },
        ],
      },
    ],
    current_organisation_id: 'tenant-starq',
    current_book_id: 'book-starq-tech',
    platform_entitlement: {
      operator_role: 'operator',
      mfa_verified: true,
    },
  };
}

export function orgBAdminSession(): UserSession {
  return {
    person_id: 'person-0e2e-orgb-admin-01',
    person_uuid: `${PREFIX}-0000-4000-8000-000000000002`,
    name: 'E2E Org B Admin',
    email: 'e2e-admin-b@ignition.mv',
    seats: ['owner'],
    acting_as: 'owner',
    seat_label: 'Owner',
    csrf: 'e2e-csrf-token-b',
    allowed_entities: ['club-ignition'],
    organisations: [
      {
        id: 'tenant-ignition',
        slug: 'club-ignition',
        name: 'Club Ignition Pvt Ltd',
        books: [
          { id: 'book-ignition-ink', code: 'INK', name: 'Ignition Ink', is_default: true, archetype_id: 'garage_service' },
        ],
      },
    ],
    current_organisation_id: 'tenant-ignition',
    current_book_id: 'book-ignition-ink',
    platform_entitlement: null,
  };
}

export function platformOperatorSession(): UserSession {
  return {
    person_id: 'person-0e2e-operator-01',
    person_uuid: `${PREFIX}-0000-4000-8000-000000000003`,
    name: 'E2E Platform Operator',
    email: 'e2e-operator@starq.mv',
    seats: ['starq_sys_operator'],
    acting_as: 'starq_sys_operator',
    seat_label: 'Platform Operator',
    csrf: 'e2e-csrf-token-ops',
    allowed_entities: ['starq-tech'],
    organisations: [],
    current_organisation_id: null,
    current_book_id: null,
    platform_entitlement: {
      operator_role: 'operator',
      mfa_verified: true,
    },
  };
}