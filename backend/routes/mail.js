const express = require('express');
const jwt = require('jsonwebtoken');
const Mail = require('../models/Mail');
const User = require('../models/User');
const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Send mail
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { recipientEmail, subject, body } = req.body;
    
    // Find recipient
    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    const mail = new Mail({
      sender: req.user.userId,
      recipient: recipient._id,
      subject,
      body
    });
    
    await mail.save();
    
    res.status(201).json({ message: 'Mail sent successfully', mail });
  } catch (error) {
    res.status(500).json({ message: 'Error sending mail', error: error.message });
  }
});

// Get inbox
router.get('/inbox', authenticateToken, async (req, res) => {
  try {
    const mails = await Mail.find({ recipient: req.user.userId })
      .populate('sender', 'username email')
      .sort({ createdAt: -1 });
    
    res.json({ mails });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inbox', error: error.message });
  }
});

// Get sent mail
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const mails = await Mail.find({ sender: req.user.userId })
      .populate('recipient', 'username email')
      .sort({ createdAt: -1 });
    
    res.json({ mails });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sent mail', error: error.message });
  }
});

// Mark as read
router.put('/:mailId/read', authenticateToken, async (req, res) => {
  try {
    const mail = await Mail.findByIdAndUpdate(
      req.params.mailId,
      { isRead: true },
      { new: true }
    );
    
    res.json({ message: 'Mail marked as read', mail });
  } catch (error) {
    res.status(500).json({ message: 'Error updating mail', error: error.message });
  }
});

// Delete mail
router.delete('/:mailId', authenticateToken, async (req, res) => {
  try {
    await Mail.findByIdAndDelete(req.params.mailId);
    res.json({ message: 'Mail deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting mail', error: error.message });
  }
});

module.exports = router;
