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
        enum: ['', 'Cash', 'UPI', 'Card', 'Bank Transfer'],
        required: function () { return this.status === 'Paid'; },
        default: ''
      },

      paidDate: {
        type: String,
        required: function () { return this.status === 'Paid'; },
        default: null
      },

      description: {
        type: String,
        default: ''
      },

      billData: {
        type: String,
        default: ''
      },

      billContentType: {
        type: String,
        enum: ['', 'application/pdf', 'image/jpeg', 'image/png', 'image/gif'],
        default: ''
      },

      billFileName: {
        type: String,
        maxlength: 255,
        default: ''
      }
    }
  ]

}, {
  timestamps: true
});

module.exports = mongoose.model('DailyExpense', expenseSchema);