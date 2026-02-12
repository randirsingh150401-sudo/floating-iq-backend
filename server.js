require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// MongoDB Schemas
const historySchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  role: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, default: 'New Chat' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const History = mongoose.model('History', historySchema);
const Session = mongoose.model('Session', sessionSchema);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Floating IQ Backend API', status: 'running' });
});

// Chat endpoint - handles OpenAI chat completions
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gpt-3.5-turbo' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages,
    });

    res.json({
      success: true,
      response: completion.choices[0].message.content,
      usage: completion.usage
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Save history endpoint
app.post('/api/save-history', async (req, res) => {
  try {
    const { sessionId, role, content } = req.body;

    if (!sessionId || !role || !content) {
      return res.status(400).json({ error: 'sessionId, role, and content are required' });
    }

    const history = new History({
      sessionId,
      role,
      content
    });

    await history.save();

    res.json({ 
      success: true, 
      message: 'History saved successfully',
      historyId: history._id
    });
  } catch (error) {
    console.error('Save history error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get history for a session
app.get('/api/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const history = await History.find({ sessionId }).sort({ timestamp: 1 });

    res.json({ 
      success: true, 
      history 
    });
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create session
app.post('/api/sessions', async (req, res) => {
  try {
    const { userId, title } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const session = new Session({
      userId,
      title: title || 'New Chat'
    });

    await session.save();

    res.json({ 
      success: true, 
      session 
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get sessions for a user
app.get('/api/sessions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const sessions = await Session.find({ userId }).sort({ updatedAt: -1 });

    res.json({ 
      success: true, 
      sessions 
    });
  } catch (error) {
    console.error('Fetch sessions error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
