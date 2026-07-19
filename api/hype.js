// Vercel serverless function: GET + POST /api/hype
// Global "hype" counter — persists across all visitors
// For production, replace the in-memory store with Vercel KV or a file.
let hypeCount = 0;

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method === 'GET') {
    return response.status(200).json({ count: hypeCount });
  }

  if (request.method === 'POST') {
    hypeCount++;
    return response.status(200).json({ count: hypeCount });
  }

  response.setHeader('Allow', 'GET, POST, OPTIONS');
  return response.status(405).json({ error: 'Method not allowed.' });
}