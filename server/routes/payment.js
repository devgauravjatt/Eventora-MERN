const express = require('express');
const { protect } = require('../middleware/auth');
const { createOrder, verifyPayment } = require('../controllers/paymentController');

const router = express.Router();

// Create payment order
router.post('/order', protect, createOrder);

// Verify payment
router.post('/verify', protect, verifyPayment);

module.exports = router;
