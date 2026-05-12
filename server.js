const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const fetch = require('node-fetch');

const Note = require('../models/Note');
const Chat = require('../models/Chat');

const app = express();


// Middleware
app.use(cors());
app.use(bodyParser.json());


// MongoDB Connection
let isConnected = false;

const connectDB = async () => {

  if (isConnected) return;

  try {

    await mongoose.connect(process.env.MONGODB_URI);

    isConnected = true;

    console.log('MongoDB Connected');

  } catch (err) {

    console.error('MongoDB Error:', err);
  }
};

connectDB();


// =======================
// Notes Routes
// =======================

app.get('/api/notes', async (req, res) => {

  try {

    const notes = await Note.find().sort({ createdAt: -1 });

    res.status(200).json(notes);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});


app.post('/api/notes', async (req, res) => {

  try {

    const { title, content } = req.body;

    const note = new Note({
      title,
      content
    });

    await note.save();

    res.status(201).json(note);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });
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

    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});


app.delete('/api/notes/:id', async (req, res) => {

  try {

    await Note.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Deleted'
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});


// =======================
// Chat Route
// =======================

app.post('/chat', async (req, res) => {

  try {

    const userMessage = req.body.message;

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

    const aiResponse =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No response';

    const chat = new Chat({
      message: userMessage,
      response: aiResponse
    });

    await chat.save();

    res.json({
      response: aiResponse
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});


// Export for Vercel
module.exports = app;
