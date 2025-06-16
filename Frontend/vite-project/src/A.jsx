import React, { useState, useEffect } from 'react';
import { Upload, Edit, Trash2, Download, Eye, Plus, BarChart3, BookOpen, Users, FileText } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  const [currentView, setCurrentView] = useState('user');
  const [pdfs, setPdfs] = useState([]);
  const [filteredPdfs, setFilteredPdfs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  
  // Filters
  const [classFilter, setClassFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPdf, setEditingPdf] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    class: '',
    subject: '',
    file: null
  });

  const classes = [6, 7, 8, 9, 10, 11, 12];
  const subjects = ['biology', 'physics', 'chemistry'];

  useEffect(() => {
    fetchPdfs();
    if (currentView === 'admin') {
      fetchStats();
    }
  }, [currentView]);

  useEffect(() => {
    filterPdfs();
  }, [pdfs, classFilter, subjectFilter]);

  const fetchPdfs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/pdfs`);
      const data = await response.json();
      setPdfs(data);
    } catch (error) {
      console.error('Error fetching PDFs:', error);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const filterPdfs = () => {
    let filtered = pdfs;
    
    if (classFilter) {
      filtered = filtered.filter(pdf => pdf.class === parseInt(classFilter));
    }
    
    if (subjectFilter) {
      filtered = filtered.filter(pdf => pdf.subject === subjectFilter);
    }
    
    setFilteredPdfs(filtered);
  };

  const handleSubmit = async () => {
    const formDataObj = new FormData();
    formDataObj.append('title', formData.title);
    formDataObj.append('description', formData.description);
    formDataObj.append('class', formData.class);
    formDataObj.append('subject', formData.subject);
    if (formData.file) {
      formDataObj.append('pdf', formData.file);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/pdfs`, {
        method: 'POST',
        body: formDataObj
      });
      
      if (response.ok) {
        setShowAddModal(false);
        setFormData({ title: '', description: '', class: '', subject: '', file: null });
        fetchPdfs();
      }
    } catch (error) {
      console.error('Error uploading PDF:', error);
    }
  };

  const handleEdit = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/pdfs/${editingPdf._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          class: formData.class,
          subject: formData.subject
        })
      });
      
      if (response.ok) {
        setShowEditModal(false);
        setEditingPdf(null);
        setFormData({ title: '', description: '', class: '', subject: '', file: null });
        fetchPdfs();
      }
    } catch (error) {
      console.error('Error updating PDF:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this PDF?')) {
      try {
        const response = await fetch(`${API_BASE_URL}/pdfs/${id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          fetchPdfs();
        }
      } catch (error) {
        console.error('Error deleting PDF:', error);
      }
    }
  };

  const openEditModal = (pdf) => {
    setEditingPdf(pdf);
    setFormData({
      title: pdf.title,
      description: pdf.description,
      class: pdf.class.toString(),
      subject: pdf.subject,
      file: null
    });
    setShowEditModal(true);
  };

  const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  };

  const PDFCard = ({ pdf, isAdmin = false }) => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <img 
        src={pdf.thumbnailUrl} 
        alt={pdf.title}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2">{pdf.title}</h3>
        <p className="text-gray-600 text-sm mb-3">{pdf.description}</p>
        <div className="flex justify-between items-center mb-3">
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
            Class {pdf.class}
          </span>
          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm capitalize">
            {pdf.subject}
          </span>
        </div>
        <div className="flex gap-2">
          <a 
            href={pdf.pdfUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex-1 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-center text-sm flex items-center justify-center gap-1"
          >
            <Eye size={16} />
            View
          </a>
          <a 
            href={pdf.pdfUrl} 
            download
            className="flex-1 bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 text-center text-sm flex items-center justify-center gap-1"
          >
            <Download size={16} />
            Download
          </a>
          {isAdmin && (
            <>
              <button 
                onClick={() => openEditModal(pdf)}
                className="bg-yellow-500 text-white px-3 py-2 rounded hover:bg-yellow-600 text-sm flex items-center justify-center"
              >
                <Edit size={16} />
              </button>
              <button 
                onClick={() => handleDelete(pdf._id)}
                className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 text-sm flex items-center justify-center"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const AdminStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center">
          <FileText className="h-8 w-8 text-blue-500" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Total PDFs</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalPDFs || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center">
          <Users className="h-8 w-8 text-green-500" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Classes Covered</p>
            <p className="text-2xl font-bold text-gray-900">{stats.pdfsByClass?.length || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center">
          <BookOpen className="h-8 w-8 text-purple-500" />
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Subjects</p>
            <p className="text-2xl font-bold text-gray-900">{stats.pdfsBySubject?.length || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">PDF Manager</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentView('user')}
                className={`px-4 py-2 rounded ${currentView === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                User View
              </button>
              <button
                onClick={() => setCurrentView('admin')}
                className={`px-4 py-2 rounded ${currentView === 'admin' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Admin Panel
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'admin' && <AdminStats />}
        
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls} value={cls}>Class {cls}</option>
              ))}
            </select>
            
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject} value={subject} className="capitalize">
                  {subject}
                </option>
              ))}
            </select>
          </div>
          
          {currentView === 'admin' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <Plus size={16} />
              Add PDF
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPdfs.map(pdf => (
              <PDFCard key={pdf._id} pdf={pdf} isAdmin={currentView === 'admin'} />
            ))}
          </div>
        )}

        {filteredPdfs.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            No PDFs found matching your criteria.
          </div>
        )}
      </main>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New PDF"
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            className="w-full border rounded px-3 py-2"
          />
          
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full border rounded px-3 py-2"
            rows="3"
          />
          
          <select
            value={formData.class}
            onChange={(e) => setFormData({...formData, class: e.target.value})}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select Class</option>
            {classes.map(cls => (
              <option key={cls} value={cls}>Class {cls}</option>
            ))}
          </select>
          
          <select
            value={formData.subject}
            onChange={(e) => setFormData({...formData, subject: e.target.value})}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select Subject</option>
            {subjects.map(subject => (
              <option key={subject} value={subject} className="capitalize">
                {subject}
              </option>
            ))}
          </select>
          
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFormData({...formData, file: e.target.files[0]})}
            className="w-full border rounded px-3 py-2"
          />
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(false)}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Upload
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit PDF"
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            className="w-full border rounded px-3 py-2"
          />
          
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full border rounded px-3 py-2"
            rows="3"
          />
          
          <select
            value={formData.class}
            onChange={(e) => setFormData({...formData, class: e.target.value})}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select Class</option>
            {classes.map(cls => (
              <option key={cls} value={cls}>Class {cls}</option>
            ))}
          </select>
          
          <select
            value={formData.subject}
            onChange={(e) => setFormData({...formData, subject: e.target.value})}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select Subject</option>
            {subjects.map(subject => (
              <option key={subject} value={subject} className="capitalize">
                {subject}
              </option>
            ))}
          </select>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditModal(false)}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Update
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default App;