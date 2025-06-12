const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'dvn9wwxhl',
    api_key: '496822881153243',
    api_secret: 'yHK8hESIHgkrJMjhD5K5sPLRzDs'
});

// IMPORTANT: Use local storage first, then we'll upload to Cloudinary
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');  // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Serve the uploads directory statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB schema for PDF documents
const pdfSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  class: {
    type: String,
    required: true
  },
  filename: String,
  filepath: String,
  pdfUrl: String,
  thumbnailUrl: String,
  pageCount: {
    type: Number,
    default: 0
  },
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

const PDF = mongoose.model('PDF', pdfSchema);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/pdf-database', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Upload PDF endpoint
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
    try {
      console.log(req.body);
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
  
      const { title, subject, classNumber } = req.body;
  
      if (!title || !subject || !classNumber) {
        return res.status(400).json({ error: 'Title, subject, and class are required' });
      }
  
      const localFilePath = req.file.path;
  
      // 1. Upload as raw (for full PDF view)
      const rawUpload = await cloudinary.uploader.upload(localFilePath, {
        resource_type: 'raw',
        folder: 'pdfs',
      });
  
      // 2. Upload as auto (for thumbnail)
      const autoUpload = await cloudinary.uploader.upload(localFilePath, {
        resource_type: 'auto',
        folder: 'pdfs',
      });
  
      // Generate thumbnail URL from the auto upload
      const thumbnailUrl = cloudinary.url(autoUpload.public_id, {
        format: 'jpg',
        page: 1,
        secure: true,
      });
  
      const localPdfUrl = `${req.protocol}://${req.get('host')}/${localFilePath}`;
  
      // Save to MongoDB
      const newPdf = new PDF({
        title: title,
        subject: subject,
        class: classNumber,
        filename: req.file.filename,
        filepath: localPdfUrl,
        pdfUrl: rawUpload.secure_url,     // ✅ correct full PDF URL
        thumbnailUrl: thumbnailUrl,       // ✅ correct thumbnail image
        pageCount: 5                      // Optional static count
      });
  
      await newPdf.save();
  
      res.status(201).json({
        message: 'PDF uploaded successfully',
        pdf: newPdf
      });
  
    } catch (error) {
      console.error('Error uploading PDF:', error);
      res.status(500).json({ error: 'Error uploading PDF: ' + error.message });
    }
  });
  
// Get all PDFs endpoint
app.get('/api/pdfs', async (req, res) => {
  try {
    const pdfs = await PDF.find().sort({ uploadDate: -1 });
    res.status(200).json(pdfs);
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    res.status(500).json({ error: 'Error fetching PDFs' });
  }
});

// Get PDFs by class and subject
app.get('/api/pdfs/filter', async (req, res) => {
  try {
    const { class: classNumber, subject } = req.query;
    const query = {};
    
    if (classNumber) query.class = classNumber;
    if (subject) query.subject = subject;
    
    const pdfs = await PDF.find(query).sort({ uploadDate: -1 });
    res.status(200).json(pdfs);
  } catch (error) {
    console.error('Error fetching filtered PDFs:', error);
    res.status(500).json({ error: 'Error fetching filtered PDFs' });
  }
});

// Get available classes
app.get('/api/classes', async (req, res) => {
  try {
    const classes = await PDF.distinct('class');
    res.status(200).json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Error fetching classes' });
  }
});

// Get available subjects (optionally filtered by class)
app.get('/api/subjects', async (req, res) => {
  try {
    const { class: classNumber } = req.query;
    const query = classNumber ? { class: classNumber } : {};
    
    const subjects = await PDF.distinct('subject', query);
    res.status(200).json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Error fetching subjects' });
  }
});

// NEW EDIT ROUTE: Edit PDF metadata
app.put('/api/pdfs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, classNumber } = req.body;
    
    // Validate input
    if (!title || !subject || !classNumber) {
      return res.status(400).json({ error: 'Title, subject, and class are required' });
    }
    
    // Find and update the PDF
    const updatedPdf = await PDF.findByIdAndUpdate(
      id, 
      { 
        title: title,
        subject: subject,
        class: classNumber 
      },
      { new: true } // Return the updated document
    );
    
    if (!updatedPdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    
    res.status(200).json({
      message: 'PDF updated successfully',
      pdf: updatedPdf
    });
  } catch (error) {
    console.error('Error updating PDF:', error);
    res.status(500).json({ error: 'Error updating PDF: ' + error.message });
  }
});

// NEW DELETE ROUTE: Delete a PDF
app.delete('/api/pdfs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the PDF first to get file details
    const pdf = await PDF.findById(id);
    
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    
    // Extract public IDs from Cloudinary URLs if available
    if (pdf.pdfUrl) {
      const pdfPublicId = pdf.pdfUrl.split('/').slice(-2).join('/').split('.')[0];
      if (pdfPublicId) {
        try {
          await cloudinary.uploader.destroy(pdfPublicId, { resource_type: 'raw' });
        } catch (cloudinaryError) {
          console.error('Error deleting PDF from Cloudinary:', cloudinaryError);
          // Continue with deletion even if Cloudinary fails
        }
      }
    }
    
    if (pdf.thumbnailUrl) {
      const thumbnailPublicId = pdf.thumbnailUrl.split('/').slice(-2).join('/').split('.')[0];
      if (thumbnailPublicId) {
        try {
          await cloudinary.uploader.destroy(thumbnailPublicId);
        } catch (cloudinaryError) {
          console.error('Error deleting thumbnail from Cloudinary:', cloudinaryError);
          // Continue with deletion even if Cloudinary fails
        }
      }
    }
    
    // Delete local file if it exists
    if (pdf.filepath) {
      const localFilePath = path.join(__dirname, pdf.filepath.replace(`${req.protocol}://${req.get('host')}/`, ''));
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    }
    
    // Delete from database
    await PDF.findByIdAndDelete(id);
    
    res.status(200).json({
      message: 'PDF deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({ error: 'Error deleting PDF: ' + error.message });
  }
});

// Get a specific PDF by ID
app.get('/api/pdfs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pdf = await PDF.findById(id);
    
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    
    res.status(200).json(pdf);
  } catch (error) {
    console.error('Error fetching PDF:', error);
    res.status(500).json({ error: 'Error fetching PDF: ' + error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});