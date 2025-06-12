// FRONTEND (React.js) - Fixed version for PDF viewing and downloading

// App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [pdfs, setPdfs] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [classNumber, setClassNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filter states
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  
  // PDF viewer state
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  // Fetch all PDFs, classes and subjects on component mount
  useEffect(() => {
    fetchPdfs();
    fetchClasses();
    fetchSubjects();
  }, []);

  // Fetch subjects when class filter changes
  useEffect(() => {
    fetchSubjects(selectedClass);
  }, [selectedClass]);

  // Fetch filtered PDFs when filters change
  useEffect(() => {
    fetchFilteredPdfs();
  }, [selectedClass, selectedSubject]);

  const fetchPdfs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/pdfs');
      setPdfs(response.data);
    } catch (err) {
      console.error('Error fetching PDFs:', err);
      setError('Failed to load PDFs');
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/classes');
      setClasses(response.data);
    } catch (err) {
      console.error('Error fetching classes:', err);
    }
  };

  const fetchSubjects = async (classFilter = '') => {
    try {
      let url = 'http://localhost:5000/api/subjects';
      if (classFilter) {
        url += `?class=${classFilter}`;
      }
      const response = await axios.get(url);
      setSubjects(response.data);
    } catch (err) {
      console.error('Error fetching subjects:', err);
    }
  };

  const fetchFilteredPdfs = async () => {
    try {
      let url = 'http://localhost:5000/api/pdfs/filter?';
      const params = new URLSearchParams();
      
      if (selectedClass) params.append('class', selectedClass);
      if (selectedSubject) params.append('subject', selectedSubject);
      
      const response = await axios.get(`${url}${params.toString()}`);
      setPdfs(response.data);
    } catch (err) {
      console.error('Error fetching filtered PDFs:', err);
      setError('Failed to load PDFs');
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      if (editMode) {
        // Update existing note
        await axios.put(`http://localhost:5000/api/pdfs/${editId}`, {
          title,
          subject,
          class: classNumber,
        });
  
        setEditMode(false);
        setEditId(null);
      } else {
        // Upload new note
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('title', title);
        formData.append('subject', subject);
        formData.append('classNumber', classNumber);
  
        await axios.post('http://localhost:5000/api/upload-pdf', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
  
      setFile(null);
      setTitle('');
      setSubject('');
      setClassNumber('');
      document.getElementById('file-upload').value = '';
      await fetchPdfs();
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to save PDF');
    } finally {
      setLoading(false);
    }
  };

  const handlePdfSelect = (pdf) => {
    setSelectedPdf(pdf);
    // Open the PDF in a new tab for viewing
    window.open(pdf.pdfUrl, '_blank');
  };

  const handleClosePdf = () => {
    setSelectedPdf(null);
  };

  const handleDownloadPdf = (pdf) => {
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = pdf.pdfUrl;
    link.setAttribute('download', `${pdf.title}.pdf`);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this PDF?')) {
      try {
        await axios.delete(`http://localhost:5000/api/pdfs/${id}`);
        setPdfs((prev) => prev.filter((pdf) => pdf._id !== id));
      } catch (err) {
        console.error('Delete error:', err);
        setError('Failed to delete PDF');
      }
    }
  };
  const handleEdit = (pdf) => {
    setTitle(pdf.title);
    setSubject(pdf.subject);
    setClassNumber(pdf.class);
    setEditMode(true);
    setEditId(pdf._id);
  };
  
  

  return (
    <div className="app">
      <header>
        <h1>PDF Database with Cloudinary</h1>
      </header>

      <div className="upload-section">
        <h2>Upload PDF</h2>
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label htmlFor="title">Title:</label>
            <input 
              type="text" 
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)} 
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="subject">Subject:</label>
            <input 
              type="text" 
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)} 
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="class">Class:</label>
            <input 
              type="text" 
              id="class"
              value={classNumber}
              onChange={(e) => setClassNumber(e.target.value)} 
              required
              placeholder="e.g. 10th, 12th, BCA"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="file-upload">PDF File:</label>
            <input 
              type="file" 
              id="file-upload"
              onChange={handleFileChange} 
              accept="application/pdf" 
              required
            />
          </div>
          
          <button type="submit" disabled={loading || !file}>
            {loading ? 'Uploading...' : 'Upload PDF'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>

      <div className="filter-section">
        <h2>Filter PDFs</h2>
        <div className="filters">
          <div className="form-group">
            <label htmlFor="filter-class">Class:</label>
            <select 
              id="filter-class" 
              value={selectedClass} 
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSubject('');
              }}
            >
              <option value="">All Classes</option>
              {classes.map((cls, index) => (
                <option key={index} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="filter-subject">Subject:</label>
            <select 
              id="filter-subject" 
              value={selectedSubject} 
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">All Subjects</option>
              {subjects.map((subj, index) => (
                <option key={index} value={subj}>{subj}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="pdf-gallery">
        <h2>Your PDFs</h2>
        {pdfs.length === 0 ? (
          <p>No PDFs found.</p>
        ) : (
          <div className="pdf-grid">
            {pdfs.map((pdf) => (
              <div key={pdf._id} className="pdf-card">
                <div className="thumbnail">
                  {/* This displays the first page of the PDF as an image */}
                  <img 
                    src={pdf.thumbnailUrl} 
                    alt={`Thumbnail for ${pdf.title}`} 
                    onClick={() => handlePdfSelect(pdf)}
                  />
                </div>
                <div className="pdf-info">
                  <h3>{pdf.title}</h3>
                  <p className="subject">{pdf.subject}</p>
                  <p className="class">Class: {pdf.class}</p>
                  <p className="pages">Pages: {pdf.pageCount}</p>
                  <p className="date">Uploaded: {new Date(pdf.uploadDate).toLocaleDateString()}</p>
                  <div className="pdf-actions">
                    <button 
                      onClick={() => handlePdfSelect(pdf)} 
                      className="view-btn"
                    >
                      View PDF
                    </button>
                    <button
                      onClick={() => handleDownloadPdf(pdf)}
                      className="download-btn"
                    >
                      Download
                    </button>
                    <div className="pdf-actions">
  
  <button onClick={() => handleEdit(pdf)}>Edit</button>
  <button onClick={() => handleDelete(pdf._id)}>Delete</button>
</div>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;