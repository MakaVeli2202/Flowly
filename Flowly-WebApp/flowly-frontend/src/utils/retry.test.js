import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from './retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe('success');
  });

  it('retries once on 500 error and succeeds', async () => {
    const error = { response: { status: 500 } };
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('success');

    const resultPromise = withRetry(fn);

    await vi.advanceTimersByTimeAsync(350);
    const result = await resultPromise;

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toBe('success');
  });

  it('does not retry on 400 error', async () => {
    const error = { response: { status: 400 } };
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn)).rejects.toEqual(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 404 error', async () => {
    const error = { response: { status: 404 } };
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn)).rejects.toEqual(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on network error with no status', async () => {
    const error = {};
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('success');

    const resultPromise = withRetry(fn);

    await vi.advanceTimersByTimeAsync(350);
    const result = await resultPromise;

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toBe('success');
  });

  it('respects maxAttempts parameter', async () => {
    const error = { response: { status: 500 } };
    const fn = vi.fn().mockRejectedValue(error);

    const resultPromise = withRetry(fn, 3);
    const assertion = expect(resultPromise).rejects.toEqual(error);

    await vi.advanceTimersByTimeAsync(700);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('fails after max attempts exhausted', async () => {
    const error = { response: { status: 500 } };
    const fn = vi.fn().mockRejectedValue(error);

    const resultPromise = withRetry(fn, 2);
    const assertion = expect(resultPromise).rejects.toEqual(error);

    await vi.advanceTimersByTimeAsync(700);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });
});