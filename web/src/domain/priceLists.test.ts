import { describe, it, expect } from 'vitest';
import { validatePriceList, resolveItemPrice, PriceList } from './priceLists';

describe('SERP-314: tiered customer price lists', () => {
  const item = { id: 'inv-1', sellingPrice: 100 };

  describe('resolveItemPrice', () => {
    it('returns the base sellingPrice when no price list is bound (walk-in/retail customer)', () => {
      expect(resolveItemPrice(item, undefined)).toBe(100);
      expect(resolveItemPrice(item, null)).toBe(100);
    });

    it('applies a flat discountPercent when no item override exists', () => {
      const tradeDiscount: PriceList = {
        id: 'pl-1',
        name: 'Trade Discount 15%',
        discountPercent: 15,
        itemOverrides: [],
      };
      // 100 * (1 - 0.15) = 85
      expect(resolveItemPrice(item, tradeDiscount)).toBe(85);
    });

    it('an item override wins over the flat discountPercent', () => {
      const resortWholesale: PriceList = {
        id: 'pl-2',
        name: 'Resort Wholesale',
        discountPercent: 20,
        itemOverrides: [{ itemId: 'inv-1', unitPrice: 72.5 }],
      };
      // Override applies, NOT 100 * 0.8 = 80.
      expect(resolveItemPrice(item, resortWholesale)).toBe(72.5);
    });

    it('a price list with 0% discount and no override resolves to the base price unchanged', () => {
      const vip: PriceList = { id: 'pl-3', name: 'VIP', discountPercent: 0, itemOverrides: [] };
      expect(resolveItemPrice(item, vip)).toBe(100);
    });

    it('clamps a negative discountPercent to 0 rather than marking the item up', () => {
      const malformed: PriceList = { id: 'pl-4', name: 'Bad Data', discountPercent: -10, itemOverrides: [] };
      expect(resolveItemPrice(item, malformed)).toBe(100);
    });

    it('clamps a discountPercent above 100 to 100 rather than producing a negative price', () => {
      const malformed: PriceList = { id: 'pl-5', name: 'Bad Data', discountPercent: 250, itemOverrides: [] };
      expect(resolveItemPrice(item, malformed)).toBe(0);
    });

    it('rounds the resolved price to 2 decimal places', () => {
      const oddDiscount: PriceList = { id: 'pl-6', name: 'Odd Discount', discountPercent: 33, itemOverrides: [] };
      const oddItem = { id: 'inv-2', sellingPrice: 10 };
      // 10 * 0.67 = 6.7 exactly, but exercise a case that would otherwise float-drift.
      const thirdItem = { id: 'inv-3', sellingPrice: 10 / 3 };
      expect(resolveItemPrice(oddItem, oddDiscount)).toBe(6.7);
      expect(Number.isInteger(resolveItemPrice(thirdItem, oddDiscount) * 100)).toBe(true);
    });

    it('an override for a different item does not affect this item — falls through to discountPercent', () => {
      const list: PriceList = {
        id: 'pl-7',
        name: 'Mixed',
        discountPercent: 10,
        itemOverrides: [{ itemId: 'some-other-item', unitPrice: 1 }],
      };
      expect(resolveItemPrice(item, list)).toBe(90);
    });
  });

  describe('validatePriceList', () => {
    it('accepts a valid price list with no errors', () => {
      expect(validatePriceList({ name: 'Resort Wholesale', discountPercent: 20, itemOverrides: [] })).toEqual([]);
    });

    it('rejects a missing or blank name', () => {
      const errors = validatePriceList({ name: '  ', discountPercent: 10, itemOverrides: [] });
      expect(errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('rejects a discountPercent outside 0-100', () => {
      expect(validatePriceList({ name: 'X', discountPercent: -1, itemOverrides: [] }).some((e) => e.field === 'discountPercent')).toBe(true);
      expect(validatePriceList({ name: 'X', discountPercent: 101, itemOverrides: [] }).some((e) => e.field === 'discountPercent')).toBe(true);
    });

    it('rejects a non-finite discountPercent', () => {
      expect(validatePriceList({ name: 'X', discountPercent: NaN, itemOverrides: [] }).some((e) => e.field === 'discountPercent')).toBe(true);
    });

    it('rejects duplicate item overrides for the same item', () => {
      const errors = validatePriceList({
        name: 'Dup',
        discountPercent: 10,
        itemOverrides: [
          { itemId: 'inv-1', unitPrice: 50 },
          { itemId: 'inv-1', unitPrice: 60 },
        ],
      });
      expect(errors.some((e) => e.field === 'itemOverrides' && e.message.includes('inv-1'))).toBe(true);
    });

    it('rejects a negative override unit price', () => {
      const errors = validatePriceList({
        name: 'X',
        discountPercent: 10,
        itemOverrides: [{ itemId: 'inv-1', unitPrice: -5 }],
      });
      expect(errors.some((e) => e.field === 'itemOverrides')).toBe(true);
    });
  });
});
