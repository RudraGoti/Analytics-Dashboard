require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Expense = require('./models/Expense');

const app = express();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null;

app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
}));
app.use(express.json());

if (process.env.MONGO_URL) {
  mongoose.connect(process.env.MONGO_URL).catch((error) => {
    console.error('MongoDB connection failed:', error.message);
  });
}

app.get('/api/health', (_req, res) => {
  const database = mongoose.connection.readyState === 1;
  res.status(database ? 200 : 503).json({ ok: database, database });
});

app.get('/api/expenses/balance', async (req, res) => {
  const before = req.query.before;
  if (!isValidDate(before)) {
    return res.status(400).json({ success: false, error: 'before must be a valid YYYY-MM-DD date.' });
  }

  try {
    const [totals] = await Expense.aggregate([
      { $match: { date: { $lt: before } } },
      {
        $project: {
          counter: 1,
          expenseTotal: { $sum: '$expenses.amount' },
        },
      },
      {
        $group: {
          _id: null,
          totalCounter: { $sum: '$counter' },
          totalExpenses: { $sum: '$expenseTotal' },
        },
      },
    ]);
    const totalCounter = totals?.totalCounter || 0;
    const totalExpenses = totals?.totalExpenses || 0;
    return res.json({ before, totalCounter, totalExpenses, balance: totalCounter - totalExpenses });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to calculate balance.' });
  }
});

app.post('/api/expenses', async (req, res) => {
  const { date, counter, expenses, action } = req.body;
  if (!isValidDate(date)) {
    return res.status(400).json({ success: false, error: 'date must be a valid YYYY-MM-DD date.' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'Database is unavailable. Check the MongoDB connection and try again.',
    });
  }

  try {
    const existingRecord = await Expense.findOne({ date });
    if (existingRecord) {
      if (action === 'append') {
        const updatedRecord = await Expense.findOneAndUpdate(
          { date },
          { $push: { expenses: { $each: expenses } }, $set: { counter } },
          { new: true, runValidators: true }
        );
        return res.status(200).json({ success: true, data: updatedRecord });
      }
      if (action === 'replace') {
        const updatedRecord = await Expense.findOneAndUpdate(
          { date },
          { $set: { counter, expenses } },
          { new: true, runValidators: true }
        );
        return res.status(200).json({ success: true, data: updatedRecord });
      }
      return res.status(409).json({
        success: false,
        error: 'A record for this date already exists.',
        conflict: true,
        data: existingRecord,
      });
    }

    const record = new Expense({ date, counter, expenses });
    const savedRecord = await record.save();
    return res.status(201).json({ success: true, data: savedRecord });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'A record for this date already exists.', conflict: true });
    }
    return res.status(500).json({ success: false, error: 'Unable to save expense record.' });
  }
});

app.get('/api/expenses', async (req, res) => {
  const { date, dateFrom, dateTo } = req.query;
  if ((date && !isValidDate(date)) ||
      ((dateFrom || dateTo) && (!isValidDate(dateFrom) || !isValidDate(dateTo)))) {
    return res.status(400).json({ success: false, error: 'Dates must be valid YYYY-MM-DD dates.' });
  }

  try {
    if (date) {
      return res.status(200).json(await Expense.findOne({ date }) || null);
    }
    if (dateFrom && dateTo) {
      const records = await Expense.find({ date: { $gte: dateFrom, $lte: dateTo } }).sort({ date: 1 });
      return res.status(200).json(records);
    }
    return res.status(200).json(await Expense.find().sort({ date: -1 }));
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to fetch expense records.' });
  }
});

app.delete('/api/expenses/:date', async (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date)) {
    return res.status(400).json({ success: false, error: 'date must be a valid YYYY-MM-DD date.' });
  }
  try {
    const deleted = await Expense.findOneAndDelete({ date });
    return deleted
      ? res.status(200).json({ success: true, data: deleted })
      : res.status(404).json({ success: false, error: 'No record exists for this date.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to delete expense record.' });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port);
