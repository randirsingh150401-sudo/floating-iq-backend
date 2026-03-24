require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Chat endpoint - handles OpenAI chat completions with streaming
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gpt-4o-mini' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await openai.chat.completions.create({
      model: model,
      messages: messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
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

    let newTitle = null;

    // Auto-title the session from the first user message
    if (role === 'user') {
      const session = await Session.findById(sessionId);
      if (session && session.title === 'New Chat') {
        const msgCount = await History.countDocuments({ sessionId, role: 'user' });
        if (msgCount === 1) {
          // First user message — generate title from content
          const rawTitle = typeof content === 'string' ? content : JSON.stringify(content);
          newTitle = rawTitle.replace(/\s+/g, ' ').trim().slice(0, 40);
          if (rawTitle.length > 40) newTitle += '…';
          await Session.findByIdAndUpdate(sessionId, { title: newTitle, updatedAt: Date.now() });
        }
      }
    }

    res.json({
      success: true,
      message: 'History saved successfully',
      historyId: history._id,
      ...(newTitle && { newTitle })
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

// Update session title
app.patch('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const session = await Session.findByIdAndUpdate(
      sessionId,
      { title, updatedAt: Date.now() },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a session and its history
app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findByIdAndDelete(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Also delete all history associated with this session
    await History.deleteMany({ sessionId });

    res.json({
      success: true,
      message: 'Session and its history deleted successfully'
    });
  } catch (error) {
    console.error('Delete session error:', error);
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
