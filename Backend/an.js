const express = require('express');
const multer = require('multer');
require('dotenv').config();

const cors = require('cors');
const mongoose = require('mongoose');
const ImageKit = require('imagekit');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/pdfmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// ImageKit configuration
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint:process.env.IMAGEKIT_URL_ENDPOINT,
});

// PDF Schema
const pdfSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  class: { type: Number, required: true, min: 6, max: 12 },
  subject: { 
    type: String, 
    required: true, 
    enum: ['biology', 'physics', 'chemistry'] 
  },
  pdfUrl: { type: String, required: true },
  thumbnailUrl: { type: String, required: true },
  fileId: { type: String, required: true },
  thumbnailFileId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const PDF = mongoose.model('PDF', pdfSchema);

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Create a default thumbnail (placeholder image)
function createDefaultThumbnail() {
  // Create a simple SVG placeholder
  const svgContent = `
    <svg width="300" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="400" fill="#f3f4f6"/>
      <rect x="20" y="40" width="260" height="30" fill="#d1d5db"/>
      <rect x="20" y="90" width="180" height="20" fill="#d1d5db"/>
      <rect x="20" y="120" width="220" height="20" fill="#d1d5db"/>
      <rect x="20" y="150" width="200" height="20" fill="#d1d5db"/>
      <text x="150" y="250" text-anchor="middle" font-family="Arial" font-size="24" fill="#6b7280">PDF</text>
      <text x="150" y="280" text-anchor="middle" font-family="Arial" font-size="16" fill="#9ca3af">Document</text>
    </svg>
  `;
  return Buffer.from(svgContent);
}

// Routes

// Get all PDFs with filtering
app.get('/api/pdfs', async (req, res) => {
  try {
    const { class: classFilter, subject } = req.query;
    let filter = {};
    
    if (classFilter) filter.class = parseInt(classFilter);
    if (subject) filter.subject = subject;
    
    const pdfs = await PDF.find(filter).sort({ createdAt: -1 });
    res.json(pdfs);
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single PDF
app.get('/api/pdfs/:id', async (req, res) => {
  try {
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    res.json(pdf);
  } catch (error) {
    console.error('Error fetching PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload PDF
app.post('/api/pdfs', upload.single('pdf'), async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('File:', req.file ? 'Present' : 'Missing');

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { title, description, class: pdfClass, subject } = req.body;

    // Validate required fields
    if (!title || !description || !pdfClass || !subject) {
      return res.status(400).json({ 
        error: 'All fields are required',
        received: { title, description, class: pdfClass, subject }
      });
    }

    // Validate class range
    const classNum = parseInt(pdfClass);
    if (classNum < 6 || classNum > 12) {
      return res.status(400).json({ error: 'Class must be between 6 and 12' });
    }

    // Validate subject
    if (!['biology', 'physics', 'chemistry'].includes(subject)) {
      return res.status(400).json({ error: 'Subject must be biology, physics, or chemistry' });
    }

    // Create default thumbnail
    const thumbnailBuffer = createDefaultThumbnail();

    // Upload PDF to ImageKit
    console.log('Uploading PDF to ImageKit...');
    const pdfUpload = await imagekit.upload({
      file: req.file.buffer,
      fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`,
      folder: '/pdfs'
    });

    // Upload thumbnail to ImageKit
    console.log('Uploading thumbnail to ImageKit...');
    const thumbnailUpload = await imagekit.upload({
      file: thumbnailBuffer,
      fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_thumbnail_${Date.now()}.svg`,
      folder: '/thumbnails'
    });

    // Save to database
    const newPDF = new PDF({
      title,
      description,
      class: classNum,
      subject,
      pdfUrl: pdfUpload.url,
      thumbnailUrl: thumbnailUpload.url,
      fileId: pdfUpload.fileId,
      thumbnailFileId: thumbnailUpload.fileId
    });

    console.log('Saving to database...');
    await newPDF.save();
    
    console.log('PDF uploaded successfully');
    res.status(201).json(newPDF);
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update PDF
app.put('/api/pdfs/:id', async (req, res) => {
  try {
    const { title, description, class: pdfClass, subject } = req.body;
    
    // Validate class range
    const classNum = parseInt(pdfClass);
    if (classNum < 6 || classNum > 12) {
      return res.status(400).json({ error: 'Class must be between 6 and 12' });
    }

    // Validate subject
    if (!['biology', 'physics', 'chemistry'].includes(subject)) {
      return res.status(400).json({ error: 'Subject must be biology, physics, or chemistry' });
    }
    
    const updatedPDF = await PDF.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        class: classNum,
        subject,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedPDF) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    res.json(updatedPDF);
  } catch (error) {
    console.error('Error updating PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete PDF
app.delete('/api/pdfs/:id', async (req, res) => {
  try {
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // Delete files from ImageKit
    try {
      await imagekit.deleteFile(pdf.fileId);
      if (pdf.thumbnailFileId) {
        await imagekit.deleteFile(pdf.thumbnailFileId);
      }
    } catch (deleteError) {
      console.error('Error deleting files from ImageKit:', deleteError);
      // Continue with database deletion even if ImageKit deletion fails
    }

    // Delete from database
    await PDF.findByIdAndDelete(req.params.id);

    res.json({ message: 'PDF deleted successfully' });
  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get statistics for admin dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const totalPDFs = await PDF.countDocuments();
    const pdfsByClass = await PDF.aggregate([
      { $group: { _id: '$class', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const pdfsBySubject = await PDF.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]);

    res.json({
      totalPDFs,
      pdfsByClass,
      pdfsBySubject
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});