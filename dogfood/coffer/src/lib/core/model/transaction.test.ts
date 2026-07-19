import { describe, expect, it } from 'vitest';
import { addMoney, directionOf, formatMoney, money, negateMoney } from './transaction';

describe('Money', () => {
	it('constructs from bigint and from a safe integer number', () => {
		expect(money(1050n, 'pln')).toEqual({ minor: 1050n, currency: 'PLN' });
		expect(money(1050, 'usd')).toEqual({ minor: 1050n, currency: 'USD' });
	});

	it('rejects non-integer number minor units', () => {
		expect(() => money(10.5, 'PLN')).toThrow();
	});

	it('adds same-currency amounts', () => {
		const a = money(1000, 'PLN');
		const b = money(250, 'PLN');
		expect(addMoney(a, b)).toEqual({ minor: 1250n, currency: 'PLN' });
	});

	it('adds negative and positive amounts correctly', () => {
		const a = money(1000, 'PLN');
		const b = money(-1500, 'PLN');
		expect(addMoney(a, b)).toEqual({ minor: -500n, currency: 'PLN' });
	});

	it('throws on cross-currency add', () => {
		expect(() => addMoney(money(100, 'PLN'), money(100, 'USD'))).toThrow(/currency mismatch/i);
	});

	it('negates an amount, keeping currency', () => {
		expect(negateMoney(money(500, 'PLN'))).toEqual({ minor: -500n, currency: 'PLN' });
		expect(negateMoney(money(-500, 'PLN'))).toEqual({ minor: 500n, currency: 'PLN' });
	});

	it('negate is its own inverse', () => {
		const a = money(12345, 'EUR');
		expect(negateMoney(negateMoney(a))).toEqual(a);
	});
});

describe('directionOf', () => {
	it('is "out" for negative amounts', () => {
		expect(directionOf(money(-100, 'PLN'))).toBe('out');
	});

	it('is "in" for positive amounts', () => {
		expect(directionOf(money(100, 'PLN'))).toBe('in');
	});

	it('is "in" for zero by convention', () => {
		expect(directionOf(money(0, 'PLN'))).toBe('in');
	});
});

describe('formatMoney', () => {
	it('formats positive minor units with default 2 decimals', () => {
		expect(formatMoney(money(123456, 'PLN'))).toBe('1234.56');
	});

	it('formats negative minor units with a leading minus', () => {
		expect(formatMoney(money(-123456, 'PLN'))).toBe('-1234.56');
	});

	it('pads small fractional amounts', () => {
		expect(formatMoney(money(5, 'PLN'))).toBe('0.05');
	});

	it('formats exact multiples cleanly', () => {
		expect(formatMoney(money(100, 'PLN'))).toBe('1.00');
	});

	it('supports zero-decimal currencies via minorDigits: 0', () => {
		expect(formatMoney(money(500, 'JPY'), 0)).toBe('500');
		expect(formatMoney(money(-500, 'JPY'), 0)).toBe('-500');
	});

	it('rejects a negative minorDigits', () => {
		expect(() => formatMoney(money(100, 'PLN'), -1)).toThrow();
	});
});
