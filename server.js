const express = require('express');
const mongoose = require('mongoose');
const Note = require('./models/Note');
const Chat = require('./models/Chat');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// For Node.js versions below 18
// npm install node-fetch
const fetch = require('node-fetch');

const app = express();


// ======================
// Middleware
// ======================

app.use(cors());
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));


// ======================
// MongoDB Connection
// ======================

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected');
  })
  .catch((err) => {
    console.error('MongoDB Connection Error:', err);
  });


// ======================
// Notes Routes
// ======================

// GET ALL NOTES
app.get('/api/notes', async (req, res) => {
  try {

    const notes = await Note.find().sort({ createdAt: -1 });

    res.status(200).json(notes);

  } catch (err) {

    console.error('Fetch Notes Error:', err);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch notes',
      details: err.message
    });
  }
});


// CREATE NOTE
app.post('/api/notes', async (req, res) => {
  try {

    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: 'Title and content are required'
      });
    }

    const note = new Note({
      title,
      content
    });

    await note.save();

    res.status(201).json(note);

  } catch (err) {

    console.error('Create Note Error:', err);

    res.status(500).json({
      error: 'Failed to create note',
      details: err.message
    });
  }
});


// UPDATE NOTE
app.put('/api/notes/:id', async (req, res) => {
  try {

    const updatedNote = await Note.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    if (!updatedNote) {
      return res.status(404).json({
        error: 'Note not found'
      });
    }

    res.status(200).json(updatedNote);

  } catch (err) {

    console.error('Update Note Error:', err);

    res.status(500).json({
      error: 'Failed to update note',
      details: err.message
    });
  }
});


// DELETE NOTE
app.delete('/api/notes/:id', async (req, res) => {
  try {

    const deletedNote = await Note.findByIdAndDelete(req.params.id);

    if (!deletedNote) {
      return res.status(404).json({
        error: 'Note not found'
      });
    }

    res.status(200).json({
      message: 'Note deleted successfully'
    });

  } catch (err) {

    console.error('Delete Note Error:', err);

    res.status(500).json({
      error: 'Failed to delete note',
      details: err.message
    });
  }
});


// ======================
// Chat Route
// ======================

app.post('/chat', async (req, res) => {

  try {

    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({
        response: 'Message is required'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        response: 'Missing Gemini API key'
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: userMessage
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      console.error('Gemini API Error:', data);

      return res.status(500).json({
        response: 'Error from AI model'
      });
    }

    const aiResponse =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No response from AI';

    const chat = new Chat({
      message: userMessage,
      response: aiResponse
    });

    await chat.save();

    res.status(200).json({
      response: aiResponse
    });

  } catch (err) {

    console.error('Chat Error:', err);

    res.status(500).json({
      response: 'Server error while processing request',
      details: err.message
    });
  }
});


// ======================
// Root Route
// ======================

app.get('/', (req, res) => {
  res.send('Server is running...');
});


// ======================
// Start Server
// ======================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
