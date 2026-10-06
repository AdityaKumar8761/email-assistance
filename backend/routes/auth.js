const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();
const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const User = require('../models/User');
const router = express.Router();
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const bucket = process.env.S3_BUCKET_NAME || 'mailhawk';
const MAX_AVATAR_SIZE = 10 * 1024 * 1024;
const allowedAvatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

const publicUser = (user, avatarUrl = null) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  nickname: user.nickname || '',
  companyName: user.companyName || '',
  bio: user.bio || '',
  avatarUrl
});

const avatarUrlFor = async (avatarKey) => avatarKey
  ? getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: avatarKey }), { expiresIn: 900 })
  : null;

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    
    const user = new User({ username, email, password });
    await user.save();
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      message: 'Login successful',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: publicUser(user, await avatarUrlFor(user.avatarKey)) });
  } catch (error) {
    res.status(500).json({ message: 'Error loading profile', error: error.message });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const fields = ['nickname', 'companyName', 'bio'];
    const updates = {};
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== 'string') {
          return res.status(400).json({ message: `${field} must be text` });
        }
        updates[field] = req.body[field].trim();
      }
    }
    if (updates.nickname?.length > 80 || updates.companyName?.length > 120 || updates.bio?.length > 500) {
      return res.status(400).json({ message: 'Profile details exceed the allowed length' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: publicUser(user, await avatarUrlFor(user.avatarKey)) });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

router.post('/profile/avatar/presign', authenticateToken, async (req, res) => {
  try {
    const { contentType, size } = req.body;
    if (!allowedAvatarTypes.has(contentType) || !Number.isInteger(size) ||
        size <= 0 || size > MAX_AVATAR_SIZE) {
      return res.status(400).json({ message: 'Avatar must be a JPG, PNG, WEBP, or GIF up to 10 MB' });
    }
    const key = `avatars/${req.user.userId}/${crypto.randomUUID()}`;
    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    }), { expiresIn: 900 });
    res.json({ key, uploadUrl });
  } catch (error) {
    res.status(500).json({ message: 'Error preparing avatar upload', error: error.message });
  }
});

router.put('/profile/avatar', authenticateToken, async (req, res) => {
  try {
    const { key } = req.body;
    if (typeof key !== 'string' || !key.startsWith(`avatars/${req.user.userId}/`)) {
      return res.status(400).json({ message: 'Invalid avatar upload' });
    }
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const oldKey = user.avatarKey;
    user.avatarKey = key;
    await user.save();
    if (oldKey) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));
    res.json({ user: publicUser(user, await avatarUrlFor(user.avatarKey)) });
  } catch (error) {
    res.status(500).json({ message: 'Error saving avatar', error: error.message });
  }
});

router.get('/users/:userId/avatar', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('avatarKey');
    if (!user?.avatarKey) return res.status(404).json({ message: 'Avatar not found' });
    res.json({ url: await avatarUrlFor(user.avatarKey) });
  } catch (error) {
    res.status(500).json({ message: 'Error loading avatar', error: error.message });
  }
});

module.exports = router;
