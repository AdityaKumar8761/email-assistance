const express = require('express');
const jwt = require('jsonwebtoken');
const Mail = require('../models/Mail');
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

// Caffeena AI Agent - Hardcoded logic for mail assistance
router.post('/caffeena', authenticateToken, async (req, res) => {
  try {
    const { action, mailId, mailContent } = req.body;
    
    let response = {
      agent: 'Caffeena',
      avatar: '☕',
      message: '',
      suggestions: []
    };
    
    switch(action) {
      case 'check_new_mail':
        const unreadCount = await Mail.countDocuments({ 
          recipient: req.user.userId, 
          isRead: false 
        });
        
        if (unreadCount > 0) {
          response.message = `Hey! You have ${unreadCount} new email${unreadCount > 1 ? 's' : ''} in your inbox. Would you like me to help you read them?`;
          response.suggestions = ['Read now', 'Mark as spam', 'Archive'];
        } else {
          response.message = 'Your inbox is empty! Time for a coffee break? ☕';
        }
        break;
        
      case 'analyze_mail':
        if (!mailContent) {
          return res.status(400).json({ message: 'Mail content required' });
        }
        
        // Hardcoded spam detection logic
        const spamKeywords = ['winner', 'lottery', 'free money', 'urgent', 'congratulations', 'prize'];
        const isSpam = spamKeywords.some(keyword => 
          mailContent.toLowerCase().includes(keyword)
        );
        
        if (isSpam) {
          response.message = 'This looks like spam! 🚨 I recommend marking it as spam and deleting it.';
          response.suggestions = ['Mark as spam', 'Delete', 'Read anyway'];
        } else {
          response.message = 'This email looks legitimate. Would you like me to suggest a reply?';
          response.suggestions = ['Suggest reply', 'Mark as important', 'Archive'];
        }
        break;
        
      case 'suggest_reply':
        if (!mailContent) {
          return res.status(400).json({ message: 'Mail content required' });
        }
        
        // Hardcoded reply suggestions based on content
        const lowerContent = mailContent.toLowerCase();
        
        if (lowerContent.includes('meeting') || lowerContent.includes('schedule')) {
          response.message = 'This seems to be about scheduling. Here are some reply options:';
          response.suggestions = [
            'I can make it work. What time works best?',
            'I\'m unavailable at that time. Can we reschedule?',
            'Let me check my calendar and get back to you.'
          ];
        } else if (lowerContent.includes('thank')) {
          response.message = 'This is a thank you message. Would you like to respond?';
          response.suggestions = [
            'You\'re welcome!',
            'Happy to help!',
            'No problem at all!'
          ];
        } else if (lowerContent.includes('question') || lowerContent.includes('help')) {
          response.message = 'They\'re asking for help. Here are some options:';
          response.suggestions = [
            'I\'d be happy to help. What do you need?',
            'Let me look into that and get back to you.',
            'Can you provide more details?'
          ];
        } else {
          response.message = 'I can help you draft a reply. What would you like to say?';
          response.suggestions = [
            'Acknowledge receipt',
            'Ask for more information',
            'Decline politely'
          ];
        }
        break;
        
      case 'spam_check':
        const allMails = await Mail.find({ recipient: req.user.userId, isRead: false });
        const potentialSpam = [];
        
        for (const mail of allMails) {
          const spamKeywords = ['winner', 'lottery', 'free money', 'urgent', 'congratulations'];
          const isSpam = spamKeywords.some(keyword => 
            mail.subject.toLowerCase().includes(keyword) || 
            mail.body.toLowerCase().includes(keyword)
          );
          
          if (isSpam) {
            potentialSpam.push(mail._id);
          }
        }
        
        if (potentialSpam.length > 0) {
          response.message = `I found ${potentialSpam.length} potential spam email${potentialSpam.length > 1 ? 's' : ''} in your inbox. Should I mark them as spam?`;
          response.suggestions = ['Mark all as spam', 'Review individually', 'Ignore'];
        } else {
          response.message = 'No spam detected in your inbox. You\'re all set! ☕';
        }
        break;
        
      default:
        response.message = 'I\'m Caffeena, your email assistant! How can I help you today? ☕';
        response.suggestions = ['Check new mail', 'Analyze email', 'Spam check'];
    }
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error processing AI request', error: error.message });
  }
});

module.exports = router;
