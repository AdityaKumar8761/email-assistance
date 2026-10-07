import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './MainApp.css';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000/api`;

const formatDateOnly = (value) => {
  const dateText = typeof value === 'string' ? value.slice(0, 10) : '';
  const dateParts = dateText.split('-').map(Number);
  if (dateParts.length === 3 && dateParts.every(Number.isFinite)) {
    return new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toLocaleDateString();
  }
  return new Date(value).toLocaleDateString();
};

const getPersonLabel = (person) => {
  if (!person) return 'Unknown';
  if (typeof person === 'string') {
    return /^[a-f\d]{24}$/i.test(person) ? 'Unknown' : person;
  }
  return person.nickname || person.username || person.email || 'Unknown';
};

const dedupeMails = (mailList) => {
  const unique = new Map();
  mailList.filter(mail => mail?._id).forEach(mail => unique.set(mail._id, mail));
  return Array.from(unique.values()).sort(
    (first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)
  );
};

function MainApp({ user, onLogout }) {
  const [currentView, setCurrentView] = useState('inbox');
  const [mails, setMails] = useState([]);
  const [selectedMail, setSelectedMail] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({ to: '', subject: '', body: '' });
  const [composeAttachments, setComposeAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isImprovingDraft, setIsImprovingDraft] = useState(false);
  const [showCaffeena, setShowCaffeena] = useState(false);
  const [caffeenaResponse, setCaffeenaResponse] = useState(null);
  const [caffeenaMessages, setCaffeenaMessages] = useState([]);
  const [caffeenaInput, setCaffeenaInput] = useState('');
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastSpokenMessageIndexRef = useRef(-1);
  const fileInputRef = useRef(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiReply, setAiReply] = useState(null);
  const [aiTasks, setAiTasks] = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [profileUser, setProfileUser] = useState(user);
  const [showProfile, setShowProfile] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const profileFileInputRef = useRef(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [newMailNotice, setNewMailNotice] = useState(null);
  const initialInboxLoadedRef = useRef(false);
  const knownMailIdsRef = useRef(new Set());
  const swipeStartRef = useRef(null);
  const [swipeOffsets, setSwipeOffsets] = useState({});

  const token = localStorage.getItem('token');
  const cacheIdentity = profileUser?._id || user?._id || user?.email || 'current';
  const inboxCacheKey = `hawk:mail-cache:${cacheIdentity}:inbox`;
  const sentCacheKey = `hawk:mail-cache:${cacheIdentity}:sent`;

  const readMailCache = (key) => {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(cached) ? dedupeMails(cached) : [];
    } catch (error) {
      console.warn('Unable to read local mail cache:', error);
      return [];
    }
  };

  const writeMailCache = (key, mailList) => {
    try {
      localStorage.setItem(key, JSON.stringify(dedupeMails(mailList)));
    } catch (error) {
      console.warn('Unable to save local mail cache:', error);
    }
  };

  const setDisplayedMails = (mailList, cacheKey = null) => {
    const uniqueMails = dedupeMails(mailList);
    setMails(uniqueMails);
    setInboxCount(uniqueMails.filter(mail => !mail.isRead).length);
    if (cacheKey) writeMailCache(cacheKey, uniqueMails);
  };

  useEffect(() => {
    if (currentView === 'inbox') loadInbox();
    else if (currentView === 'sent') loadSent();
  }, [currentView]);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await axios.get(`${API_URL}/auth/profile`, {
          headers: { Authorization: 'Bearer ' + token }
        });
        setProfileUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };
    if (token) loadProfile();
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const pollInbox = async () => {
      try {
        const response = await axios.get(`${API_URL}/mail/inbox`, {
          headers: { Authorization: 'Bearer ' + token }
        });
        const nextMails = response.data.mails;
        const nextIds = new Set(nextMails.map(mail => mail._id));
        if (initialInboxLoadedRef.current) {
          const newMail = nextMails.find(mail => !knownMailIdsRef.current.has(mail._id));
          if (newMail) {
            setNewMailNotice(newMail);
            playMailNotification();
          }
        } else {
          initialInboxLoadedRef.current = true;
        }
        knownMailIdsRef.current = nextIds;
        if (currentView === 'inbox') {
          setDisplayedMails(nextMails, inboxCacheKey);
        }
      } catch (error) {
        console.error('Error refreshing inbox:', error);
      }
    };
    pollInbox();
    const interval = window.setInterval(pollInbox, 10000);
    return () => window.clearInterval(interval);
  }, [currentView, token, inboxCacheKey]);

  const playMailNotification = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
      oscillator.addEventListener('ended', () => context.close());
    } catch (error) {
      console.warn('Mail notification sound unavailable:', error);
    }
  };

  const stopVoiceListening = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const speakText = (text) => {
    if (!window.speechSynthesis || !text?.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const startVoiceListening = () => {
    if (!voiceModeEnabled) {
      alert('Turn on Caffeena voice chat first.');
      return;
    }
    if (isListening) {
      stopVoiceListening();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        setCaffeenaInput(transcript);
        chatWithCaffeena(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Voice input error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const handleVoiceToggle = () => {
    setVoiceModeEnabled(current => {
      if (!current) {
        lastSpokenMessageIndexRef.current = caffeenaMessages.length - 1;
      } else {
        stopVoiceListening();
      }
      return !current;
    });
  };

  const openProfile = async () => {
    setShowProfile(true);
    try {
      const response = await axios.get(`${API_URL}/auth/profile`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      setProfileUser(response.data.user);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const changeAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) ||
        file.size > 10 * 1024 * 1024) {
      alert('Choose a JPG, PNG, WEBP, or GIF image up to 10 MB.');
      event.target.value = '';
      return;
    }
    setIsSavingAvatar(true);
    try {
      const saved = await axios.post(`${API_URL}/auth/profile/avatar/upload`, file, {
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': file.type
        },
        maxBodyLength: 10 * 1024 * 1024,
        maxContentLength: 10 * 1024 * 1024
      });
      setProfileUser(saved.data.user);
      localStorage.setItem('user', JSON.stringify(saved.data.user));
    } catch (error) {
      const detail = error.response?.data?.message || error.message;
      alert(`Failed to update profile picture: ${detail}. If this mentions CORS, add ${window.location.origin} to the mailhawk S3 bucket CORS policy.`);
    } finally {
      setIsSavingAvatar(false);
      event.target.value = '';
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setIsSavingProfile(true);
    try {
      const response = await axios.put(`${API_URL}/auth/profile`, {
        nickname: profileUser.nickname || '',
        companyName: profileUser.companyName || '',
        bio: profileUser.bio || ''
      }, { headers: { Authorization: 'Bearer ' + token } });
      setProfileUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      alert('Profile updated successfully.');
    } catch (error) {
      alert(`Failed to update profile: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleProfileDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) changeAvatar({ target: { files: [file], value: '' } });
  };

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [caffeenaMessages]);

  useEffect(() => {
    if (!voiceModeEnabled) {
      stopVoiceListening();
      window.speechSynthesis?.cancel();
      return;
    }

    const lastIndex = caffeenaMessages.length - 1;
    const lastMessage = caffeenaMessages[lastIndex];
    if (
      lastMessage &&
      lastMessage.role === 'assistant' &&
      lastSpokenMessageIndexRef.current !== lastIndex
    ) {
      lastSpokenMessageIndexRef.current = lastIndex;
      speakText(lastMessage.content);
    }
  }, [caffeenaMessages, voiceModeEnabled]);

  useEffect(() => () => {
    stopVoiceListening();
    window.speechSynthesis?.cancel();
  }, []);

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
    const cachedMails = readMailCache(inboxCacheKey);
    if (cachedMails.length > 0) setDisplayedMails(cachedMails);
    try {
      const response = await axios.get(`${API_URL}/mail/inbox`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDisplayedMails(response.data.mails, inboxCacheKey);
    } catch (error) {
      console.error('Error loading inbox:', error);
    }
  };

  const searchInboxWithCaffeena = async (message) => {
    const fromMatch = message.match(/\b(?:from|by)\s+(.+?)(?=\s+(?:about|regarding|with|containing|that|which)\b|$)/i);
    const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const queryMatch = message.match(/\b(?:about|regarding|containing|with the word|for)\s+["']?(.+?)["']?$/i);
    const params = new URLSearchParams();
    const from = emailMatch?.[0] || fromMatch?.[1]?.trim();
    const query = queryMatch?.[1]?.trim();
    const unread = /\bunread|new\b/i.test(message);
    const read = /\bread\b/i.test(message) && !unread;

    if (from) params.set('from', from);
    if (query && !/^mail|emails?$/i.test(query)) params.set('q', query);
    if (unread) params.set('unread', 'true');
    if (read) params.set('read', 'true');

    try {
      const response = await axios.get(`${API_URL}/mail/search?${params.toString()}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      setDisplayedMails(response.data.mails);
      setCurrentView('inbox');
      setSelectedMail(null);
      setShowCompose(false);
      const filters = [
        from && `from ${from}`,
        query && `about "${query}"`,
        unread && 'unread',
        read && 'read'
      ].filter(Boolean);
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.mails.length
          ? `I found ${response.data.mails.length} email${response.data.mails.length === 1 ? '' : 's'}${filters.length ? ` ${filters.join(', ')}` : ''}.`
          : `I couldn't find any emails${filters.length ? ` ${filters.join(', ')}` : ''}.`,
        suggestions: ['Show my inbox', 'Find unread emails', 'Find emails about today']
      }]);
    } catch (error) {
      console.error('Error searching inbox with Caffeena:', error);
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I could not search your inbox right now. Please try again.',
        suggestions: ['Show my inbox', 'Find unread emails']
      }]);
    }
  };

  const loadSent = async () => {
    const cachedMails = readMailCache(sentCacheKey);
    if (cachedMails.length > 0) setDisplayedMails(cachedMails);
    try {
      const response = await axios.get(`${API_URL}/mail/sent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDisplayedMails(response.data.mails, sentCacheKey);
    } catch (error) {
      console.error('Error loading sent:', error);
    }
  };

  const handleCompose = async (e) => {
    e.preventDefault();
    setIsSending(true);
    try {
      let attachments = [];
      if (composeAttachments.length > 0) {
        attachments = await Promise.all(composeAttachments.map(async (file) => {
          if (file.size <= 25 * 1024 * 1024) {
            const response = await axios.post(`${API_URL}/mail/attachments/upload`, file, {
              headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': file.type || 'application/octet-stream',
                'X-File-Name': encodeURIComponent(file.name)
              },
              maxBodyLength: 25 * 1024 * 1024,
              maxContentLength: 25 * 1024 * 1024
            });
            return response.data.attachment;
          }

          const initiateResponse = await axios.post(`${API_URL}/mail/attachments/multipart/initiate`, {
            files: [{
              name: file.name,
              type: file.type || 'application/octet-stream',
              size: file.size
            }]
          }, {
            headers: { Authorization: 'Bearer ' + token }
          });
          const attachment = initiateResponse.data.attachments[0];
          try {
            const parts = [];
            for (let start = 0, partNumber = 1; start < file.size; start += attachment.partSize, partNumber += 1) {
              parts.push({ partNumber, blob: file.slice(start, Math.min(start + attachment.partSize, file.size)) });
            }
            const uploadedParts = [];

            for (let start = 0; start < parts.length; start += 100) {
              const batch = parts.slice(start, start + 100);
              const presignResponse = await axios.post(`${API_URL}/mail/attachments/multipart/presign`, {
                key: attachment.key,
                uploadId: attachment.uploadId,
                partNumbers: batch.map(part => part.partNumber)
              }, { headers: { Authorization: 'Bearer ' + token } });

              const uploaded = await Promise.all(presignResponse.data.urls.map(async ({ partNumber, url }) => {
                let response;
                for (let attempt = 0; attempt < 3; attempt += 1) {
                  response = await fetch(url, { method: 'PUT', body: batch.find(part => part.partNumber === partNumber).blob });
                  if (response.ok) break;
                }
                const etag = response?.headers.get('ETag');
                if (!response?.ok || !etag) throw new Error(`Upload failed for ${file.name}, part ${partNumber}`);
                return { ETag: etag, PartNumber: partNumber };
              }));
              uploadedParts.push(...uploaded);
            }

            await axios.post(`${API_URL}/mail/attachments/multipart/complete`, {
              key: attachment.key,
              uploadId: attachment.uploadId,
              parts: uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber)
            }, { headers: { Authorization: 'Bearer ' + token } });
            return attachment;
          } catch (error) {
            await axios.delete(`${API_URL}/mail/attachments/multipart`, {
              data: { key: attachment.key, uploadId: attachment.uploadId },
              headers: { Authorization: 'Bearer ' + token }
            }).catch(() => {});
            throw error;
          }
        }));
      }

      await axios.post(`${API_URL}/mail/send`, {
        recipientEmail: composeForm.to,
        subject: composeForm.subject,
        body: composeForm.body,
        attachments
      }, {
        headers: { Authorization: 'Bearer ' + token }
      });
      alert('Mail sent successfully!');
      setComposeForm({ to: '', subject: '', body: '' });
      setComposeAttachments([]);
      setShowCompose(false);
      setCurrentView('sent');
    } catch (error) {
      console.error('Error sending mail:', error);
      alert(`Failed to send mail: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const improveComposeDraft = async () => {
    if (!composeForm.subject.trim() || !composeForm.body.trim()) {
      alert('Enter a subject and message before improving the draft.');
      return;
    }
    setIsImprovingDraft(true);
    try {
      const response = await axios.post(`${API_URL}/ai/improve-draft`, {
        subject: composeForm.subject,
        body: composeForm.body
      }, {
        headers: { Authorization: 'Bearer ' + token }
      });
      setComposeForm(current => ({
        ...current,
        subject: response.data.draft.subject,
        body: response.data.draft.body
      }));
    } catch (error) {
      console.error('Error improving compose draft:', error);
      alert(`Failed to improve draft: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsImprovingDraft(false);
    }
  };

  const handleAttachmentSelection = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 10) {
      alert('You can attach up to 10 files per mail.');
      event.target.value = '';
      return;
    }
    const oversized = files.find(file => file.size > 50 * 1024 * 1024 * 1024);
    if (oversized) {
      alert(`${oversized.name} is larger than the 50 GB limit.`);
      event.target.value = '';
      return;
    }
    setComposeAttachments(files);
  };

  const downloadAttachment = async (mailId, attachmentId) => {
    try {
      const response = await axios.get(
        `${API_URL}/mail/${mailId}/attachments/${attachmentId}`,
        { headers: { Authorization: 'Bearer ' + token } }
      );
      window.open(response.data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      alert(`Failed to download attachment: ${error.response?.data?.message || error.message}`);
    }
  };

  const deleteMail = async (mailId) => {
    try {
      await axios.delete(`${API_URL}/mail/${mailId}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      setMails(current => {
        const next = current.filter(mail => mail._id !== mailId);
        writeMailCache(currentView === 'inbox' ? inboxCacheKey : sentCacheKey, next);
        return next;
      });
      setSelectedMail(current => current?._id === mailId ? null : current);
      setSwipeOffsets(current => {
        const next = { ...current };
        delete next[mailId];
        return next;
      });
    } catch (error) {
      alert(`Failed to delete mail: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleMailPointerDown = (event, mailId) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    swipeStartRef.current = { mailId, x: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleMailPointerMove = (event, mailId) => {
    const swipe = swipeStartRef.current;
    if (!swipe || swipe.mailId !== mailId) return;
    const offset = Math.max(0, Math.min(event.clientX - swipe.x, 140));
    if (offset > 0) setSwipeOffsets(current => ({ ...current, [mailId]: offset }));
  };

  const handleMailPointerUp = (event, mailId) => {
    const swipe = swipeStartRef.current;
    if (!swipe || swipe.mailId !== mailId) return;
    const offset = event.clientX - swipe.x;
    swipeStartRef.current = null;
    if (offset >= 100) {
      deleteMail(mailId);
    } else {
      setSwipeOffsets(current => ({ ...current, [mailId]: 0 }));
    }
  };

  const handleMailClick = async (mail) => {
    setSelectedMail(mail);
    if (!mail.isRead && currentView === 'inbox') {
      const readMail = { ...mail, isRead: true };
      setDisplayedMails(
        mails.map(currentMail => currentMail._id === mail._id ? readMail : currentMail),
        inboxCacheKey
      );
      setSelectedMail(readMail);
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
      setCaffeenaMessages(prev => [
        ...prev,
        { role: 'assistant', content: response.data.message, suggestions: response.data.suggestions }
      ]);
    } catch (error) {
      console.error('Error asking Caffeena:', error);
    }
  };

  const draftEmailWithCaffeena = async (message) => {
    const recipientMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const recipientEmail = recipientMatch?.[0] || '';

    try {
      const response = await axios.post(
        `${API_URL}/ai/write`,
        { task: message },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      const email = response.data.email || {};
      const to = email.recipient || recipientEmail;

      if (!to || !email.subject || !email.body) {
        throw new Error('The email draft was incomplete');
      }

      setComposeForm({
        to,
        subject: email.subject,
        body: email.body
      });
      setComposeAttachments([]);
      setShowCaffeena(false);
      setShowCompose(true);
    } catch (error) {
      console.error('Error drafting email with Caffeena:', error);
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I could not create a complete draft. Please include the recipient and what you want the email to say, then try again.',
        suggestions: ['Draft a generic task regeneration request', 'Compose email']
      }]);
    }
  };

  const chatWithCaffeena = async (message) => {
    if (!message.trim()) return;

    setCaffeenaMessages(prev => [...prev, { role: 'user', content: message }]);
    setCaffeenaInput('');

    // Parse the user's intent
    const lowerMessage = message.toLowerCase();

    const requestsEmail = (
      (lowerMessage.includes('send') || lowerMessage.includes('draft') || lowerMessage.includes('compose')) &&
      (lowerMessage.includes('mail') || lowerMessage.includes('email')) &&
      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(message)
    );
    const searchesInbox = (
      (lowerMessage.includes('find') || lowerMessage.includes('search') || lowerMessage.includes('look for')) &&
      (lowerMessage.includes('mail') || lowerMessage.includes('email') || lowerMessage.includes('inbox'))
    );
    const asksAboutMail = (
      (lowerMessage.includes('mail') || lowerMessage.includes('email')) &&
      (
        lowerMessage.includes('read') ||
        lowerMessage.includes('unread') ||
        lowerMessage.includes('from ') ||
        lowerMessage.includes('by ') ||
        lowerMessage.includes('is there') ||
        lowerMessage.includes('do i have')
      )
    );

    if (requestsEmail) {
      await draftEmailWithCaffeena(message);
    } else if (searchesInbox || asksAboutMail) {
      await searchInboxWithCaffeena(message);
    } else if (
      (lowerMessage.includes('inbox') && (
        lowerMessage.includes('show') ||
        lowerMessage.includes('open') ||
        lowerMessage.includes('check') ||
        lowerMessage.includes('go')
      )) ||
      lowerMessage.trim() === 'inbox'
    ) {
      setCurrentView('inbox');
      setSelectedMail(null);
      setShowCompose(false);
      setShowCaffeena(false);
      await loadInbox();
      setCaffeenaMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Your inbox is open and refreshed.',
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
          sender: getPersonLabel(selectedMail.sender),
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

  const readSummaryAloud = () => {
    if (!aiAnalysis?.summary) {
      alert('Summarize the email first, then I can read the summary aloud.');
      return;
    }
    speakText(aiAnalysis.summary);
  };

  const generateReply = async (replyType = 'professional') => {
    if (!selectedMail) return;
    try {
      const response = await axios.post(`${API_URL}/ai/reply`,
        {
          sender: getPersonLabel(selectedMail.sender),
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
          sender: getPersonLabel(selectedMail.sender),
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
            <button className="profile-trigger" onClick={openProfile} title="Open profile">
              {profileUser?.avatarUrl ? (
                <img src={profileUser.avatarUrl} alt="" className="user-avatar" />
              ) : (
                <span className="user-avatar user-avatar-fallback">{profileUser?.username?.[0]?.toUpperCase()}</span>
              )}
              <span className="profile-trigger-text">
                <strong>{profileUser?.nickname || profileUser?.username}</strong>
                <small>Account settings</small>
              </span>
            </button>
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
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleAttachmentSelection}
                  hidden
                />
                <div className="compose-attachments">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📎 Attach files
                  </button>
                  {composeAttachments.map(file => (
                    <span key={`${file.name}-${file.lastModified}`} className="attachment-chip">
                      {file.name}
                    </span>
                  ))}
                </div>
                <div className="compose-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={improveComposeDraft}
                    disabled={isImprovingDraft || isSending}
                  >
                    {isImprovingDraft ? 'Improving...' : '✨ Fix grammar & format'}
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSending}>
                    {isSending ? 'Uploading...' : 'Send'}
                  </button>
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
                    <span className="mail-author">
                      {(currentView === 'inbox' ? selectedMail.sender : selectedMail.recipient)?.avatarUrl && (
                        <img
                          src={(currentView === 'inbox' ? selectedMail.sender : selectedMail.recipient).avatarUrl}
                          alt=""
                          className="mail-avatar"
                        />
                      )}
                      {currentView === 'inbox' ? 'From' : 'To'}: {
                        getPersonLabel(currentView === 'inbox' ? selectedMail.sender : selectedMail.recipient)
                      }
                    </span>
                    <span>{new Date(selectedMail.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="mail-detail-body">{selectedMail.body}</div>
                <div className="mail-ai-actions">
                  <div className="mail-ai-stack">
                    <button type="button" className="btn-secondary" onClick={summarizeEmail}>
                      📝 Summarize
                    </button>
                    {/* <button
                      type="button"
                      className="btn-secondary"
                      onClick={readSummaryAloud}
                      disabled={!aiAnalysis?.summary}
                    >
                      🔊 Read summary
                    </button> */}
                  </div>
                  <button type="button" className="btn-secondary" onClick={extractTasks}>
                    ✅ Extract tasks
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => generateReply()}>
                    ↩️ Generate reply
                  </button>
                </div>
                {selectedMail.attachments?.length > 0 && (
                  <div className="mail-attachments">
                    <h4>Attachments</h4>
                    {selectedMail.attachments.map(attachment => (
                      <button
                        key={attachment._id}
                        type="button"
                        className="attachment-download"
                        onClick={() => downloadAttachment(selectedMail._id, attachment._id)}
                      >
                        📎 {attachment.name}
                      </button>
                    ))}
                  </div>
                )}
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
                      style={{ transform: `translateX(${swipeOffsets[mail._id] || 0}px)` }}
                      onClick={() => handleMailClick(mail)}
                      onPointerDown={event => handleMailPointerDown(event, mail._id)}
                      onPointerMove={event => handleMailPointerMove(event, mail._id)}
                      onPointerUp={event => handleMailPointerUp(event, mail._id)}
                    >
                      <div className="mail-checkbox"></div>
                      <div className="mail-content">
                        <div className="mail-header">
                          <span className="mail-sender">
                            <span className="mail-author">
                              {(currentView === 'inbox' ? mail.sender : mail.recipient)?.avatarUrl ? (
                                <img
                                  src={(currentView === 'inbox' ? mail.sender : mail.recipient).avatarUrl}
                                  alt=""
                                  className="mail-avatar"
                                />
                              ) : (
                                <span className="mail-avatar mail-avatar-fallback">
                                  {getPersonLabel(currentView === 'inbox' ? mail.sender : mail.recipient)[0]?.toUpperCase()}
                                </span>
                              )}
                              {getPersonLabel(currentView === 'inbox' ? mail.sender : mail.recipient)}
                            </span>
                          </span>
                          <span className="mail-date">
                            {new Date(mail.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mail-subject">{mail.subject}</div>
                        <div className="mail-preview">{mail.body.substring(0, 100)}...</div>
                      </div>
                      <button
                        type="button"
                        className="mail-delete-button"
                        title="Delete mail"
                        aria-label={`Delete ${mail.subject}`}
                        onPointerDown={event => event.stopPropagation()}
                        onClick={event => {
                          event.stopPropagation();
                          deleteMail(mail._id);
                        }}
                      >
                        🗑️
                      </button>
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
            <div className="caffeena-header-actions">
              <button
                type="button"
                className={`voice-toggle ${voiceModeEnabled ? 'active' : ''}`}
                onClick={handleVoiceToggle}
              >
                {voiceModeEnabled ? '🎙️ Voice on' : '🔈 Voice off'}
              </button>
              <button className="btn-icon" onClick={() => setShowCaffeena(false)}>✕</button>
            </div>
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
                <button
                  type="button"
                  className={`btn-secondary voice-listen-btn ${isListening ? 'listening' : ''}`}
                  onClick={startVoiceListening}
                  disabled={!voiceModeEnabled}
                  title={voiceModeEnabled ? 'Speak your prompt' : 'Enable voice mode first'}
                >
                  {isListening ? '⏹ Stop' : '🎤 Mic'}
                </button>
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
                  <button type="button" className="btn-secondary ai-read-summary" onClick={readSummaryAloud}>
                    🔊 Read summary aloud
                  </button>

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
                      <p className="task-due">📅 Due: {formatDateOnly(task.dueDate)}</p>
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

      {showProfile && (
              <div className="modal" onClick={() => setShowProfile(false)}>
                <div className="modal-content profile-panel" onClick={event => event.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Profile</h3>
                    <button className="btn-icon" onClick={() => setShowProfile(false)}>✕</button>
                  </div>
                  <div className="modal-body profile-body">
                    {profileUser?.avatarUrl ? (
                      <img src={profileUser.avatarUrl} alt="Profile" className="profile-avatar" />
                    ) : (
                      <div className="profile-avatar profile-avatar-fallback">
                        {profileUser?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <h3>{profileUser?.username}</h3>
                    <p>{profileUser?.email}</p>
                    <input
                      ref={profileFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={changeAvatar}
                      hidden
                    />
                    <form onSubmit={saveProfile}>
                      <div
                        className="profile-dropzone"
                        onDragOver={event => event.preventDefault()}
                        onDrop={handleProfileDrop}
                        onClick={() => profileFileInputRef.current?.click()}
                      >
                        Drop an image here or click to choose
                      </div>
                      <label>
                        Nickname
                        <input
                          value={profileUser?.nickname || ''}
                          maxLength={80}
                          onChange={event => setProfileUser({ ...profileUser, nickname: event.target.value })}
                        />
                      </label>
                      <label>
                        Company
                        <input
                          value={profileUser?.companyName || ''}
                          maxLength={120}
                          onChange={event => setProfileUser({ ...profileUser, companyName: event.target.value })}
                        />
                      </label>
                      <label>
                        Bio
                        <textarea
                          value={profileUser?.bio || ''}
                          maxLength={500}
                          onChange={event => setProfileUser({ ...profileUser, bio: event.target.value })}
                        />
                      </label>
                      <button type="submit" className="btn-primary" disabled={isSavingProfile || isSavingAvatar}>
                        {isSavingProfile ? 'Saving...' : 'Save profile'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
      )}

      {newMailNotice && (
        <button className="new-mail-notice" onClick={() => {
          setNewMailNotice(null);
          setCurrentView('inbox');
        }}>
          <strong>New mail from {newMailNotice.sender?.username || 'someone'}</strong>
          <span>{newMailNotice.subject}</span>
        </button>
      )}
    </div>
  );
}

export default MainApp;
