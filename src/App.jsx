import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { Upload, FileText, Download, RotateCcw, CheckCircle, AlertCircle, Loader2, Github, Linkedin, Mail } from 'lucide-react'
import GravityBubbles from './GravityBubbles'
import './index.css'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

function App() {
  console.log("EasyConverter Booting...")
  const [file, setFile] = useState(null)
  const [targetFormat, setTargetFormat] = useState('')
  const [taskId, setTaskId] = useState(null)
  const [status, setStatus] = useState('idle') // idle, uploading, processing, completed, failed
  const [error, setError] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const fileInputRef = useRef(null)

  const allowedFormats = {
    'pdf': ['docx', 'pptx', 'png', 'jpg'],
    'docx': ['pdf', 'pptx'],
    'pptx': ['pdf'],
    'ppt': ['pdf'],
    'png': ['pdf', 'jpg', 'pptx'],
    'jpg': ['pdf', 'png', 'pptx'],
    'jpeg': ['pdf', 'png', 'pptx']
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setTargetFormat('')
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file || !targetFormat) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      setStatus('uploading')
      const response = await axios.post(`${API_BASE}/upload?target_format=${targetFormat}`, formData)
      setTaskId(response.data.task_id)
      setStatus('processing')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Upload failed'
      setError(msg)
      console.error("Upload Error:", err)
      setStatus('failed')
    }
  }

  useEffect(() => {
    let interval
    if (status === 'processing' && taskId) {
      interval = setInterval(async () => {
        try {
          const response = await axios.get(`${API_BASE}/status/${taskId}`)
          if (response.data.status === 'completed') {
            setStatus('completed')
            setDownloadUrl(`${API_BASE}/download/${taskId}`)
            clearInterval(interval)
          } else if (response.data.status === 'failed') {
            setStatus('failed')
            setError(response.data.error || 'Conversion failed')
            clearInterval(interval)
          }
        } catch (err) {
          setError('Failed to fetch status')
          setStatus('failed')
          clearInterval(interval)
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [status, taskId])

  const reset = () => {
    setFile(null)
    setTargetFormat('')
    setTaskId(null)
    setStatus('idle')
    setError(null)
    setDownloadUrl(null)
  }

  const getTargetOptions = () => {
    if (!file) return []
    const ext = file.name.split('.').pop().toLowerCase()
    return allowedFormats[ext] || []
  }

  return (
    <>
      <GravityBubbles />
      <div className="app-container">
        <h1>EasyConverter</h1>
        <p className="subtitle">Document format converter</p>

        {status === 'idle' && (
          <>
            <div
              className="upload-zone"
              onClick={() => fileInputRef.current.click()}
            >
              <input
                type="file"
                hidden
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg"
              />
              <Upload className="upload-icon" size={48} />
              <h3>{file ? file.name : 'Select or drop a file'}</h3>
              <p style={{ marginTop: '8px', color: '#94a3b8' }}>PDF, DOCX, PPTX, Images (Max 10MB)</p>
            </div>

            {file && (
              <div className="format-selection">
                <label className="format-label">Target Format</label>
                <select
                  value={targetFormat}
                  onChange={(e) => setTargetFormat(e.target.value)}
                >
                  <option value="">Select format...</option>
                  {getTargetOptions().map(fmt => (
                    <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                  ))}
                </select>

                <button
                  className="convert-btn"
                  disabled={!targetFormat}
                  onClick={handleUpload}
                >
                  Convert Now
                </button>
              </div>
            )}
          </>
        )}

        {(status === 'uploading' || status === 'processing') && (
          <div className="status-panel">
            <Loader2 className="upload-icon animate-spin" size={48} />
            <h3>{status === 'uploading' ? 'Uploading...' : 'Converting...'}</h3>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: status === 'uploading' ? '30%' : '70%' }}></div>
            </div>
            <p className="status-message">Please wait while we process your file.</p>
          </div>
        )}

        {status === 'completed' && (
          <div className="status-panel">
            <CheckCircle className="upload-icon" style={{ color: 'var(--success)' }} size={48} />
            <h3>Conversion Complete!</h3>
            <p className="status-message" style={{ marginBottom: '24px' }}>Your file is ready for download!.</p>

            <a href={downloadUrl} className="download-btn" target="_blank" rel="noopener noreferrer">
              <Download size={20} />
              Download {targetFormat.toUpperCase()}
            </a>

            <span className="reset-link" onClick={reset}>
              <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Convert another file
            </span>
          </div>
        )}

        {status === 'failed' && (
          <div className="status-panel">
            <AlertCircle className="upload-icon" style={{ color: 'var(--error)' }} size={48} />
            <h3>Oops! Something went wrong</h3>
            <p className="error-message">{error}</p>

            <button className="convert-btn" onClick={reset}>
              Try Again
            </button>
          </div>
        )}

        {error && status !== 'failed' && (
          <div className="error-message">
            <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            {error}
          </div>
        )}
      </div>
      <div className="footer">
        <a href="https://github.com/vaishnavanS" target="_blank" rel="noopener noreferrer" className="icon-circle">
          <Github size={20} />
        </a>
        <a href="https://www.linkedin.com/in/vaishnavan10/" target="_blank" rel="noopener noreferrer" className="icon-circle">
          <Linkedin size={20} />
        </a>
        <a href="mailto:vaishnavans31@gmail.com" className="icon-circle">
          <Mail size={20} />
        </a>
      </div>
    </>
  )
}

export default App
