const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();
const {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const Mail = require('../models/Mail');
const User = require('../models/User');
const router = express.Router();
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MAIL = 10;
const MULTIPART_PART_SIZE = 64 * 1024 * 1024;
const bucket = process.env.S3_BUCKET_NAME || 'mailhawk';
const awsRegion = process.env.AWS_REGION || 'ap-south-1';
const hasAwsCredentials = Boolean(
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
);
const s3 = new S3Client({
  region: awsRegion,
  ...(hasAwsCredentials ? {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  } : {})
});
const userAvatarUrl = (key) => key
  ? getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 900 })
  : Promise.resolve(null);

const requireAwsCredentials = (res) => {
  if (hasAwsCredentials) return true;
  res.status(503).json({
    message: 'S3 attachments are not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in backend/.env, then restart the backend.'
  });
  return false;
};

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

router.post('/attachments/multipart/initiate', authenticateToken, async (req, res) => {
  try {
    if (!requireAwsCredentials(res)) return;
    const files = req.body.files;
    if (!Array.isArray(files) || files.length === 0 || files.length > MAX_ATTACHMENTS_PER_MAIL) {
      return res.status(400).json({ message: `Choose between 1 and ${MAX_ATTACHMENTS_PER_MAIL} attachments` });
    }

    const attachments = await Promise.all(files.map(async (file) => {
      if (!file || typeof file.name !== 'string' || !file.name.trim() ||
          typeof file.type !== 'string' || !Number.isInteger(file.size) ||
          file.size <= 0 || file.size > MAX_ATTACHMENT_SIZE) {
        throw new Error('Each attachment must have a name, content type, and size up to 50 GB');
      }

      const id = new (require('mongoose').Types.ObjectId)();
      const key = `${req.user.userId}/${crypto.randomUUID()}`;
      const multipart = await s3.send(new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: file.type
      }));

      return {
        id: id.toString(),
        key,
        uploadId: multipart.UploadId,
        name: file.name.trim().slice(0, 255),
        contentType: file.type,
        size: file.size,
        partSize: MULTIPART_PART_SIZE,
        partCount: Math.ceil(file.size / MULTIPART_PART_SIZE)
      };
    }));

    res.json({ attachments });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error preparing attachments' });
  }
});

router.post('/attachments/multipart/presign', authenticateToken, async (req, res) => {
  try {
    if (!requireAwsCredentials(res)) return;
    const { key, uploadId, partNumbers } = req.body;
    if (typeof key !== 'string' || !key.startsWith(`${req.user.userId}/`) ||
        typeof uploadId !== 'string' || !Array.isArray(partNumbers) ||
        partNumbers.length === 0 || partNumbers.length > 100) {
      return res.status(400).json({ message: 'Invalid multipart upload request' });
    }

    const urls = await Promise.all(partNumbers.map(async (partNumber) => {
      if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
        throw new Error('Invalid multipart part number');
      }
      return {
        partNumber,
        url: await getSignedUrl(s3, new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber
        }), { expiresIn: 900 })
      };
    }));
    res.json({ urls });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error preparing multipart upload' });
  }
});

router.post('/attachments/multipart/complete', authenticateToken, async (req, res) => {
  try {
    if (!requireAwsCredentials(res)) return;
    const { key, uploadId, parts } = req.body;
    if (typeof key !== 'string' || !key.startsWith(`${req.user.userId}/`) ||
        typeof uploadId !== 'string' || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ message: 'Invalid multipart completion request' });
    }
    const normalizedParts = parts.map(part => ({
      ETag: part.ETag,
      PartNumber: part.PartNumber
    }));
    if (normalizedParts.some(part => typeof part.ETag !== 'string' ||
        !Number.isInteger(part.PartNumber) || part.PartNumber < 1 || part.PartNumber > 10000)) {
      return res.status(400).json({ message: 'Invalid multipart part metadata' });
    }

    await s3.send(new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: normalizedParts }
    }));
    res.json({ key });
  } catch (error) {
    res.status(500).json({ message: 'Error completing multipart upload', error: error.message });
  }
});

