const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Configure Cloudinary - Use environment variables for security
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dkkfzkjgc',
    api_key: process.env.CLOUDINARY_API_KEY || '969137682821883',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'tIBN2e1L2TL7nmB_6YNH5RJ_zv0'
});

// Configure multer for memory storage (no local files)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for production
  }
});

// MongoDB schema for PDF documents
const pdfSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  class: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  originalFilename: {
    type: String,
    required: true
  },
  fileId: {
    type: String,
    required: true,
    unique: true
  },
  pdfUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    default: 'application/pdf'
  },
  pinned: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  downloads: {
    type: Number,
    default: 0
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
pdfSchema.index({ subject: 1, class: 1 });
pdfSchema.index({ pinned: -1, uploadDate: -1 });
pdfSchema.index({ uploadDate: -1 });

const PDF = mongoose.model('PDF', pdfSchema);

// Connect to MongoDB - Use environment variable for connection string
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://dhananjaymonga10:7yBvJsZUlD0eC0CL@cluster0.6iufh6b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Helper function to generate unique filename
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  return `${baseName}_${timestamp}_${randomStr}${extension}`;
};

// Upload PDF endpoint
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    console.log('📤 Upload request received');

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No PDF file uploaded' 
      });
    }

    const { title, subject, classNumber, description, pinned } = req.body;

    // Validate required fields
    if (!title || !subject || !classNumber) {
      return res.status(400).json({ 
        success: false,
        error: 'Title, subject, and class are required fields' 
      });
    }

    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(req.file.originalname);

          console.log('📁 Uploading to Cloudinary...');

    try {
      // Upload PDF to Cloudinary as raw file
      const pdfUpload = await cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'pdfs',
          public_id: `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          tags: ['pdf', subject.toLowerCase(), `class-${classNumber}`]
        },
        (error, result) => {
          if (error) throw error;
          return result;
        }
      );

      // Convert buffer to stream and upload
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'pdfs',
            public_id: `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            tags: ['pdf', subject.toLowerCase(), `class-${classNumber}`]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });

      console.log('✅ PDF uploaded to Cloudinary:', uploadResult.public_id);

      // Upload PDF as image for thumbnail generation (Cloudinary can convert first page)
      const thumbnailResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: 'pdfs/thumbnails',
            public_id: `thumb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            format: 'jpg',
            pages: '1',
            width: 300,
            height: 400,
            crop: 'pad',
            background: 'white'
          },
          (error, result) => {
            if (error) {
              console.warn('⚠️ Thumbnail generation failed, using default');
              resolve(null);
            } else {
              resolve(result);
            }
          }
        );
        uploadStream.end(req.file.buffer);
      });

      // Generate thumbnail URL
      const thumbnailUrl = thumbnailResult 
        ? thumbnailResult.secure_url
        : `https://via.placeholder.com/300x400/4F46E5/FFFFFF?text=${encodeURIComponent(title)}`;

      // Use the raw PDF URL for viewing and downloading
      const optimizedPdfUrl = uploadResult.secure_url;

      console.log('💾 Saving to database...');

      // Save to MongoDB
      const newPdf = new PDF({
        title: title.trim(),
        description: description ? description.trim() : '',
        subject: subject.trim(),
        class: classNumber.trim(),
        originalFilename: req.file.originalname,
        fileId: uploadResult.public_id,
        pdfUrl: optimizedPdfUrl,
        thumbnailUrl: thumbnailUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        pinned: pinned === 'true' || pinned === true
      });

      const savedPdf = await newPdf.save();

      console.log('✅ PDF saved to database with ID:', savedPdf._id);

      res.status(201).json({
        success: true,
        message: 'PDF uploaded successfully',
        pdf: {
          id: savedPdf._id,
          title: savedPdf.title,
          description: savedPdf.description,
          subject: savedPdf.subject,
          class: savedPdf.class,
          thumbnailUrl: savedPdf.thumbnailUrl,
          pdfUrl: savedPdf.pdfUrl,
          fileSize: savedPdf.fileSize,
          pinned: savedPdf.pinned,
          uploadDate: savedPdf.uploadDate
        }
      });

    } catch (cloudinaryError) {
      console.error('❌ Cloudinary upload error:', cloudinaryError);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload PDF to storage service'
      });
    }

  } catch (error) {
    console.error('❌ Error uploading PDF:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error during PDF upload'
    });
  }
});

// Get all PDFs with pagination
app.get('/api/pdfs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const pdfs = await PDF.find()
      .sort({ pinned: -1, uploadDate: -1 })
      .skip(skip)
      .limit(limit)
      .select('-fileId'); // Don't expose internal file ID

    const total = await PDF.countDocuments();

    res.status(200).json({
      success: true,
      data: pdfs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('❌ Error fetching PDFs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching PDFs' 
    });
  }
});

