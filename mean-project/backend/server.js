require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Expense = require('./models/Expense');

const app = express();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const paymentModes = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
const billContentTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
const maxBillBytes = 5 * 1024 * 1024;
const maxRecordBillBytes = 10 * 1024 * 1024;

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
app.use(express.json({ limit: '16mb' }));

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

function prepareExpenses(expenses, recordDate) {
  if (!Array.isArray(expenses)) {
    throw new Error('expenses must be an array.');
  }

  let totalBillBytes = 0;
  return expenses.map((expense) => {
    if (!expense || typeof expense !== 'object') {
      throw new Error('Each expense must be an object.');
    }

    const status = expense.status === 'Paid' ? 'Paid' : expense.status === 'Pending' ? 'Pending' : null;
    if (!status) {
      throw new Error('Expense status must be Paid or Pending.');
    }

    const mode = status === 'Paid' ? expense.mode : '';
    if (expense.paidDate && !isValidDate(expense.paidDate)) {
      throw new Error('paidDate must be a valid YYYY-MM-DD date.');
    }
    const paidDate = status === 'Paid'
      ? (isValidDate(expense.paidDate) ? expense.paidDate : recordDate)
      : null;
    if (status === 'Paid' && !paymentModes.includes(mode)) {
      throw new Error('Choose a payment mode for each paid expense.');
    }

    const billData = typeof expense.billData === 'string' ? expense.billData : '';
    const billContentType = billData ? expense.billContentType : '';
    if (billData) {
      const billBytes = Buffer.byteLength(Buffer.from(billData, 'base64'));
      if (!billContentTypes.includes(billContentType) ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(billData) ||
          billBytes > maxBillBytes) {
        throw new Error('Bill attachments must be a supported image or PDF under 5MB.');
      }
      totalBillBytes += billBytes;
      if (totalBillBytes > maxRecordBillBytes) {
        throw new Error('Bill attachments must total 10MB or less for each day.');
      }
    }

    return {
      ...expense,
      status,
      mode,
      paidDate,
      billData,
      billContentType,
      billFileName: typeof expense.billFileName === 'string' ? expense.billFileName.slice(0, 255) : '',
    };
  });
}

app.post('/api/expenses', async (req, res) => {
  const { date, counter, action } = req.body;
  if (!isValidDate(date)) {
    return res.status(400).json({ success: false, error: 'date must be a valid YYYY-MM-DD date.' });
  }
  let expenses;
  try {
    expenses = prepareExpenses(req.body.expenses, date);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
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

app.patch('/api/expenses/:date/expenses/:expenseId/payment', async (req, res) => {
  const { date, expenseId } = req.params;
  const { paidDate, mode } = req.body;
  if (!isValidDate(date) || !isValidDate(paidDate)) {
    return res.status(400).json({ success: false, error: 'date and paidDate must be valid YYYY-MM-DD dates.' });
  }
  if (!mongoose.Types.ObjectId.isValid(expenseId)) {
    return res.status(400).json({ success: false, error: 'A valid expense id is required.' });
  }
  if (!paymentModes.includes(mode)) {
    return res.status(400).json({ success: false, error: 'Choose a valid payment mode.' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'Database is unavailable. Check the MongoDB connection and try again.',
    });
  }

  try {
    const updatedRecord = await Expense.findOneAndUpdate(
      { date, expenses: { $elemMatch: { _id: expenseId, status: 'Pending' } } },
      {
        $set: {
          'expenses.$.status': 'Paid',
          'expenses.$.paidDate': paidDate,
          'expenses.$.mode': mode,
        },
      },
      { new: true, runValidators: true },
    );
    return updatedRecord
      ? res.status(200).json({ success: true, data: updatedRecord })
      : res.status(404).json({ success: false, error: 'Pending expense not found for this date.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to update the expense payment.' });
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
