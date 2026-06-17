// Example test proving the Vitest harness works — delete once real tests exist.
// Destination: src/example.test.ts

import { describe, it, expect } from 'vitest';

function sum(a: number, b: number): number {
  return a + b;
}

describe('sum', () => {
  it('adds two positive numbers', () => {
    expect(sum(2, 3)).toBe(5);
  });

  it('handles negative numbers', () => {
    expect(sum(-4, 1)).toBe(-3);
  });
});
