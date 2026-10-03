# Hawk Mail System

A full-stack email application with React frontend and Rust backend, featuring an AI-powered assistant named Caffeena.

## Rust Backend

The active backend is in `backend-rust/`. It implements the same `/api` contract as the original Node service, including JWT authentication, password hashing, mail management, and Caffeena. It uses in-memory storage so it starts without MongoDB; data is cleared when the process stops.

```bash
cp backend-rust/.env.example backend-rust/.env
cargo run --manifest-path backend-rust/Cargo.toml
```

The Rust API runs on `http://localhost:3000`. The frontend already uses this address by default. To use another API location, set `VITE_API_URL`, for example:

```bash
VITE_API_URL=http://localhost:3000/api npm --prefix frontend run dev
```

## 🚀 Project Structure

```
email-assistance-system/
├── backend-rust/         # Rust/Axum Backend (active)
├── backend/              # Original Node.js/Express Backend
│   ├── models/          # MongoDB models (User, Mail)
│   ├── routes/          # API routes (auth, mail, AI)
│   ├── server.js        # Main server file
│   ├── package.json    # Backend dependencies
│   └── .env            # Environment variables
├── frontend/            # React Frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── App.jsx     # Main App component
│   │   └── main.jsx    # Entry point
│   ├── public/         # Static assets
│   └── package.json    # Frontend dependencies
└── README.md
```

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB Atlas** for database
- **JWT** for authentication
- **bcryptjs** for password hashing

### Frontend
- **React 19** with Vite
- **React Router** for navigation
- **Axios** for API calls
- **CSS3** with modern styling

## 📋 Features

- **User Authentication**: Secure login and registration
- **Email Management**: Send, receive, read, and delete emails
- **AI Assistant (Caffeena)**: Coffee-themed AI for email assistance
  - Spam detection
  - Reply suggestions
  - Email analysis
- **Modern UI**: Hawk-branded interface with background image
- **Responsive Design**: Works on desktop and mobile

## 🔧 Setup Instructions

### 1. Backend Setup

```bash
cd backend
npm install
```

Configure environment variables in `backend/.env`:
```
MONGODB_URL=mongodb+srv://your_mongodb_url
PORT=3000
JWT_SECRET=your_jwt_secret
```

Start the backend server:
```bash
npm run dev
```

Backend will run on **http://localhost:3000**

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Start the React development server:
```bash
npm run dev
```

Frontend will run on **http://localhost:8000**

## 🎯 Usage

1. **Register**: Create a new account at http://localhost:8000/register
2. **Login**: Access your account at http://localhost:8000/login
3. **Send Emails**: Use the compose button to write emails
4. **AI Assistant**: Click "Ask Caffeena" for email assistance

## 🔌 API Endpoints

### Authentication
- `POST http://localhost:3000/api/auth/register` - Register user
- `POST http://localhost:3000/api/auth/login` - Login user

### Mail
- `POST http://localhost:3000/api/mail/send` - Send email
- `GET http://localhost:3000/api/mail/inbox` - Get inbox
- `GET http://localhost:3000/api/mail/sent` - Get sent emails
- `PUT http://localhost:3000/api/mail/:id/read` - Mark as read
- `DELETE http://localhost:3000/api/mail/:id` - Delete email

### AI (Caffeena)
- `POST http://localhost:3000/api/ai/caffeena` - AI assistance

## 🎨 Design

- **Hawk Branding**: Eagle icon and clean aesthetic
- **Background**: Mountain landscape image
- **Style**: Minimalist white/gray with purple accents
- **Layout**: Gmail-inspired sidebar navigation

## 🔒 Security

- Password hashing with bcryptjs
- JWT token authentication
- CORS configured for frontend-backend communication
- Input validation and sanitization

## 📱 Responsive

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile devices

## 🤝 Contributing

This is a prototype project for educational purposes.

## 📄 License

Prototype project - Educational use only.
