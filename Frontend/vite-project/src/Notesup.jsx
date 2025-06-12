import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, EyeOff, Upload, X } from 'lucide-react';

const PdfNotesApp = () => {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [previewStates, setPreviewStates] = useState({});
  const [uploadData, setUploadData] = useState({
    title: '',
    subject: '',
    classNumber: ''
  });
  const [error, setError] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);

  // API Base URL - Change this to match your backend URL
  const API_BASE_URL = 'http://localhost:5000';

  // Fetch all PDFs from backend
  const fetchPdfs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/api/pdfs`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setPdfs(data);
      console.log('Fetched PDFs:', data);
      
    } catch (error) {
      console.error('Error fetching PDFs:', error);
      setError('Failed to fetch notes. Please make sure your backend server is running on port 5000.');
      
      // Fallback to mock data for demonstration
      const mockPdfs = [
        {
          _id: '1',
          title: "Newton's Laws of Motion",
          subject: 'Physics',
          class: 'Class 11',
          thumbnailUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop',
          pdfUrl: '#',
          uploadDate: new Date()
        },
        {
          _id: '2',
          title: "Periodic Table and Element Properties",
          subject: 'Chemistry',
          class: 'Class 10',
          thumbnailUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=300&fit=crop',
          pdfUrl: '#',
          uploadDate: new Date()
        }
      ];
      setPdfs(mockPdfs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdfs();
  }, []);

  const togglePreview = (pdfId) => {
    setPreviewStates(prev => ({
      ...prev,
      [pdfId]: !prev[pdfId]
    }));
  };

  const getSubjectColor = (subject) => {
    const colors = {
      'Physics': 'bg-blue-50 text-blue-700 border-blue-200',
      'Chemistry': 'bg-purple-50 text-purple-700 border-purple-200',
      'Biology': 'bg-green-50 text-green-700 border-green-200'
    };
    return colors[subject] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getSubjectIcon = (subject) => {
    return subject === 'Physics' ? '⚡' : subject === 'Chemistry' ? '🧪' : '🧬';
  };

  const handleUpload = async () => {
    try {
      if (!uploadData.title || !uploadData.subject || !uploadData.classNumber || !uploadFile) {
        alert('Please fill all fields and select a PDF file');
        return;
      }

      const formData = new FormData();
      formData.append('pdf', uploadFile);
      formData.append('title', uploadData.title);
      formData.append('subject', uploadData.subject);
      formData.append('classNumber', uploadData.classNumber);

      const response = await fetch(`${API_BASE_URL}/api/upload-pdf`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      
      // Refresh the PDF list
      await fetchPdfs();
      
      // Reset form and close modal
      setUploadData({ title: '', subject: '', classNumber: '' });
      setUploadFile(null);
      setShowUploadForm(false);
      
      alert('PDF uploaded successfully!');
      
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert('Failed to upload PDF. Please try again.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadFile(file);
    } else {
      alert('Please select a valid PDF file');
      e.target.value = '';
    }
  };

  const handleDownload = async (pdf) => {
    try {
      if (pdf.pdfUrl) {
        // If it's a Cloudinary URL, open directly
        window.open(pdf.pdfUrl, '_blank');
      } else if (pdf.filepath) {
        // If it's a local file path, use it
        window.open(pdf.filepath, '_blank');
      } else {
        alert('PDF file not available');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Notes</span>
              </div>
            </div>
            
            <nav className="hidden md:flex space-x-8">
              <a href="#" className="text-gray-500 hover:text-gray-900">Home</a>
              <a href="#" className="text-blue-600 font-medium">Notes</a>
              <a href="#" className="text-gray-500 hover:text-gray-900">Videos</a>
              <a href="#" className="text-gray-500 hover:text-gray-900">Blog</a>
              <a href="#" className="text-gray-500 hover:text-gray-900">Services</a>
              <a href="#" className="text-gray-500 hover:text-gray-900">About</a>
              <a href="#" className="text-gray-500 hover:text-gray-900">Contact</a>
            </nav>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowUploadForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Upload PDF</span>
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {pdfs.length} Notes Found
          </h1>
        </div>

        {/* Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pdfs.map((pdf) => (
            <div key={pdf._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`px-2 py-1 rounded-full text-xs border ${getSubjectColor(pdf.subject)}`}>
                      <span className="mr-1">{getSubjectIcon(pdf.subject)}</span>
                      {pdf.subject}
                    </div>
                    <span className="text-sm text-gray-500">{pdf.class}</span>
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  </div>
                </div>
                
                <h3 className="font-semibold text-gray-900 text-lg mb-2">
                  {pdf.title}
                </h3>
                
                <p className="text-gray-600 text-sm">
                  {pdf.subject === 'Physics' && "Comprehensive notes covering Newton's three laws of motion with examples and applications."}
                  {pdf.subject === 'Chemistry' && "Detailed explanation of the periodic table, element groups, and their properties."}
                  {pdf.subject === 'Biology' && "Comprehensive notes on cell organelles, their structures, and functions in plant and animal cells."}
                </p>
              </div>

              {/* Preview Section */}
              {previewStates[pdf._id] && (
                <div className="p-4 bg-gray-50">
                  {pdf.thumbnailUrl ? (
                    <img
                      src={pdf.thumbnailUrl}
                      alt={pdf.title}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop';
                      }}
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                      <FileText className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <button
                    onClick={() => handleDownload(pdf)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                  >
                    <FileText className="h-4 w-4" />
                    <span>View Full PDF</span>
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="p-4 flex items-center justify-between">
                <button
                  onClick={() => togglePreview(pdf._id)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-blue-600"
                >
                  {previewStates[pdf._id] ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      <span>Hide Preview</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      <span>Show Preview</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => handleDownload(pdf)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-green-600"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Upload PDF</h2>
              <button
                onClick={() => setShowUploadForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={uploadData.title}
                  onChange={(e) => setUploadData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <select
                  value={uploadData.subject}
                  onChange={(e) => setUploadData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Subject</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class
                </label>
                <select
                  value={uploadData.classNumber}
                  onChange={(e) => setUploadData(prev => ({ ...prev, classNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Class</option>
                  <option value="Class 9">Class 9</option>
                  <option value="Class 10">Class 10</option>
                  <option value="Class 11">Class 11</option>
                  <option value="Class 12">Class 12</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PDF File
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {uploadFile && (
                  <p className="text-sm text-green-600 mt-1">
                    Selected: {uploadFile.name}
                  </p>
                )}
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowUploadForm(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfNotesApp;