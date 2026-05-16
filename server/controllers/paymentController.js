const crypto = require('node:crypto');
const { razorpay } = require('../utils/razorpay.js');
const { Payment } = require('../models/Payment.js');

exports.createOrder = async (req, res) => {
    try {
        const { eventId } = req.body;

        const userId = req.user.id;

        if (!eventId) {
            res.status(400).json({ error: 'Invalid request body' });
            return;
        }
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        const { ticketPrice } = event;

        const options = {
            amount: ticketPrice * 100, // Razorpay expects amount in paise
            currency: 'INR',
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        // Save order to database
        const payment = new Payment({
            userId,
            eventId,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency
        });

        await payment.save();

        res.json({
            id: order.id,
            amount: order.amount,
            currency: order.currency
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            res.status(400).json({ error: 'Missing payment verification data' });
            return;
        }

        // Verify signature
        const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            throw new Error('RAZORPAY_KEY_SECRET not found');
        }
        const expectedSign = crypto.createHmac('sha256', secret).update(sign.toString()).digest('hex');

        if (razorpay_signature === expectedSign) {
            // Payment verified, update database
            await Payment.findOneAndUpdate(
                { orderId: razorpay_order_id },
                {
                    paymentId: razorpay_payment_id,
                    signature: razorpay_signature,
                    status: 'completed'
                }
            );

            // create a booking

            res.json({ status: 'success', message: 'Payment verified successfully' });
        } else {
            // Payment failed
            await Payment.findOneAndUpdate(
                { orderId: razorpay_order_id },
                { status: 'pending' } // or create a failed status
            );

            res.status(400).json({ status: 'failure', message: 'Payment verification failed' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
};
