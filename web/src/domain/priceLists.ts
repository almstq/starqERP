/**
 * SERP-314 — tiered customer price lists (Retail, Wholesale, Resort, VIP).
 *
 * SCOPE OF THIS FILE. Domain logic for the Gap 2 registry-backed PriceList
 * shape, validation, customer binding options, and item-price resolution. The
 * admin CRUD surface is implemented by PriceListsTab/ERPContext and the
 * tenant-scoped PRICE_LIST API. Gap 3 invoice auto-resolution and invoice-line
 * identity changes remain intentionally out of scope.
 *
 * TWO WAYS TO SET A PRICE, IN PRIORITY ORDER.
 *   1. ITEM OVERRIDE — an explicit price for one specific item on this list.
 *      Wins whenever present, because "this exact item costs this exact
 *      amount to this tier" is a decision someone made on purpose and a
 *      blanket discount must never quietly override it.
 *   2. DISCOUNT PERCENT — a flat percentage off the item's base sellingPrice,
 *      applied when no override exists. This is what makes "Trade Discount
 *      15%" a one-field price list instead of requiring an override row for
 *      every item in inventory.
 *
 * NO CUSTOMER, NO PRICE LIST -> BASE PRICE. A customer not bound to any
 * price list pays InventoryItem.sellingPrice unchanged. This must be the
 * default, not an edge case handled after the fact — most customers will
 * not be on a tier, and the walk-in/retail price is the one already on the
 * item.
 *
 * DISCOUNT PERCENT IS CLAMPED TO [0, 100], NOT TRUSTED. A negative percent
 * would silently mark items UP while reading like a discount, and above 100
 * produces a negative price. Both are almost certainly a typo, not an
 * intended pricing decision, so this module refuses to compute a price from
 * one rather than propagate the mistake onto an invoice.
 *
 * ROUNDING IS TO 2 DECIMAL PLACES (fils), MATCHING HOW MONEY IS STORED
 * EVERYWHERE ELSE IN THIS APP. A resolved price is something that ends up
 * printed on an invoice line — it must already be currency-shaped, not a
 * float a caller has to remember to round.
 */

export interface PriceListItemOverride {
  /** InventoryItem.id this override applies to. */
  itemId: string;
  /** Explicit unit price for this item on this list, overriding discountPercent. */
  unitPrice: number;
}

