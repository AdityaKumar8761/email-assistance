const express = require('express');
const jwt = require('jsonwebtoken');
const Mail = require('../models/Mail');
const Task = require('../models/Task');
const { analyzeEmail, generateReply, extractTasks, writeEmailFromTask } = require('../services/aiService');
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

// Summarize email using AI
router.post('/summarize', authenticateToken, async (req, res) => {
  try {
    const { sender, subject, body } = req.body;
    
    if (!sender || !subject || !body) {
      return res.status(400).json({ message: 'Sender, subject, and body are required' });
    }

    const analysis = await analyzeEmail(sender, subject, body);
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    res.status(500).json({ message: 'Error summarizing email', error: error.message });
  }
});

// Generate reply using AI
router.post('/reply', authenticateToken, async (req, res) => {
  try {
    const { sender, subject, body, replyType } = req.body;
    
    if (!sender || !subject || !body) {
      return res.status(400).json({ message: 'Sender, subject, and body are required' });
    }

    const reply = await generateReply(
      { sender, subject, body },
      replyType || 'professional'
    );
    
    res.json({
      success: true,
      reply
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating reply', error: error.message });
  }
});

// Extract tasks from email using AI
router.post('/tasks', authenticateToken, async (req, res) => {
  try {
    const { sender, subject, body, mailId } = req.body;

    if (!sender || !subject || !body) {
      return res.status(400).json({ message: 'Sender, subject, and body are required' });
    }

    const tasks = await extractTasks(sender, subject, body);

    // Fallback: If AI found no tasks but email contains action items, create a manual task
    if (!tasks.tasks || tasks.tasks.length === 0) {
      const combinedText = `${subject} ${body}`.toLowerCase();
      const actionKeywords = ['push', 'submit', 'complete', 'review', 'send', 'do', 'please', 'can you', 'need to', 'should', 'by', 'deadline', 'due', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      if (actionKeywords.some(keyword => combinedText.includes(keyword))) {
        tasks.tasks = [{
          description: `Task from email: ${subject}`,
          due_date: null,
          priority: 'medium',
          assigned_to: null
        }];
      }
    }

    // Auto-save extracted tasks to database
    const savedTasks = [];
    if (tasks.tasks && tasks.tasks.length > 0) {
      for (const task of tasks.tasks) {
        const newTask = new Task({
          userId: req.user.userId,
          title: task.description.substring(0, 100),
          description: task.description,
          priority: task.priority || 'medium',
          dueDate: task.due_date || null,
          assignedTo: task.assigned_to || null,
          sourceEmailId: mailId || null
        });

        await newTask.save();
        savedTasks.push(newTask);
      }
    }

    res.json({
      success: true,
      tasks: tasks.tasks,
      savedTasks
    });
  } catch (error) {
    res.status(500).json({ message: 'Error extracting tasks', error: error.message });
  }
});

// Write email from task using AI
router.post('/write', authenticateToken, async (req, res) => {
  try {
    const { task } = req.body;
    
    if (!task) {
      return res.status(400).json({ message: 'Task description is required' });
    }

    const email = await writeEmailFromTask(task);
    
    res.json({
      success: true,
      email
    });
  } catch (error) {
    res.status(500).json({ message: 'Error writing email', error: error.message });
  }
});

// Caffeena AI Agent - Enhanced with real AI integration
router.post('/caffeena', authenticateToken, async (req, res) => {
  try {
    const { action, mailId, mailContent, message } = req.body;

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
          response.suggestions = ['Show me my inbox', 'Check for spam', 'Summarize all'];
        } else {
          response.message = 'Your inbox is empty! Time for a coffee break? ☕';
          response.suggestions = ['Show my tasks', 'Check sent mail', 'Compose email'];
        }
        break;

      case 'general':
        // Use AI to understand general queries
        if (message) {
          response.message = `I understand you said: "${message}". I can help you with emails, tasks, and more. Try asking me to summarize an email, extract tasks, or generate a reply!`;
          response.suggestions = ['Show my tasks', 'Summarize current email', 'Generate reply'];
        } else {
          response.message = 'I\'m Caffeena, your intelligent email assistant! I can help you with:';
          response.suggestions = ['Summarize emails', 'Extract tasks', 'Generate replies', 'Manage tasks'];
        }
        break;

      default:
        response.message = 'I\'m Caffeena, your intelligent email assistant! How can I help you today? ☕';
        response.suggestions = ['Check new mail', 'Show my tasks', 'Analyze email'];
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error processing AI request', error: error.message });
  }
});

// Intelligent chat endpoint using Groq AI
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Get user context
    const unreadCount = await Mail.countDocuments({
      recipient: req.user.userId,
      isRead: false
    });

    const taskCount = await Task.countDocuments({
      userId: req.user.userId,
      completed: false
    });

    // Use Groq AI for intelligent response
    const { analyzeEmail } = require('../services/aiService');
    const groq = require('groq-sdk');
    const groqClient = new groq.Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `You are Caffeena, an intelligent email assistant. Help the user with their request.

User context:
- Unread emails: ${unreadCount}
- Active tasks: ${taskCount}

User message: ${message}

Provide a helpful, friendly response. If they ask about their inbox, tasks, or email management, give specific guidance.
Keep responses concise and conversational. End with 2-3 relevant action suggestions.

Format your response as JSON:
{
  "message": "your response here",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}`;

    const response = await groqClient.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    let content = response.choices[0].message.content;

    // Remove markdown code fences if present
    if (content.startsWith('```')) {
      content = content.split('\n', 1)[1];
      const lastBacktickIndex = content.lastIndexOf('```');
      if (lastBacktickIndex !== -1) {
        content = content.substring(0, lastBacktickIndex).trim();
      }
    }

    const aiResponse = JSON.parse(content);

    res.json({
      message: aiResponse.message,
      suggestions: aiResponse.suggestions
    });
  } catch (error) {
    console.error('Error in intelligent chat:', error);
    // Fallback to simple response
    res.json({
      message: 'I can help you with your emails and tasks. Try asking me to summarize an email, extract tasks, or show your inbox!',
      suggestions: ['Show my inbox', 'Show my tasks', 'Summarize current email']
    });
  }
});

module.exports = router;
