require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Expense = require('./models/Expense');

const app = express();

// Middleware
app.use(cors());

app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log('✅ MongoDB Atlas connected');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });

// -----------------------------------
// POST - Save Expenses
// -----------------------------------

app.post('/api/expenses', async (req, res) => {

  try {

    console.log('====================');
    console.log('REQUEST RECEIVED');
    console.log(req.body);
    console.log('====================');

    const { date, counter, expenses, action } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date is required for expense records.'
      });
    }

    const existingRecord = await Expense.findOne({ date });

    if (existingRecord) {
      if (action === 'append') {
        const updatedRecord = await Expense.findOneAndUpdate(
          { date },
          {
            $push: { expenses: { $each: expenses } },
            $set: { counter }
          },
          { new: true }
        );

        return res.status(200).json({
          success: true,
          data: updatedRecord
        });
      }

      if (action === 'replace') {
        const updatedRecord = await Expense.findOneAndUpdate(
          { date },
          {
            $set: { counter, expenses }
          },
          { new: true }
        );

        return res.status(200).json({
          success: true,
          data: updatedRecord
        });
      }

      return res.status(409).json({
        success: false,
        error: 'A record for this date already exists.',
        conflict: true,
        data: existingRecord
      });
    }

    const record = new Expense({
      date,
      counter,
      expenses
    });

    const savedRecord = await record.save();

    console.log('DATA SAVED');

    res.status(201).json({
      success: true,
      data: savedRecord
    });

  } catch (err) {

    console.error('SAVE ERROR:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// -----------------------------------
// GET - Fetch All Expenses or Fetch by Date
// -----------------------------------

app.get('/api/expenses', async (req, res) => {

  try {
    const { date } = req.query;

    if (date) {
      const record = await Expense.findOne({ date });
      return res.status(200).json(record || null);
    }

    const records = await Expense.find()
      .sort({ createdAt: -1 });

    res.status(200).json(records);

  } catch (err) {

    console.error('❌ Fetch Error:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// -----------------------------------
// Server Start
// -----------------------------------
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});