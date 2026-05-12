const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// -------------------------------
// Mongoose Schemas & Models (inline)
// -------------------------------
const noteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  message: { type: String, required: true },
  response: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Using mongoose.models to prevent overwriting on hot reloads
const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);

// -------------------------------
// Database connection cache (serverless friendly)
// -------------------------------
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable mongoose buffering
      serverSelectionTimeoutMS: 5000,
    };
    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// -------------------------------
// Express app
// -------------------------------
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// -------------------------------
// Routes
// -------------------------------

// GET all notes
app.get('/api/notes', async (req, res) => {
  try {
    await dbConnect();
    const notes = await Note.find().sort({ createdAt: -1 });
    res.status(200).json(notes);
  } catch (err) {
    console.error('GET /api/notes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST new note
app.post('/api/notes', async (req, res) => {
  try {
    await dbConnect();
    const { title, content } = req.body;
    const note = new Note({ title, content });
    await note.save();
    res.status(201).json(note);
  } catch (err) {
    console.error('POST /api/notes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update note
app.put('/api/notes/:id', async (req, res) => {
  try {
    await dbConnect();
    const updatedNote = await Note.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updatedNote) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(updatedNote);
  } catch (err) {
    console.error('PUT /api/notes/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE note
app.delete('/api/notes/:id', async (req, res) => {
  try {
    await dbConnect();
    const deletedNote = await Note.findByIdAndDelete(req.params.id);
    if (!deletedNote) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE /api/notes/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /chat – Gemini AI chat
app.post('/chat', async (req, res) => {
  try {
    // No database connection needed for chat? Actually we save the chat later.
    await dbConnect();

    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing');
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMessage }] }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';

    // Save chat history
    const chat = new Chat({ message: userMessage, response: aiResponse });
    await chat.save();

    res.json({ response: aiResponse });
  } catch (err) {
    console.error('POST /chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Optional root route for health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Serverless function running' });
});

// Export for Vercel
module.exports = app;
