const mongoose = require('mongoose');

const personSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, default: '' }
}, { _id: false });

const queueSchema = new mongoose.Schema({
    queueNumber: { type: String, required: true },
    people: [personSchema],
    status: { type: String, enum: ['waiting', 'working', 'done'], default: 'waiting' },
    order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Queue', queueSchema);
