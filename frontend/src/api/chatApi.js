import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:8081/api',
  timeout: 120000,
});

export async function askChat({ question, sessionId, topK }) {
  const response = await api.post('/chat', {
    question,
    sessionId,
    topK,
  });
  return response.data;
}