router.delete('/attachments/multipart', authenticateToken, async (req, res) => {
  try {
    if (!requireAwsCredentials(res)) return;
    const { key, uploadId } = req.body;
    if (typeof key !== 'string' || !key.startsWith(`${req.user.userId}/`) ||
        typeof uploadId !== 'string') {
      return res.status(400).json({ message: 'Invalid multipart abort request' });
    }
    await s3.send(new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId
    }));
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Error aborting multipart upload', error: error.message });
  }
});

// Send mail
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { recipientEmail, subject, body, attachments = [] } = req.body;
    if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS_PER_MAIL) {
      return res.status(400).json({ message: `A mail can contain at most ${MAX_ATTACHMENTS_PER_MAIL} attachments` });
    }
    const safeAttachments = attachments.map((attachment) => {
      if (!attachment.id || !/^[a-f\d]{24}$/i.test(attachment.id) ||
          typeof attachment.key !== 'string' ||
          !attachment.key.startsWith(`${req.user.userId}/`) ||
          typeof attachment.name !== 'string' ||
          typeof attachment.contentType !== 'string' ||
          !Number.isInteger(attachment.size) ||
          attachment.size <= 0 || attachment.size > MAX_ATTACHMENT_SIZE) {
        throw new Error('Invalid attachment metadata');
      }
      return {
        _id: attachment.id,
        key: attachment.key,
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size
      };
    });
    await Promise.all(safeAttachments.map((attachment) => s3.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: attachment.key
    }))));
    
    // Find recipient
    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    const mail = new Mail({
      sender: req.user.userId,
      recipient: recipient._id,
      subject,
      body,
      attachments: safeAttachments
    });

    await mail.save();
    
    res.status(201).json({ message: 'Mail sent successfully', mail });
  } catch (error) {
    console.error('Error sending mail:', error);
    res.status(500).json({ message: 'Error sending mail', error: error.message });
  }
});

router.get('/:mailId/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    if (!requireAwsCredentials(res)) return;
    const mail = await Mail.findOne({
      _id: req.params.mailId,
      $or: [{ sender: req.user.userId }, { recipient: req.user.userId }]
    }).select('attachments');
    const attachment = mail?.attachments.id(req.params.attachmentId);
    if (!attachment) return res.status(404).json({ message: 'Attachment not found' });

    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: bucket,
      Key: attachment.key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(attachment.name)}"`
    }), { expiresIn: 900 });
    res.json({ url });
  } catch (error) {
    console.error('Error preparing attachment download:', error);
    res.status(500).json({ message: 'Error preparing attachment download', error: error.message });
  }
});

// Get inbox
router.get('/inbox', authenticateToken, async (req, res) => {
  try {
    const mails = await Mail.find({ recipient: req.user.userId })
      .populate('sender', 'username email avatarKey')
      .sort({ createdAt: -1 });
    const mailValues = await Promise.all(mails.map(async mail => {
      const value = mail.toObject();
      if (value.sender?.avatarKey) {
        value.sender.avatarUrl = await userAvatarUrl(value.sender.avatarKey);
      }
      delete value.sender?.avatarKey;
      return value;
    }));
    res.json({ mails: mailValues });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inbox', error: error.message });
  }
});

// Get sent mail
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const mails = await Mail.find({ sender: req.user.userId })
      .populate('recipient', 'username email avatarKey')
      .sort({ createdAt: -1 });
    const mailValues = await Promise.all(mails.map(async mail => {
      const value = mail.toObject();
      if (value.recipient?.avatarKey) {
        value.recipient.avatarUrl = await userAvatarUrl(value.recipient.avatarKey);
      }
      delete value.recipient?.avatarKey;
      return value;
    }));
    res.json({ mails: mailValues });
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
    const deletedMail = await Mail.findOneAndDelete({
      _id: req.params.mailId,
      $or: [{ sender: req.user.userId }, { recipient: req.user.userId }]
    });
    if (!deletedMail) return res.status(404).json({ message: 'Mail not found' });

    res.json({ message: 'Mail deleted successfully' });
  } catch (error) {
    console.error('Error deleting mail:', error);
    res.status(500).json({ message: 'Error deleting mail', error: error.message });
  }
});

module.exports = router;
