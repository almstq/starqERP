/**
 * SERP-314 — tiered customer price lists (Retail, Wholesale, Resort, VIP).
 *
 * SCOPE OF THIS FILE. Domain logic only: the shape of a Price List and the
 * function that resolves what a given customer actually pays for a given
 * item. Admin CRUD screens and invoice-creation wiring are separate work —
 * this module is the part that can be specified and tested in isolation,
 * the same pattern already used for threeWayMatch.ts and landedCost.ts in
 * this codebase.
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
  name: string;
  description?: string;
  /** Flat discount off InventoryItem.sellingPrice, applied when no item override exists. 0-100. */
  discountPercent: number;
  itemOverrides: PriceListItemOverride[];
}

export interface PriceListValidationError {
  field: string;
  message: string;
}

/**
 * Validates a price list before it is created or saved. Returns an empty
 * array when valid. Does not mutate the input.
 */
export function validatePriceList(input: {
  name: string;
  discountPercent: number;
  itemOverrides: PriceListItemOverride[];
}): PriceListValidationError[] {
  const errors: PriceListValidationError[] = [];

  if (!input.name || !input.name.trim()) {
    errors.push({ field: 'name', message: 'Price list name is required.' });
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

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
