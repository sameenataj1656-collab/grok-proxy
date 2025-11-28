const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - Allow all origins
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '50mb' }));

// Preflight handler
app.options('*', cors());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Grok API Proxy Server is running',
    endpoints: {
      chat: 'POST /api/chat',
      health: 'GET /health'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    cors: 'enabled'
  });
});

// Main proxy endpoint for Grok API
app.post('/api/chat', async (req, res) => {
  try {
    console.log('Received chat request');
    
    const { messages, model, temperature, max_tokens, apiKey } = req.body;

    if (!apiKey || !apiKey.startsWith('gsk_')) {
      console.log('Invalid API key');
      return res.status(400).json({ 
        error: 'Invalid API key format. Must start with gsk_' 
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('Invalid messages');
      return res.status(400).json({ 
        error: 'Messages array is required and must not be empty' 
      });
    }

    console.log(`Processing request with ${messages.length} messages`);

    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: model || 'grok-beta',
        messages: messages,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 4000,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 60000
      }
    );

    console.log('Grok API response received');
    res.json(response.data);

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: error.response.data?.error?.message || 'API request failed',
        details: error.response.data
      });
    } else if (error.request) {
      res.status(503).json({
        error: 'No response from Grok API. Service may be unavailable.',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Grok API Proxy Server running on port ${PORT}`);
  console.log(`📍 CORS enabled for all origins`);
});