// Get single PDF by ID
app.get('/api/pdf/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid PDF ID format' 
      });
    }

    const pdf = await PDF.findById(id).select('-fileId');

    if (!pdf) {
      return res.status(404).json({ 
        success: false,
        error: 'PDF not found' 
      });
    }

    // Increment view count
    await PDF.findByIdAndUpdate(id, { $inc: { views: 1 } });

    res.status(200).json({
      success: true,
      data: pdf
    });

  } catch (error) {
    console.error('❌ Error fetching PDF:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching PDF details'
    });
  }
});

// Get PDF download URL and increment download counter
app.get('/api/pdf/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid PDF ID format' 
      });
    }

    const pdf = await PDF.findById(id);

    if (!pdf) {
      return res.status(404).json({ 
        success: false,
        error: 'PDF not found' 
      });
    }

    // Increment download count
    await PDF.findByIdAndUpdate(id, { $inc: { downloads: 1 } });

    // Generate download URL with proper headers
    const downloadUrl = pdf.pdfUrl;

    res.status(200).json({
      success: true,
      downloadUrl: downloadUrl,
      filename: `${pdf.title}.pdf`
    });

  } catch (error) {
    console.error('❌ Error generating download URL:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error generating download URL'
    });
  }
});

// Get PDFs by class and subject with search
app.get('/api/pdfs/filter', async (req, res) => {
  try {
    const { class: classNumber, subject, search, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (classNumber) query.class = classNumber;
    if (subject) query.subject = new RegExp(subject, 'i');
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const pdfs = await PDF.find(query)
      .sort({ pinned: -1, uploadDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-fileId');

    const total = await PDF.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: pdfs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching filtered PDFs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching filtered PDFs' 
    });
  }
});

// Get pinned PDFs
app.get('/api/pdfs/pinned', async (req, res) => {
  try {
    const pinnedPdfs = await PDF.find({ pinned: true })
      .sort({ uploadDate: -1 })
      .select('-fileId');
      
    res.status(200).json({
      success: true,
      data: pinnedPdfs
    });
  } catch (error) {
    console.error('❌ Error fetching pinned PDFs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching pinned PDFs' 
    });
  }
});

// Toggle pin status
app.patch('/api/pdfs/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid PDF ID format' 
      });
    }

    const pdf = await PDF.findById(id);
    
    if (!pdf) {
      return res.status(404).json({ 
        success: false,
        error: 'PDF not found' 
      });
    }
    
    pdf.pinned = !pdf.pinned;
    pdf.updatedAt = new Date();
    await pdf.save();
    
    res.status(200).json({
      success: true,
      message: `PDF ${pdf.pinned ? 'pinned' : 'unpinned'} successfully`,
      data: {
        id: pdf._id,
        pinned: pdf.pinned
      }
    });
  } catch (error) {
    console.error('❌ Error toggling pin status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error updating pin status'
    });
  }
});

// Update PDF metadata
app.put('/api/pdfs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, subject, class: classNumber, pinned } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid PDF ID format' 
      });
    }

    const updateData = { updatedAt: new Date() };
    
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (subject) updateData.subject = subject.trim();
    if (classNumber) updateData.class = classNumber.trim();
    if (pinned !== undefined) updateData.pinned = pinned;

    const pdf = await PDF.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    ).select('-fileId');
    
    if (!pdf) {
      return res.status(404).json({ 
        success: false,
        error: 'PDF not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'PDF updated successfully',
      data: pdf
    });

  } catch (error) {
    console.error('❌ Error updating PDF:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error updating PDF metadata'
    });
  }
});

// Delete PDF
app.delete('/api/pdfs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid PDF ID format' 
      });
    }

    const pdf = await PDF.findById(id);
    
    if (!pdf) {
      return res.status(404).json({ 
        success: false,
        error: 'PDF not found' 
      });
    }

    try {
      // Delete from Cloudinary
      await cloudinary.uploader.destroy(pdf.fileId, { resource_type: 'raw' });
      console.log('✅ PDF deleted from Cloudinary:', pdf.fileId);
    } catch (cloudinaryError) {
      console.error('⚠️ Warning: Could not delete from Cloudinary:', cloudinaryError.message);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Delete from database
    await PDF.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'PDF deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting PDF:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error deleting PDF'
    });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const totalPdfs = await PDF.countDocuments();
    const pinnedPdfs = await PDF.countDocuments({ pinned: true });
    const totalViews = await PDF.aggregate([
      { $group: { _id: null, total: { $sum: '$views' } } }
    ]);
    const totalDownloads = await PDF.aggregate([
      { $group: { _id: null, total: { $sum: '$downloads' } } }
    ]);

    const subjectStats = await PDF.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const classStats = await PDF.aggregate([
      { $group: { _id: '$class', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPdfs,
        pinnedPdfs,
        totalViews: totalViews[0]?.total || 0,
        totalDownloads: totalDownloads[0]?.total || 0,
        subjectStats,
        classStats
      }
    });
  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching statistics' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false,
        error: 'File too large. Maximum size is 50MB.' 
      });
    }
  }
  
  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({ 
      success: false,
      error: 'Only PDF files are allowed' 
    });
  }

  console.error('❌ Unhandled error:', error);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;