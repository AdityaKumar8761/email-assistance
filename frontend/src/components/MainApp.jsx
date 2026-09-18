import { useState, useEffect } from 'react';
import axios from 'axios';
import './MainApp.css';

const API_URL = 'http://localhost:3000/api';

function MainApp({ user, onLogout }) {
  const [currentView, setCurrentView] = useState('inbox');
  const [mails, setMails] = useState([]);
  const [selectedMail, setSelectedMail] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({ to: '', subject: '', body: '' });
  const [showCaffeena, setShowCaffeena] = useState(false);
  const [caffeenaResponse, setCaffeenaResponse] = useState(null);
  const [inboxCount, setInboxCount] = useState(0);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (currentView === 'inbox') loadInbox();
    else if (currentView === 'sent') loadSent();
  }, [currentView]);

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
    } catch (error) {
      console.error('Error asking Caffeena:', error);
    }
  };

  const handleCaffeenaSuggestion = (suggestion) => {
    const lower = suggestion.toLowerCase();
    if (lower.includes('read now') || lower.includes('read anyway')) {
      setShowCaffeena(false);
      setCurrentView('inbox');
    } else if (lower.includes('mark as spam') || lower.includes('delete')) {
      if (selectedMail) handleDelete();
      setShowCaffeena(false);
    } else if (lower.includes('spam check')) {
      askCaffeena('spam_check');
    } else if (lower.includes('analyze')) {
      if (selectedMail) askCaffeena('analyze_mail', selectedMail.body);
    } else if (lower.includes('suggest reply')) {
      if (selectedMail) askCaffeena('suggest_reply', selectedMail.body);
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
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="caffeena-header">
                <span className="caffeena-avatar-large">☕</span>
                <div>
                  <h3>Caffeena</h3>
                  <p className="caffeena-status">Your Email Assistant</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setShowCaffeena(false)}>✕</button>
            </div>
            <div className="modal-body">
              {caffeenaResponse && (
                <>
                  <div className="caffeena-messages">
                    <div className="caffeena-message">
                      <strong>{caffeenaResponse.agent}:</strong> {caffeenaResponse.message}
                    </div>
                  </div>
                  <div className="caffeena-suggestions">
                    {caffeenaResponse.suggestions?.map((suggestion, i) => (
                      <button 
                        key={i} 
                        className="suggestion-btn"
                        onClick={() => handleCaffeenaSuggestion(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainApp;
