const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// ========== MODELS ==========
// If you have separate model files, keep these requires.
// Otherwise, uncomment the inline schema definitions below.
const Note = require('./models/Note');
const Chat = require('./models/Chat');

// Inline schema fallback (if the above files don't exist, use this instead)
/*
const noteSchema = new mongoose.Schema({
  title: String,
  content: String,
  createdAt: { type: Date, default: Date.now }
});
const chatSchema = new mongoose.Schema({
  message: String,
  response: String,
  createdAt: { type: Date, default: Date.now }
});
const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);
*/

// ========== DATABASE CONNECTION (SERVERLESS CACHE) ==========
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    }).then(() => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// ========== EXPRESS APP ==========
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== ROUTES ==========
app.get('/api/notes', async (req, res) => {
  await dbConnect();
  const notes = await Note.find().sort({ createdAt: -1 });
  res.json(notes);
});

app.post('/api/notes', async (req, res) => {
  await dbConnect();
  try {
    const { title, content } = req.body;
    const note = new Note({ title, content });
    await note.save();
    res.status(201).json(note);
  } catch (err) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

app.put('/api/notes/:id', async (req, res) => {
  await dbConnect();
  try {
    const updatedNote = await Note.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    res.json(updatedNote);
  } catch (err) {
    res.status(400).json({ error: 'Update failed' });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  await dbConnect();
  await Note.findByIdAndDelete(req.params.id);
  res.json({ message: 'Note deleted' });
});

// Chat endpoint with Gemini API
app.post('/chat', async (req, res) => {
  await dbConnect();
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(400).json({ response: 'Message is required' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ response: 'Missing Gemini API key' });
  }
  try {
    // FIXED: backticks for template literal
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMessage }] }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API Error:', data);
      return res.status(500).json({ response: 'Error from AI model' });
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';
    const chat = new Chat({ message: userMessage, response: aiResponse });
    await chat.save();
    res.json({ response: aiResponse });
  } catch (err) {
    console.error('Chat Error:', err);
    res.status(500).json({ response: 'Server error while processing request' });
  }
});

// ========== EXPORT FOR VERCEL ==========
module.exports = app;
