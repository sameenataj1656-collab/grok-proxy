const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// UPDATED CORS - Allow Claude.ai and all origins
const corsOptions = {
  origin: '*',  // Allow all origins
  credentials: false,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// Add OPTIONS handler for preflight
app.options('*', cors(corsOptions));

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
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main proxy endpoint for Grok API
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, temperature, max_tokens, apiKey } = req.body;

    if (!apiKey || !apiKey.startsWith('gsk_')) {
      return res.status(400).json({ 
        error: 'Invalid API key format. Must start with gsk_' 
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Messages array is required and must not be empty' 
      });
    }

    console.log(`[${new Date().toISOString()}] Processing chat request`);

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

    res.json(response.data);
    console.log(`[${new Date().toISOString()}] Success!`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error.response?.data || error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: error.response.data?.error?.message || 'API request failed',
        details: error.response.data
      });
    } else if (error.request) {
      res.status(503).json({
        error: 'No response from Grok API',
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

app.listen(PORT, () => {
  console.log(`🚀 Grok API Proxy Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
});
     
