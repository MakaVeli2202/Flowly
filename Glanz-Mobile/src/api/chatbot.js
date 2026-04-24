import apiClient from './axios';

export const chatbotAPI = {
  sendMessage: async (message) => {
    const response = await apiClient.post('/Chatbot/chat', { message });
    return response.data;
  },
};
