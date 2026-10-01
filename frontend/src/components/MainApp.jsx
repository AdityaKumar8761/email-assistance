import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './MainApp.css';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000/api`;

function MainApp({ user, onLogout }) {
  const [currentView, setCurrentView] = useState('inbox');
  const [mails, setMails] = useState([]);
  const [selectedMail, setSelectedMail] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({ to: '', subject: '', body: '' });
  const [showCaffeena, setShowCaffeena] = useState(false);
  const [caffeenaResponse, setCaffeenaResponse] = useState(null);
  const [caffeenaMessages, setCaffeenaMessages] = useState([]);
  const [caffeenaInput, setCaffeenaInput] = useState('');
  const messagesEndRef = useRef(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiReply, setAiReply] = useState(null);
  const [aiTasks, setAiTasks] = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [showTaskPanel, setShowTaskPanel] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (currentView === 'inbox') loadInbox();
    else if (currentView === 'sent') loadSent();
  }, [currentView]);

  useEffect(() => {
    loadTasks();
  }, []);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [caffeenaMessages]);

  const loadTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(response.data.tasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadInbox = async () => {
    try {
      const response = await axios.get(`${API_URL}/mail/inbox`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMails(response.data.mails);
      setInboxCount(response.data.mails.filter(m => !m.isRead).length);
    } catch (error) {
      console.error('Error loading inbox:', error);
    }
  };

  const loadSent = async () => {
    try {
      const response = await axios.get(`${API_URL}/mail/sent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMails(response.data.mails);
    } catch (error) {
      console.error('Error loading sent:', error);
    }
  };

  const handleCompose = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/mail/send`, {
        recipientEmail: composeForm.to,
        subject: composeForm.subject,
        body: composeForm.body
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Mail sent successfully!');
      setComposeForm({ to: '', subject: '', body: '' });
      setShowCompose(false);
      setCurrentView('sent');
    } catch (error) {
      console.error('Error sending mail:', error);
      alert(`Failed to send mail: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleMailClick = async (mail) => {
    setSelectedMail(mail);
    if (!mail.isRead && currentView === 'inbox') {
      try {
        await axios.put(`${API_URL}/mail/${mail._id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        loadInbox();
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }

    // Proactively suggest Caffeena actions when opening an email
    setCaffeenaMessages([
      {
        role: 'assistant',
        content: `I see you're reading an email from ${mail.sender?.username || 'someone'}. Would you like me to:`,
        suggestions: ['Summarize this email', 'Extract tasks', 'Generate a reply']
      }
    ]);
    setShowCaffeena(true);

    // Scroll to bottom after a short delay to ensure the modal is rendered
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleDelete = async () => {
    if (!selectedMail) return;
    try {
      await axios.delete(`${API_URL}/mail/${selectedMail._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedMail(null);
      loadInbox();
    } catch (error) {
      alert('Failed to delete mail');
    }
  };

  const askCaffeena = async (action, mailContent = null) => {
    try {
      const response = await axios.post(`${API_URL}/ai/caffeena`,
        { action, mailContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCaffeenaResponse(response.data);
      setCaffeenaMessages(prev => [
        ...prev,
        { role: 'assistant', content: response.data.message, suggestions: response.data.suggestions }
      ]);
    } catch (error) {
      console.error('Error asking Caffeena:', error);
    }
  };

  const chatWithCaffeena = async (message) => {
    if (!message.trim()) return;

    setCaffeenaMessages(prev => [...prev, { role: 'user', content: message }]);
    setCaffeenaInput('');

    // Parse the user's intent
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('show') && lowerMessage.includes('inbox')) {
      setCurrentView('inbox');
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ve switched to your inbox view. You can see all your incoming emails here.',
        suggestions: ['Summarize all emails', 'Check for spam', 'Show my tasks']
      }]);
    } else if (lowerMessage.includes('show') && lowerMessage.includes('task')) {
      setShowTaskPanel(true);
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ve opened your task panel. You can view and manage your tasks there.',
        suggestions: ['Close task panel', 'Show inbox', 'Compose email']
      }]);
    } else if (lowerMessage.includes('close') && lowerMessage.includes('task')) {
      setShowTaskPanel(false);
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ve closed the task panel.',
        suggestions: ['Show my tasks', 'Show inbox', 'Ask Caffeena']
      }]);
    } else if (lowerMessage.includes('check') && lowerMessage.includes('spam')) {
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m scanning your inbox for potential spam emails...',
        suggestions: ['Show inbox', 'Mark all as safe', 'Delete suspicious emails']
      }]);
      // Simulate spam check
      setTimeout(() => {
        setCaffeenaMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I\'ve scanned your inbox. No obvious spam detected. Your emails look safe! ☕',
          suggestions: ['Show inbox', 'Show my tasks', 'Compose email']
        }]);
      }, 1000);
    } else if (lowerMessage.includes('summarize') && lowerMessage.includes('all')) {
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m analyzing all your emails to provide a summary...',
      }]);
      // Simulate summarizing all
      setTimeout(() => {
        setCaffeenaMessages(prev => [...prev, {
          role: 'assistant',
          content: `You have ${inboxCount} unread emails. I recommend reviewing them and extracting any tasks. Would you like me to help with that?`,
          suggestions: ['Extract tasks from all', 'Show inbox', 'Check for spam']
        }]);
      }, 1000);
    } else if (lowerMessage.includes('compose') || lowerMessage.includes('write')) {
      setShowCompose(true);
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ve opened the compose window for you. Need help writing the email?',
        suggestions: ['Help me write an email', 'Show inbox', 'Cancel']
      }]);
    } else if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m Caffeena, your intelligent email assistant! I can help you with:\n\n• Summarize emails and extract key information\n• Extract tasks and deadlines from emails\n• Generate professional or casual replies\n• Manage your task list\n• Check for spam\n• Navigate your inbox\n\nJust tell me what you need!',
        suggestions: ['Summarize current email', 'Extract tasks', 'Generate reply', 'Show my tasks']
      }]);
    } else if (lowerMessage.includes('summarize') && selectedMail) {
      await summarizeEmail();
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ve analyzed this email. Here\'s the summary:',
        analysis: aiAnalysis,
        suggestions: ['Extract tasks', 'Generate reply', 'Show my tasks']
      }]);
    } else if (lowerMessage.includes('task') && selectedMail) {
      const extractedTasks = await extractTasks();
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: `I found ${extractedTasks?.tasks?.length || 0} tasks in this email and added them to your task list.`,
        tasks: extractedTasks,
        suggestions: ['Show my tasks', 'Generate reply', 'Summarize email']
      }]);
    } else if (lowerMessage.includes('reply') && selectedMail) {
      const replyType = lowerMessage.includes('casual') ? 'casual' : 'professional';
      await generateReply(replyType);
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Here\'s a suggested reply:',
        reply: aiReply,
        suggestions: ['Use this reply', 'Extract tasks', 'Show my tasks']
      }]);
    } else {
      // Use Groq API for intelligent responses
      try {
        const response = await axios.post(`${API_URL}/ai/chat`,
          { message },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setCaffeenaMessages(prev => [...prev, {
          role: 'assistant',
          content: response.data.message,
          suggestions: response.data.suggestions || ['Show my tasks', 'Show inbox', 'Help']
        }]);
      } catch (error) {
        setCaffeenaMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I can help you with emails, tasks, and more. Try asking me to summarize an email, extract tasks, or generate a reply!',
          suggestions: ['Summarize current email', 'Extract tasks', 'Generate reply', 'Show my tasks']
        }]);
      }
    }
  };

  const summarizeEmail = async () => {
    if (!selectedMail) return;
    try {
      const response = await axios.post(`${API_URL}/ai/summarize`,
        {
          sender: selectedMail.sender?.username || 'Unknown',
          subject: selectedMail.subject,
          body: selectedMail.body
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAiAnalysis(response.data.analysis);
      setShowAiPanel(true);
    } catch (error) {
      console.error('Error summarizing email:', error);
      alert('Failed to summarize email');
    }
  };

  const generateReply = async (replyType = 'professional') => {
    if (!selectedMail) return;
    try {
      const response = await axios.post(`${API_URL}/ai/reply`,
        {
          sender: selectedMail.sender?.username || 'Unknown',
          subject: selectedMail.subject,
          body: selectedMail.body,
          replyType
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAiReply(response.data.reply);
      setShowAiPanel(true);
    } catch (error) {
      console.error('Error generating reply:', error);
      alert('Failed to generate reply');
    }
  };

  const extractTasks = async () => {
    if (!selectedMail) return;
    try {
      const response = await axios.post(`${API_URL}/ai/tasks`,
        {
          sender: selectedMail.sender?.username || 'Unknown',
          subject: selectedMail.subject,
          body: selectedMail.body,
          mailId: selectedMail._id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const extractedTasks = { tasks: response.data.tasks || [] };
      setAiTasks(extractedTasks);
      setShowAiPanel(true);
      // Refresh tasks after extraction
      await loadTasks();
      return extractedTasks;
    } catch (error) {
      console.error('Error extracting tasks:', error);
      alert('Failed to extract tasks');
      return null;
    }
  };

  const completeTask = async (taskId) => {
    try {
      await axios.put(`${API_URL}/tasks/${taskId}/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTasks();
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task');
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`${API_URL}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const useAiReply = () => {
    if (!aiReply) return;
    setComposeForm({
      to: selectedMail.sender?.email || '',
      subject: aiReply.subject,
      body: aiReply.body
    });
    setShowAiPanel(false);
    setShowCompose(true);
    setSelectedMail(null);
  };

  const handleCaffeenaSuggestion = (suggestion) => {
    const lower = suggestion.toLowerCase();
    if (lower.includes('use this reply') && aiReply) {
      useAiReply();
    } else {
      chatWithCaffeena(suggestion);
    }
  };

  return (
    <div className="main-app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🦅</span>
            <span className="logo-text">Hawk</span>
          </div>
        </div>
        
        <button className="compose-btn" onClick={() => setShowCompose(true)}>
          <span>✏️</span> Compose
        </button>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${currentView === 'inbox' ? 'active' : ''}`}
            onClick={() => setCurrentView('inbox')}
          >
            <span>📥</span> Inbox
            {inboxCount > 0 && <span className="badge">{inboxCount}</span>}
          </button>
          <button 
            className={`nav-item ${currentView === 'sent' ? 'active' : ''}`}
            onClick={() => setCurrentView('sent')}
          >
            <span>📤</span> Sent
          </button>
        </nav>
        
        <div className="caffeena-section">
          <div className="caffeena-avatar">☕</div>
          <div className="caffeena-name">Caffeena</div>
          <button className="btn-caffeena" onClick={() => {
            setShowCaffeena(true);
            askCaffeena('check_new_mail');
          }}>
            Ask Caffeena
          </button>
        </div>

        <div className="task-section">
          <div className="task-header">
            <span className="task-icon">📋</span>
            <span className="task-name">Tasks</span>
            <span className="task-count">{tasks.length}</span>
          </div>
          <button className="btn-tasks" onClick={() => setShowTaskPanel(!showTaskPanel)}>
            {showTaskPanel ? '✕' : '☰'}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Search in emails" />
          </div>
          <div className="user-info">
            <span>{user?.username}</span>
            <button className="btn-icon" onClick={onLogout}>🚪</button>
          </div>
        </header>

        <div className="content-views">
          {showCompose ? (
            <div className="view active">
              <div className="view-header">
                <h2>Compose Mail</h2>
                <button className="btn-secondary" onClick={() => setShowCompose(false)}>✕</button>
              </div>
              <form onSubmit={handleCompose} className="compose-form">
                <input
                  type="email"
                  placeholder="To"
                  value={composeForm.to}
                  onChange={(e) => setComposeForm({...composeForm, to: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({...composeForm, subject: e.target.value})}
                  required
                />
                <textarea
                  placeholder="Write your message..."
                  value={composeForm.body}
                  onChange={(e) => setComposeForm({...composeForm, body: e.target.value})}
                  required
                />
                <div className="compose-actions">
                  <button type="submit" className="btn-primary">Send</button>
                </div>
              </form>
            </div>
          ) : selectedMail ? (
            <div className="view active">
              <div className="view-header">
                <button className="btn-secondary" onClick={() => setSelectedMail(null)}>← Back</button>
                <div className="action-buttons">
                  <button className="btn-icon" onClick={handleDelete}>🗑️</button>
                </div>
              </div>
              <div className="mail-detail">
                <div className="mail-detail-header">
                  <div className="mail-detail-subject">{selectedMail.subject}</div>
                  <div className="mail-detail-meta">
                    <span>From: {selectedMail.sender?.username || 'Unknown'}</span>
                    <span>{new Date(selectedMail.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="mail-detail-body">{selectedMail.body}</div>
              </div>
            </div>
          ) : (
            <div className="view active">
              <div className="view-header">
                <h2>{currentView === 'inbox' ? 'Inbox' : 'Sent'}</h2>
              </div>
              <div className="mail-list">
                {mails.length === 0 ? (
                  <p className="empty-state">No mails found</p>
                ) : (
                  mails.map(mail => (
                    <div 
                      key={mail._id} 
                      className={`mail-item ${!mail.isRead ? 'unread' : ''}`}
                      onClick={() => handleMailClick(mail)}
                    >
                      <div className="mail-checkbox"></div>
                      <div className="mail-content">
                        <div className="mail-header">
                          <span className="mail-sender">
                            {currentView === 'inbox' ? mail.sender?.username : mail.recipient?.username}
                          </span>
                          <span className="mail-date">
                            {new Date(mail.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mail-subject">{mail.subject}</div>
                        <div className="mail-preview">{mail.body.substring(0, 100)}...</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {showCaffeena && (
        <div className="modal" onClick={() => setShowCaffeena(false)}>
          <div className="modal-content caffeena-chat" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="caffeena-header">
                <span className="caffeena-avatar-large">☕</span>
                <div>
                  <h3>Caffeena</h3>
                  <p className="caffeena-status">Your Intelligent Email Assistant</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setShowCaffeena(false)}>✕</button>
            </div>
            <div className="modal-body caffeena-chat-body">
              <div className="caffeena-messages chat">
                {caffeenaMessages.map((msg, i) => (
                  <div key={i} className={`caffeena-message chat ${msg.role}`}>
                    {msg.role === 'assistant' && <span className="message-avatar">☕</span>}
                    <div className="message-content">
                      <p>{msg.content}</p>
                      {msg.analysis && (
                        <div className="caffeena-analysis-mini">
                          <p><strong>Summary:</strong> {msg.analysis.summary}</p>
                          <p><strong>Priority:</strong> {msg.analysis.priority}</p>
                          <p><strong>Action Items:</strong> {msg.analysis.action_items?.join(', ') || 'None'}</p>
                        </div>
                      )}
                      {msg.tasks && msg.tasks.tasks?.length > 0 && (
                        <div className="caffeena-tasks-mini">
                          <p><strong>Tasks found:</strong> {msg.tasks.tasks.length}</p>
                          {msg.tasks.tasks.map((task, j) => (
                            <p key={j}>• {task.description} ({task.priority})</p>
                          ))}
                        </div>
                      )}
                      {msg.reply && (
                        <div className="caffeena-reply-mini">
                          <p><strong>Subject:</strong> {msg.reply.subject}</p>
                          <p><strong>Reply:</strong> {msg.reply.body.substring(0, 100)}...</p>
                          <button className="btn-small" onClick={useAiReply}>Use This Reply</button>
                        </div>
                      )}
                      {msg.suggestions && (
                        <div className="caffeena-suggestions">
                          {msg.suggestions.map((suggestion, j) => (
                            <button
                              key={j}
                              className="suggestion-btn"
                              onClick={() => handleCaffeenaSuggestion(suggestion)}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="caffeena-input-area">
                <input
                  type="text"
                  placeholder="Ask Caffeena anything..."
                  value={caffeenaInput}
                  onChange={(e) => setCaffeenaInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && chatWithCaffeena(caffeenaInput)}
                />
                <button className="btn-send" onClick={() => chatWithCaffeena(caffeenaInput)}>Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAiPanel && (
        <div className="modal" onClick={() => setShowAiPanel(false)}>
          <div className="modal-content ai-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>☕ Caffeena AI Analysis</h3>
              <button className="btn-icon" onClick={() => setShowAiPanel(false)}>✕</button>
            </div>
            <div className="modal-body">
              {aiAnalysis && (
                <div className="ai-analysis">
                  <h4>📝 Summary</h4>
                  <p>{aiAnalysis.summary}</p>

                  <h4>✅ Action Items</h4>
                  <ul>
                    {aiAnalysis.action_items?.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>

                  <h4>🛠️ Tech Stack</h4>
                  <p>{aiAnalysis.tech_stack?.join(', ') || 'None mentioned'}</p>

                  <h4>📅 Deadline</h4>
                  <p>{aiAnalysis.deadline || 'Not specified'}</p>

                  <h4>⚡ Priority</h4>
                  <p>{aiAnalysis.priority}</p>

                  <h4>↩️ Reply Required</h4>
                  <p>{aiAnalysis.reply_required ? 'Yes' : 'No'}</p>
                </div>
              )}

              {aiReply && (
                <div className="ai-reply">
                  <h4>💬 Suggested Reply</h4>
                  <div className="reply-content">
                    <p><strong>Subject:</strong> {aiReply.subject}</p>
                    <p><strong>Body:</strong></p>
                    <pre>{aiReply.body}</pre>
                  </div>
                  <button className="btn-primary" onClick={useAiReply}>Use This Reply</button>
                </div>
              )}

              {aiTasks && (
                <div className="ai-tasks">
                  <h4>📋 Extracted Tasks</h4>
                  {aiTasks.tasks?.length > 0 ? (
                    <ul>
                      {aiTasks.tasks.map((task, i) => (
                        <li key={i} className="task-item">
                          <strong>{task.description}</strong>
                          <div className="task-meta">
                            <span>Priority: {task.priority}</span>
                            <span>Due: {task.due_date || 'Not specified'}</span>
                            <span>Assigned: {task.assigned_to || 'Not specified'}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No tasks found in this email.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTaskPanel && (
        <div className="task-panel slide-in">
          <div className="task-panel-header">
            <h3>📋 My Tasks</h3>
            <button className="btn-icon" onClick={() => setShowTaskPanel(false)}>✕</button>
          </div>
          <div className="task-panel-body">
            {tasks.length === 0 ? (
              <p className="empty-tasks">No active tasks</p>
            ) : (
              <div className="task-list">
                {tasks.map(task => (
                  <div key={task._id} className="task-card">
                    <div className="task-card-header">
                      <span className={`task-priority ${task.priority}`}>{task.priority}</span>
                      <div className="task-card-actions">
                        <button className="btn-icon-small" onClick={() => completeTask(task._id)} title="Complete">✓</button>
                        <button className="btn-icon-small" onClick={() => deleteTask(task._id)} title="Delete">🗑️</button>
                      </div>
                    </div>
                    <h4 className="task-title">{task.title}</h4>
                    <p className="task-description">{task.description}</p>
                    {task.dueDate && (
                      <p className="task-due">📅 Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                    )}
                    {task.assignedTo && (
                      <p className="task-assigned">👤 Assigned: {task.assignedTo}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MainApp;