export interface PriceList {
  id: string;
  /** Stable tenant-scoped binding key. Existing retail/wholesale/resort/vip ids remain valid. */
  code?: string;
  /** Backend registry UUID; not exposed to customers or invoice lines. */
  registryId?: string;
  name: string;
  description?: string;
  /** Flat discount off InventoryItem.sellingPrice, applied when no item override exists. 0-100. */
  discountPercent: number;
  itemOverrides: PriceListItemOverride[];
  active?: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PriceListValidationError {
  field: string;
  message: string;
}

/**
 * Reference registry of the tiered price lists a customer can be bound to.
 *
 * SERP-314 Gap 2 provides a tenant-scoped registry-backed CRUD catalog while
 * preserving Retail, Wholesale, Resort, and VIP as compatibility codes. The
 * default ids remain a compatibility fallback only when the registry has not
 * loaded yet; a loaded registry is authoritative. `id` is the stable value
 * stored on `Customer.priceListId`; the registry UUID is internal to CRUD.
 */
export interface PriceListBindingOption {
  id: string;
  name: string;
}

export const PRICE_LIST_ADMIN_SEATS = ['owner', 'director', 'managing_director'] as const;

/**
 * Live Price List visibility follows the authenticated session, not demo role
 * fixtures. The acting seat must both be currently held and be one of the
 * server-authorized administrative seats for the current tenant context.
 */
export function canManagePriceListsForSession(session: {
  current_organisation_id?: string | null;
  acting_as?: string;
  seats?: readonly string[];
} | null | undefined): boolean {
  if (!session?.current_organisation_id || !session.acting_as || !session.seats?.includes(session.acting_as)) {
    return false;
  }
  return (PRICE_LIST_ADMIN_SEATS as readonly string[]).includes(session.acting_as);
}

export const PRICE_LIST_BINDING_OPTIONS: readonly PriceListBindingOption[] = [
  { id: 'retail', name: 'Retail' },
  { id: 'wholesale', name: 'Wholesale' },
  { id: 'resort', name: 'Resort' },
  { id: 'vip', name: 'VIP' },
];

/** Converts the tenant registry into customer-binding options. */
export function priceListBindingOptions(
  priceLists: readonly PriceList[] | undefined,
): readonly PriceListBindingOption[] {
  if (!priceLists) return PRICE_LIST_BINDING_OPTIONS;
  return priceLists
    .filter((list) => list.active !== false)
    .map((list) => ({ id: list.id, name: list.name }));
}

/**
 * Resolves a price list tier id to its display name for a bound customer.
 * Returns undefined only for an empty/absent binding (standard pricing). An
 * unknown non-empty id is surfaced explicitly so stale or custom backend data
 * is not misrepresented as an unbound customer.
 */
export function priceListBindingName(priceListId?: string, priceLists?: readonly PriceList[]): string | undefined {
  if (!priceListId) return undefined;
  return priceLists?.find((list) => list.id === priceListId)?.name
    ?? PRICE_LIST_BINDING_OPTIONS.find((o) => o.id === priceListId)?.name
    ?? `Unknown Tier (${priceListId})`;
}

/**
 * Validates a price list before it is created or saved. Returns an empty
 * array when valid. Does not mutate the input.
 */
export function validatePriceList(input: {
  code?: string;
  name: string;
  description?: string;
  discountPercent: number;
  itemOverrides: PriceListItemOverride[];
}): PriceListValidationError[] {
  const errors: PriceListValidationError[] = [];

  if (input.code !== undefined && !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(input.code.trim().toLowerCase())) {
    errors.push({ field: 'code', message: 'Price list code is required and may only contain lowercase letters, numbers, hyphens, and underscores.' });
  }

  if (!input.name || !input.name.trim()) {
    errors.push({ field: 'name', message: 'Price list name is required.' });
  }
  if (input.name.trim().length > 200) {
    errors.push({ field: 'name', message: 'Price list name must be 200 characters or fewer.' });
  }
  if (input.description !== undefined && input.description.length > 1000) {
    errors.push({ field: 'description', message: 'Price list description must be 1000 characters or fewer.' });
  }

  if (!Number.isFinite(input.discountPercent) || input.discountPercent < 0 || input.discountPercent > 100) {
    errors.push({ field: 'discountPercent', message: 'Discount percent must be a number between 0 and 100.' });
  }

  const seenItemIds = new Set<string>();
  for (const override of input.itemOverrides) {
    if (seenItemIds.has(override.itemId)) {
      errors.push({ field: 'itemOverrides', message: `Duplicate override for item ${override.itemId} — an item can only have one price on a given list.` });
    }
    seenItemIds.add(override.itemId);

    if (!Number.isFinite(override.unitPrice) || override.unitPrice < 0) {
      errors.push({ field: 'itemOverrides', message: `Override price for item ${override.itemId} must be a non-negative number.` });
    }
  }

  return errors;
}

/**
 * Resolves the unit price a customer on `priceList` actually pays for
 * `item`. `priceList` being undefined/null means the customer is not bound
 * to any tier — the item's own sellingPrice is returned unchanged.
 */
export function resolveItemPrice(
  item: { id: string; sellingPrice: number },
  priceList: PriceList | null | undefined
): number {
  if (!priceList) {
    return item.sellingPrice;
  }

  const override = priceList.itemOverrides.find((o) => o.itemId === item.id);
  if (override) {
    return roundToTwoDecimals(override.unitPrice);
  }

  const clampedPercent = Math.min(100, Math.max(0, priceList.discountPercent));
  const discounted = item.sellingPrice * (1 - clampedPercent / 100);
  return roundToTwoDecimals(discounted);
}

/**
 * Rounds to 2 decimal places, correcting for IEEE-754 binary representation
 * error on exact half-cent values. `1.005` is actually stored as
 * ~1.00499999999999989..., so a plain `Math.round(value * 100) / 100` mis-
 * rounds it DOWN to 1.00/1 instead of the expected 1.01 (Copilot review on
 * PR #118 caught this once this helper was exported for reuse in invoice
 * arithmetic, where it matters). Adding Number.EPSILON before scaling nudges
 * genuine half-cent values back onto the correct side of the rounding
 * boundary without perturbing any other value enough to change its result.
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
