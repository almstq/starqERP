import { UserSession } from './auth';

export interface AllowlistPerson {
  person_id: string;
  name: string;
  email: string;
  default_seat: string;
  seats: string[];
  entities: string[];
  status: string;
}

export const ALLOWLIST_PEOPLE: AllowlistPerson[] = [
  {
    person_id: 'ali',
    name: 'Ali Mushthaq Ibrahim',
    email: 'a.musthaq@gmail.com',
    default_seat: 'director',
    seats: [
      'owner',
      'managing_director',
      'director',
      'financial_controller',
      'quartermaster',
      'receiver',
      'payer',
      'counter',
      'technician',
      'qc_signer',
      'stores',
      'ledger_poster',
    ],
    entities: ['starq', 'club-ignition', 'group', 'CI'],
    status: 'active',
  },
  {
    person_id: 'starq_sys_owner',
    name: 'Starq Systems Owner',
    email: 'starq.sys@gmail.com',
    default_seat: 'owner',
    seats: ['owner'],
    entities: ['CI'],
    status: 'active',
  },
  {
    person_id: 'nashid',
    name: 'Hussain Nashid',
    email: 'nashidh3566@gmail.com',
    default_seat: 'managing_director',
    seats: ['managing_director', 'receiver', 'qc_signer', 'technician', 'counter'],
    entities: ['club-ignition', 'CI'],
    status: 'active',
  },
  {
    person_id: 'naleez',
    name: 'Naleez',
    email: 'naleeeez@gmail.com',
    default_seat: 'quartermaster',
    seats: ['quartermaster', 'stores'],
    entities: ['club-ignition', 'CI'],
    status: 'active',
  },
];

export function lookupAllowlistEmail(email: string): UserSession | null {
  const normalized = email.trim().toLowerCase();
  const person = ALLOWLIST_PEOPLE.find(
    (p) => p.email.toLowerCase() === normalized && p.status === 'active',
  );
  if (!person) return null;

  return {
    person_id: person.person_id,
    name: person.name,
    seats: person.seats,
    acting_as: person.default_seat,
    seat_label: person.default_seat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    csrf: crypto.randomUUID(),
    allowed_entities: person.entities,
  };
}
