import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../utils/retry', () => ({
  withRetry: (fn) => fn(),
}));

import apiClient from './axios';
import { bookingsAPI } from './bookings';

describe('bookingsAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableSlots', () => {
    it('requests available slots with date only', async () => {
      apiClient.get.mockResolvedValueOnce({ data: ['10:00-11:00'] });

      const result = await bookingsAPI.getAvailableSlots('2026-04-06');

      expect(apiClient.get).toHaveBeenCalledWith('/Bookings/available-slots', {
        params: { date: '2026-04-06' },
      });
      expect(result).toEqual(['10:00-11:00']);
    });

    it('includes durationMinutes when provided', async () => {
      apiClient.get.mockResolvedValueOnce({ data: ['09:00-10:30'] });

      const result = await bookingsAPI.getAvailableSlots('2026-04-06', 90);

      expect(apiClient.get).toHaveBeenCalledWith('/Bookings/available-slots', {
        params: { date: '2026-04-06', durationMinutes: 90 },
      });
      expect(result).toEqual(['09:00-10:30']);
    });

    it('omits durationMinutes when 0', async () => {
      apiClient.get.mockResolvedValueOnce({ data: ['10:00-11:00'] });

      await bookingsAPI.getAvailableSlots('2026-04-06', 0);

      expect(apiClient.get).toHaveBeenCalledWith('/Bookings/available-slots', {
        params: { date: '2026-04-06' },
      });
    });
  });

  describe('markRunningLate', () => {
    it('sends running-late payload with delay and reason', async () => {
      apiClient.post.mockResolvedValueOnce({ data: { ok: true } });

      const result = await bookingsAPI.markRunningLate(12, 30, 'Traffic delay');

      expect(apiClient.post).toHaveBeenCalledWith('/Bookings/12/running-late', {
        delayMinutes: 30,
        reason: 'Traffic delay',
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('getQuote', () => {
    it('sends correct payload structure', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: { finalPrice: 150, discount: 0 },
      });

      const result = await bookingsAPI.getQuote({
        packages: [{ packageId: 1, quantity: 1 }],
        vehicleType: 'Sedan',
        customerSubscriptionId: null,
        offerCode: 'SAVE10',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/Bookings/quote', {
        packages: [{ packageId: 1, quantity: 1 }],
        vehicleType: 'Sedan',
        customerSubscriptionId: null,
        offerCode: 'SAVE10',
      });
      expect(result).toEqual({ finalPrice: 150, discount: 0 });
    });

    it('returns null on 404 without throwing', async () => {
      apiClient.post.mockRejectedValueOnce({ response: { status: 404 } });

      const result = await bookingsAPI.getQuote({
        packages: [{ packageId: 1, quantity: 1 }],
        vehicleType: 'Sedan',
      });

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('posts booking data to /Bookings', async () => {
      const bookingData = {
        scheduledDate: '2026-04-06T12:00:00.000Z',
        timeSlot: '10:00-11:00',
        customerName: 'John Doe',
        vehicleType: 'Sedan',
        packages: [{ packageId: 1, quantity: 1 }],
      };
      apiClient.post.mockResolvedValueOnce({
        data: { bookingNumber: 'BK-123', id: 1 },
      });

      const result = await bookingsAPI.create(bookingData);

      expect(apiClient.post).toHaveBeenCalledWith('/Bookings', bookingData);
      expect(result).toEqual({ bookingNumber: 'BK-123', id: 1 });
    });
  });
});