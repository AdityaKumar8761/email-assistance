import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const API_URL = 'http://localhost:3000/api';

function Register({ onLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post(`${API_URL}/auth/register`, { username, email, password });
      onLogin(response.data.token, response.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="logo">
          <span className="logo-icon">🦅</span>
          <span className="logo-text">Hawk Mail</span>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Register</h2>
          {error && <div className="error-message">{error}</div>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            autoFocus
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <button type="submit" className="btn-primary">Register</button>
        </form>
        
        <div className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
