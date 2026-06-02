const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({

  date: {
    type: String,
    required: true,
    unique: true
  },

  counter: {
    type: Number,
    required: true
  },

  expenses: [
    {
      title: {
        type: String,
        required: true
      },

      category: {
        type: String,
        required: true
      },

      amount: {
        type: Number,
        required: true
      },

      status: {
        type: String,
        enum: ['Paid', 'Pending'],
        default: 'Pending'
      },

      mode: {
        type: String,
        required: true
      },

      description: {
        type: String,
        default: ''
      }
    }
  ]

}, {
  timestamps: true
});

module.exports = mongoose.model('DailyExpense', expenseSchema);