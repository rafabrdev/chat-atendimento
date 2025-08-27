import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FiUpload,
  FiFile,
  FiImage,
  FiVideo,
  FiMusic,
  FiX,
  FiCheck,
  FiAlertCircle
} from 'react-icons/fi';
import uploadService from '../../services/uploadService';

const FileUpload = ({ conversationId, onFilesUploaded, maxFiles = 5 }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [errors, setErrors] = useState([]);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const newErrors = rejectedFiles.map(({ file, errors }) => ({
        name: file.name,
        errors: errors.map(e => e.message).join(', ')
      }));
      setErrors(newErrors);
      setTimeout(() => setErrors([]), 5000);
    }

    // Add accepted files
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));

    setFiles(prev => [...prev, ...newFiles].slice(0, maxFiles));
  }, [maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles,
    maxSize: 50 * 1024 * 1024, // 50MB
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'video/*': ['.mp4', '.avi', '.mov', '.webm'],
      'audio/*': ['.mp3', '.wav', '.ogg']
    }
  });

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getFileIcon = (file) => {
    const type = file.type;
    if (type.startsWith('image/')) return <FiImage className="w-5 h-5" />;
    if (type.startsWith('video/')) return <FiVideo className="w-5 h-5" />;
    if (type.startsWith('audio/')) return <FiMusic className="w-5 h-5" />;
    return <FiFile className="w-5 h-5" />;
  };

  const formatFileSize = (bytes) => {
    return uploadService.formatFileSize(bytes);
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      console.warn('[FileUpload] No files to upload');
      return;
    }
    
    if (!conversationId) {
      console.error('[FileUpload] No conversationId provided');
      setErrors([{
        name: 'Upload Error',
        errors: 'No conversation selected. Please select a conversation first.'
      }]);
      setTimeout(() => setErrors([]), 5000);
      return;
    }
    
    console.log('[FileUpload] Starting upload with conversationId:', conversationId);

    setUploading(true);
    const uploadedFiles = [];
    const uploadErrors = [];

    try {
      // Upload files sequentially using presigned URLs
      for (let i = 0; i < files.length; i++) {
        const { file, id } = files[i];
        
        try {
          // Set individual progress
          setUploadProgress(prev => ({ ...prev, [id]: 0 }));
          
          // Upload using presigned URL service
          const fileRecord = await uploadService.uploadFile(file, {
            conversationId,
            onProgress: (progress) => {
              setUploadProgress(prev => ({ ...prev, [id]: progress }));
              
              // Calculate total progress
              const totalProgress = ((i * 100) + progress) / files.length;
              setUploadProgress(prev => ({ ...prev, total: Math.round(totalProgress) }));
            }
          });
          
          uploadedFiles.push(fileRecord);
          setUploadProgress(prev => ({ ...prev, [id]: 100 }));
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          uploadErrors.push({
            name: file.name,
            errors: error.message
          });
        }
      }

      if (uploadedFiles.length > 0) {
        onFilesUploaded(uploadedFiles);
        setFiles([]);
        setUploadProgress({});
      }
      
      if (uploadErrors.length > 0) {
        setErrors(uploadErrors);
        setTimeout(() => setErrors([]), 5000);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrors([{
        name: 'Upload Failed',
        errors: error.message || 'Failed to upload files'
      }]);
      setTimeout(() => setErrors([]), 5000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-all duration-200
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }
        `}
      >
        <input {...getInputProps()} />
        <FiUpload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        {isDragActive ? (
          <p className="text-blue-600">Drop the files here...</p>
        ) : (
          <div>
            <p className="text-gray-600 mb-1">
              Drag & drop files here, or click to select
            </p>
            <p className="text-xs text-gray-400">
              Max {maxFiles} files, up to 50MB each
            </p>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mt-3 space-y-2">
          {errors.map((error, index) => (
            <div
              key={index}
              className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start"
            >
              <FiAlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-red-800">{error.name}</p>
                <p className="text-red-600">{error.errors}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map(({ file, id, preview }) => (
            <div
              key={id}
              className="bg-white border rounded-lg p-3 flex items-center"
            >
              {/* Preview or Icon */}
              <div className="mr-3 flex-shrink-0">
                {preview ? (
                  <img
                    src={preview}
                    alt={file.name}
                    className="w-10 h-10 object-cover rounded"
                    onLoad={() => URL.revokeObjectURL(preview)}
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-500">
                    {getFileIcon(file)}
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>

              {/* Remove Button */}
              {!uploading && (
                <button
                  onClick={() => removeFile(id)}
                  className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              )}

              {/* Upload Status */}
              {uploading && uploadProgress[id] !== undefined && (
                <div className="ml-2 flex items-center">
                  {uploadProgress[id] < 100 ? (
                    <div className="w-8 h-8">
                      <svg className="transform -rotate-90 w-8 h-8">
                        <circle
                          cx="16"
                          cy="16"
                          r="14"
                          stroke="currentColor"
                          strokeWidth="3"
                          fill="none"
                          className="text-gray-200"
                        />
                        <circle
                          cx="16"
                          cy="16"
                          r="14"
                          stroke="currentColor"
                          strokeWidth="3"
                          fill="none"
                          strokeDasharray={`${uploadProgress[id] * 0.88} 88`}
                          className="text-blue-500"
                        />
                      </svg>
                    </div>
                  ) : (
                    <FiCheck className="w-5 h-5 text-green-500" />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Upload Button */}
          <div className="flex justify-end mt-3">
            <button
              onClick={uploadFiles}
              disabled={uploading || files.length === 0}
              className={`
                px-4 py-2 rounded-md font-medium transition-colors
                ${uploading || files.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
                }
              `}
            >
              {uploading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading...
                </span>
              ) : (
                `Upload ${files.length} file${files.length > 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
