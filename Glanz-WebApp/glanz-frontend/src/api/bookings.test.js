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

  describe('getAll', () => {
    it('calls /Bookings/all with default params', async () => {
      apiClient.get.mockResolvedValueOnce({ data: { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 } });

      await bookingsAPI.getAll();

      const call = apiClient.get.mock.calls[0][0];
      expect(call).toContain('/Bookings/all');
      expect(call).toContain('page=1');
      expect(call).toContain('pageSize=100');
    });

    it('includes search param when provided', async () => {
      apiClient.get.mockResolvedValueOnce({ data: { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 } });

      await bookingsAPI.getAll({ search: 'BK-123' });

      expect(apiClient.get.mock.calls[0][0]).toContain('search=BK-123');
    });

    it('includes status param when not All', async () => {
      apiClient.get.mockResolvedValueOnce({ data: { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 } });

      await bookingsAPI.getAll({ status: 'Pending' });

      expect(apiClient.get.mock.calls[0][0]).toContain('status=Pending');
    });

    it('omits status param when All', async () => {
      apiClient.get.mockResolvedValueOnce({ data: { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 } });

      await bookingsAPI.getAll({ status: 'All' });

      expect(apiClient.get.mock.calls[0][0]).not.toContain('status=');
    });

    it('returns paged result shape', async () => {
      const expected = { items: [{ id: 1 }], totalCount: 1, page: 1, pageSize: 100, totalPages: 1 };
      apiClient.get.mockResolvedValueOnce({ data: expected });

      const result = await bookingsAPI.getAll();

      expect(result).toEqual(expected);
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