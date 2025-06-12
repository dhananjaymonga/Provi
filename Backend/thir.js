// BACKEND - Fixed PDF URL generation and access with EDIT and DELETE routes

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

// MongoDB schema for PDF documents - UPDATED WITH NEW FIELDS
const pdfSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false
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
  pdfUrl: {
    type: String,
    default: "#"
  },
  thumbnailUrl: String,
  pageCount: {
    type: Number,
    default: 0
  },
  pinned: {
    type: Boolean,
    default: false
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const PDF = mongoose.model('PDF', pdfSchema);

// Connect to MongoDB
mongoose.connect('mongodb+srv://dhananjaymonga10:7yBvJsZUlD0eC0CL@cluster0.6iufh6b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Upload PDF endpoint - UPDATED TO HANDLE NEW FIELDS
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
    try {
      console.log(req.body);
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
  
      const { title, subject, classNumber, description, pinned } = req.body;
  
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
  
      // Save to MongoDB with new fields
      const newPdf = new PDF({
        title: title,
        description: description || '',           // Optional description field
        subject: subject,
        class: classNumber,
        filename: req.file.filename,
        filepath: localPdfUrl,
        pdfUrl: rawUpload.secure_url,            // Cloudinary PDF URL
        thumbnailUrl: thumbnailUrl,              // Cloudinary thumbnail URL
        pageCount: 5,                            // Optional static count
        pinned: pinned === 'true' || pinned === true,  // Handle boolean conversion
        uploadDate: new Date(),                  // Current upload time
        createdAt: new Date()                    // Current creation time
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

// Get single PDF by ID
app.get('/api/pdfs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pdf = await PDF.findById(id);

    if (!pdf || !pdf.fileUrl) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const fileResponse = await fetch(pdf.fileUrl);
    if (!fileResponse.ok) throw new Error('Cloud file fetch failed');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.title || 'study-note'}.pdf"`);

    fileResponse.body.pipe(res);
  } catch (error) {
    console.error('Error fetching PDF:', error);
    res.status(500).json({ error: 'Error fetching PDF' });
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

// Get pinned PDFs endpoint
app.get('/api/pdfs/pinned', async (req, res) => {
  try {
    const pinnedPdfs = await PDF.find({ pinned: true }).sort({ uploadDate: -1 });
    res.status(200).json(pinnedPdfs);
  } catch (error) {
    console.error('Error fetching pinned PDFs:', error);
    res.status(500).json({ error: 'Error fetching pinned PDFs' });
  }
});

// Toggle pin status for a PDF
app.patch('/api/pdfs/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    const pdf = await PDF.findById(id);
    
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    
    pdf.pinned = !pdf.pinned;
    await pdf.save();
    
    res.status(200).json({
      message: `PDF ${pdf.pinned ? 'pinned' : 'unpinned'} successfully`,
      pdf: pdf
    });
  } catch (error) {
    console.error('Error toggling pin status:', error);
    res.status(500).json({ error: 'Error toggling pin status' });
  }
});

// NEW: UPDATE/EDIT PDF endpoint
app.put('/api/pdfs/:id', upload.single('pdf'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, classNumber, description, pinned } = req.body;

    // Find the existing PDF
    const existingPdf = await PDF.findById(id);
    if (!existingPdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // Prepare update data
    const updateData = {
      title: title || existingPdf.title,
      description: description !== undefined ? description : existingPdf.description,
      subject: subject || existingPdf.subject,
      class: classNumber || existingPdf.class,
      pinned: pinned !== undefined ? (pinned === 'true' || pinned === true) : existingPdf.pinned
    };

    // If a new file is uploaded, handle file replacement
    if (req.file) {
      try {
        // Delete old local file if it exists
        if (existingPdf.filepath && fs.existsSync(existingPdf.filepath.replace(`${req.protocol}://${req.get('host')}/`, ''))) {
          fs.unlinkSync(existingPdf.filepath.replace(`${req.protocol}://${req.get('host')}/`, ''));
        }

        const localFilePath = req.file.path;

        // Upload new file to Cloudinary
        const rawUpload = await cloudinary.uploader.upload(localFilePath, {
          resource_type: 'raw',
          folder: 'pdfs',
        });

        const autoUpload = await cloudinary.uploader.upload(localFilePath, {
          resource_type: 'auto',
          folder: 'pdfs',
        });

        const thumbnailUrl = cloudinary.url(autoUpload.public_id, {
          format: 'jpg',
          page: 1,
          secure: true,
        });

        const localPdfUrl = `${req.protocol}://${req.get('host')}/${localFilePath}`;

        // Update file-related fields
        updateData.filename = req.file.filename;
        updateData.filepath = localPdfUrl;
        updateData.pdfUrl = rawUpload.secure_url;
        updateData.thumbnailUrl = thumbnailUrl;
      } catch (fileError) {
        console.error('Error handling file update:', fileError);
        return res.status(500).json({ error: 'Error updating file: ' + fileError.message });
      }
    }

    // Update the PDF document
    const updatedPdf = await PDF.findByIdAndUpdate(id, updateData, { new: true });

    res.status(200).json({
      message: 'PDF updated successfully',
      pdf: updatedPdf
    });

  } catch (error) {
    console.error('Error updating PDF:', error);
    res.status(500).json({ error: 'Error updating PDF: ' + error.message });
  }
});

// NEW: DELETE PDF endpoint
app.delete('/api/pdfs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the PDF to get file information
    const pdf = await PDF.findById(id);
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // Delete local file if it exists
    try {
      if (pdf.filepath) {
        const localPath = pdf.filepath.replace(`${req.protocol}://${req.get('host')}/`, '');
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          console.log('Local file deleted successfully');
        }
      }
    } catch (fileError) {
      console.warn('Warning: Could not delete local file:', fileError.message);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from Cloudinary (optional - you might want to keep files in cloud)
    try {
      if (pdf.pdfUrl && pdf.pdfUrl !== "#") {
        // Extract public_id from Cloudinary URL for deletion
        const urlParts = pdf.pdfUrl.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/'); // folder/filename
        const publicId = publicIdWithExtension.split('.')[0]; // remove extension
        
        await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        console.log('Cloudinary file deleted successfully');
      }
    } catch (cloudinaryError) {
      console.warn('Warning: Could not delete Cloudinary file:', cloudinaryError.message);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Delete from database
    await PDF.findByIdAndDelete(id);

    res.status(200).json({
      message: 'PDF deleted successfully',
      deletedPdf: {
        id: pdf._id,
        title: pdf.title
      }
    });

  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({ error: 'Error deleting PDF: ' + error.message });
  }
});

// NEW: BULK DELETE PDFs endpoint
app.delete('/api/pdfs/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No PDF IDs provided' });
    }

    // Find all PDFs to be deleted
    const pdfsToDelete = await PDF.find({ _id: { $in: ids } });
    
    if (pdfsToDelete.length === 0) {
      return res.status(404).json({ error: 'No PDFs found with provided IDs' });
    }

    // Delete local files and Cloudinary files
    const deletionResults = {
      successful: [],
      failed: []
    };

    for (const pdf of pdfsToDelete) {
      try {
        // Delete local file
        if (pdf.filepath) {
          const localPath = pdf.filepath.replace(/^https?:\/\/[^\/]+\//, '');
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
          }
        }

        // Delete from Cloudinary
        if (pdf.pdfUrl && pdf.pdfUrl !== "#") {
          const urlParts = pdf.pdfUrl.split('/');
          const publicIdWithExtension = urlParts.slice(-2).join('/');
          const publicId = publicIdWithExtension.split('.')[0];
          
          await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        }

        deletionResults.successful.push({
          id: pdf._id,
          title: pdf.title
        });

      } catch (fileError) {
        console.warn(`Warning: Could not delete files for PDF ${pdf._id}:`, fileError.message);
        deletionResults.failed.push({
          id: pdf._id,
          title: pdf.title,
          error: fileError.message
        });
      }
    }

    // Delete from database
    const deleteResult = await PDF.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      message: `${deleteResult.deletedCount} PDFs deleted successfully`,
      deletedCount: deleteResult.deletedCount,
      deletionResults: deletionResults
    });

  } catch (error) {
    console.error('Error bulk deleting PDFs:', error);
    res.status(500).json({ error: 'Error bulk deleting PDFs: ' + error.message });
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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});