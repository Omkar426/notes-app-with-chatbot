const express = require('express');
const mongoose = require('mongoose');
const Note = require('./models/Note');
const Chat = require('./models/Chat');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

// Routes
app.get('/api/notes', async (req, res) => {
  const notes = await Note.find().sort({ createdAt: -1 });
  res.json(notes);
});

app.post('/api/notes', async (req, res) => {
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
  await Note.findByIdAndDelete(req.params.id);
  res.json({ message: 'Note deleted' });
});

// Chat endpoint with Gemini API (corrected structure)
app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ response: 'Message is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ response: 'Missing Gemini API key' });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: userMessage }]
          }
        ]
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
