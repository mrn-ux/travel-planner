// Run with: npx tsx src/lib/format.check.ts
// Asserts the formatting table in specs/001-app-shell-navigation/contracts/ui-shell.md.
import assert from 'node:assert/strict';
import { EM_DASH, formatDate, formatDuration, formatMoney } from './format.ts';

const cases: Array<[string, string, string]> = [
  ['money 1240 USD', formatMoney('1240', 'USD'), 'USD 1,240.00'],
  ['money zero EUR', formatMoney('0', 'EUR'), 'EUR 0.00'],
  ['money negative', formatMoney('-160.5', 'USD'), '-USD 160.50'],
  ['money rounds half up', formatMoney('1.005', 'USD'), 'USD 1.01'],
  ['money large', formatMoney('1234567.891', 'GBP'), 'GBP 1,234,567.89'],
  ['money lower-case code', formatMoney('5', 'usd'), 'USD 5.00'],
  ['money unknown code kept', formatMoney('5', 'XYZ'), 'XYZ 5.00'],
  ['money minus zero', formatMoney('-0.001', 'USD'), 'USD 0.00'],
  ['money null', formatMoney(null, 'USD'), EM_DASH],
  ['money undefined', formatMoney(undefined, 'USD'), EM_DASH],
  ['money empty', formatMoney('', 'USD'), EM_DASH],
  ['money abc', formatMoney('abc', 'USD'), EM_DASH],
  ['money NaN string', formatMoney('NaN', 'USD'), EM_DASH],
  ['money bad currency', formatMoney('5', ''), EM_DASH],
  ['date 18 Nov 2026', formatDate('2026-11-18'), '18 Nov 2026'],
  ['date single digit day', formatDate('2027-02-06'), '6 Feb 2027'],
  ['date with time', formatDate('2026-11-18T09:00:00Z'), '18 Nov 2026'],
  ['date invalid day', formatDate('2026-02-31'), EM_DASH],
  ['date garbage', formatDate('Invalid Date'), EM_DASH],
  ['date null', formatDate(null), EM_DASH],
  ['duration 135', formatDuration(135), '2h 15m'],
  ['duration 60', formatDuration(60), '1h'],
  ['duration 45', formatDuration(45), '45m'],
  ['duration NaN', formatDuration(Number.NaN), EM_DASH],
  ['duration decimal', formatDuration(2.25), EM_DASH],
  ['duration negative', formatDuration(-5), EM_DASH],
  ['duration null', formatDuration(null), EM_DASH],
];

for (const [name, actual, expected] of cases) {
  assert.equal(actual, expected, `${name}: expected "${expected}", got "${actual}"`);
}
console.log(`format.check: ${cases.length} cases passed`);
