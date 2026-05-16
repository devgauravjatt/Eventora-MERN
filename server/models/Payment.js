const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        orderId: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
        paymentId: { type: String },
        signature: { type: String },
        amount: { type: Number, required: true },
        currency: { type: String, required: true, default: 'INR' },
        status: {
            type: String,
            enum: ['pending', 'completed'],
            default: 'pending'
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Payment', paymentSchema);
