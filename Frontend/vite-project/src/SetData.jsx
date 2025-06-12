// FRONTEND (React.js)

// App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [pdfs, setPdfs] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all PDFs on component mount
  useEffect(() => {
    fetchPdfs();
  }, []);

  const fetchPdfs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/pdfs');
      setPdfs(response.data);
    } catch (err) {
      console.error('Error fetching PDFs:', err);
      setError('Failed to load PDFs');
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      await axios.post('http://localhost:5000/api/upload-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Reset form and refresh PDF list
      setFile(null);
      document.getElementById('file-upload').value = '';
      fetchPdfs();
    } catch (err) {
      console.error('Error uploading PDF:', err);
      setError('Failed to upload PDF');
    } finally {
      setLoading(false);
    }
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
            <input 
              type="file" 
              id="file-upload"
              onChange={handleFileChange} 
              accept="application/pdf" 
            />
          </div>
          <button type="submit" disabled={loading || !file}>
            {loading ? 'Uploading...' : 'Upload PDF'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>

      <div className="pdf-gallery">
        <h2>Your PDFs</h2>
        {pdfs.length === 0 ? (
          <p>No PDFs uploaded yet.</p>
        ) : (
          <div className="pdf-grid">
            {pdfs.map((pdf) => (
              <div key={pdf._id} className="pdf-card">
                <div className="thumbnail">
                  {/* This displays the first page of the PDF as an image */}
                  <img src={pdf.thumbnailUrl} alt={`Thumbnail for ${pdf.title}`} />
                </div>
                <div className="pdf-info">
                  <h3>{pdf.title}</h3>
                  <p>Uploaded: {new Date(pdf.uploadDate).toLocaleDateString()}</p>
                  <a href={pdf.pdfUrl} target="_blank" rel="noopener noreferrer">
                    View PDF
                  </a>
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