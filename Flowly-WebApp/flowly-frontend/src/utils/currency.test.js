import { describe, it, expect } from 'vitest';
import { formatQAR, formatCompactQAR, formatQARDiff, parseQAR } from './currency';

describe('formatQAR', () => {
  it('formats whole numbers', () => {
    const result = formatQAR(100);
    expect(result).toContain('100');
    expect(result).toMatch(/^QAR\s+100$/);
  });

  it('formats decimals up to 2 places (no forced padding)', () => {
    expect(formatQAR(99.5)).toMatch(/^QAR\s+99\.5$/);
  });

  it('rounds to 2 decimal places', () => {
    const result = formatQAR(99.555);
    expect(result).toMatch(/^QAR\s+99\.56$/);
  });

  it('handles zero', () => {
    const result = formatQAR(0);
    expect(result).toContain('0');
  });

  it('handles large numbers with comma separators', () => {
    const result = formatQAR(1500);
    expect(result).toMatch(/^QAR\s+1,500$/);
  });

  it('formats 1 decimal place without forcing padding', () => {
    expect(formatQAR(50.1)).toMatch(/^QAR\s+50\.1$/);
  });

  it('handles null/undefined gracefully', () => {
    expect(formatQAR(null)).toContain('0');
    expect(formatQAR(undefined)).toContain('0');
  });

  it('handles NaN gracefully', () => {
    expect(formatQAR(NaN)).toContain('0');
  });
});

describe('formatCompactQAR', () => {
  it('formats thousands as K', () => {
    const result = formatCompactQAR(15000);
    expect(result).toMatch(/^QAR\s+15K$/);
  });

  it('formats millions as M', () => {
    const result = formatCompactQAR(1500000);
    expect(result).toMatch(/^QAR\s+1\.5M$/);
  });
});

describe('formatQARDiff', () => {
  it('adds + prefix for positive values', () => {
    expect(formatQARDiff(500)).toMatch(/^\+QAR\s+500$/);
  });

  it('adds - prefix for negative values', () => {
    expect(formatQARDiff(-200)).toMatch(/^-QAR\s+200$/);
  });

  it('no prefix for zero', () => {
    const result = formatQARDiff(0);
    expect(result).toContain('0');
    expect(result).not.toMatch(/^\+/);
    expect(result).not.toMatch(/^-/);
  });
});

describe('parseQAR', () => {
  it('parses number input directly', () => {
    expect(parseQAR(1500)).toBe(1500);
  });

  it('parses formatted string', () => {
    expect(parseQAR('QAR 1,500.50')).toBe(1500.5);
  });

  it('handles null/undefined', () => {
    expect(parseQAR(null)).toBe(0);
    expect(parseQAR(undefined)).toBe(0);
  });
});