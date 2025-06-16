// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const pdf2pic = require('pdf2pic');
const ImageKit = require('imagekit');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pdf_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// ImageKit Configuration
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// PDF Schema
const pdfSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  class: { 
    type: String, 
    required: true,
    enum: ['6', '7', '8', '9', '10', '11', '12']
  },
  subject: { 
    type: String, 
    required: true,
    enum: ['Biology', 'Physics', 'Chemistry']
  },
  pdfUrl: { type: String, required: true },
  thumbnailUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  downloads: { type: Number, default: 0 }
});

const PDF = mongoose.model('PDF', pdfSchema);

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Helper function to generate thumbnail from PDF
async function generateThumbnail(pdfPath) {
  try {
    const options = {
      density: 150,
      saveFilename: "thumbnail",
      savePath: "./uploads/thumbnails/",
      format: "png",
      width: 300,
      height: 400
    };

    // Create thumbnails directory if it doesn't exist
    if (!fs.existsSync(options.savePath)) {
      fs.mkdirSync(options.savePath, { recursive: true });
    }

    const convert = pdf2pic.fromPath(pdfPath, options);
    const result = await convert(1, { responseType: "image" });
    
    return result.path;
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    throw error;
  }
}

// Helper function to upload to ImageKit
async function uploadToImageKit(filePath, fileName, folder = '') {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    const response = await imagekit.upload({
      file: fileBuffer,
      fileName: fileName,
      folder: folder,
      useUniqueFileName: true,
    });

    return response;
  } catch (error) {
    console.error('ImageKit upload error:', error);
    throw error;
  }
}

// Routes

// Admin Authentication Routes
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // In production, use proper password hashing
    const admin = await Admin.findOne({ username, password });
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ 
      success: true, 
      message: 'Login successful',
      admin: { id: admin._id, username: admin.username, email: admin.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Admin (for initial setup)
app.post('/api/admin/create', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const admin = new Admin({ username, password, email });
    await admin.save();

    res.json({ success: true, message: 'Admin created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PDF Upload Route
app.post('/api/pdfs/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { title, description, class: pdfClass, subject } = req.body;

    // Validate required fields
    if (!title || !description || !pdfClass || !subject) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const pdfPath = req.file.path;
    const fileName = req.file.filename;

    // Generate thumbnail
    const thumbnailPath = await generateThumbnail(pdfPath);

    // Upload PDF to ImageKit
    const pdfUpload = await uploadToImageKit(pdfPath, fileName, 'pdfs');
    
    // Upload thumbnail to ImageKit
    const thumbnailUpload = await uploadToImageKit(thumbnailPath, `thumb_${fileName}.png`, 'thumbnails');

    // Save to database
    const newPDF = new PDF({
      title,
      description,
      class: pdfClass,
      subject,
      pdfUrl: pdfUpload.url,
      thumbnailUrl: thumbnailUpload.url,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

    await newPDF.save();

    // Clean up local files
    fs.unlinkSync(pdfPath);
    fs.unlinkSync(thumbnailPath);

    res.json({ 
      success: true, 
      message: 'PDF uploaded successfully',
      pdf: newPDF
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all PDFs with filtering
app.get('/api/pdfs', async (req, res) => {
  try {
    const { class: pdfClass, subject, search, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    if (pdfClass) query.class = pdfClass;
    if (subject) query.subject = subject;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const pdfs = await PDF.find(query)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PDF.countDocuments(query);

    res.json({
      pdfs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasMore: skip + pdfs.length < total
      }
    });
  } catch (error) {
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
    res.status(500).json({ error: error.message });
  }
});

// Update PDF
app.put('/api/pdfs/:id', async (req, res) => {
  try {
    const { title, description, class: pdfClass, subject } = req.body;
    
    const pdf = await PDF.findByIdAndUpdate(
      req.params.id,
      { title, description, class: pdfClass, subject },
      { new: true }
    );

    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    res.json({ success: true, message: 'PDF updated successfully', pdf });
  } catch (error) {
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

    // Delete from ImageKit (optional - you might want to keep files)
    // You can implement ImageKit deletion here if needed

    await PDF.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'PDF deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download PDF (increment download count)
app.post('/api/pdfs/:id/download', async (req, res) => {
  try {
    const pdf = await PDF.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloads: 1 } },
      { new: true }
    );

    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    res.json({ success: true, downloadUrl: pdf.pdfUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics for admin dashboard
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalPDFs = await PDF.countDocuments();
    const totalDownloads = await PDF.aggregate([
      { $group: { _id: null, total: { $sum: '$downloads' } } }
    ]);

    const classwiseStats = await PDF.aggregate([
      { $group: { _id: '$class', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const subjectwiseStats = await PDF.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]);

    res.json({
      totalPDFs,
      totalDownloads: totalDownloads[0]?.total || 0,
      classwiseStats,
      subjectwiseStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});