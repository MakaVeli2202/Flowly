import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const chatbotAPI = {
  sendMessage: async (message) => withRetry(async () => {
    const response = await apiClient.post('/Chatbot/chat', { message });
    return response.data;
  }),
};