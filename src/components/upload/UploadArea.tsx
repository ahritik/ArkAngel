import React, { useState, useRef, useCallback } from "react";
import { Upload, File, X, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";

interface UploadAreaProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  onFilesSelected,
  isUploading = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Handle drag enter
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    setIsDragOver(true);
  }, []);
  
  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter === 0) setIsDragOver(false);
  }, [dragCounter]);
  
  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);
  
  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    
    // Reset input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Process selected files
  const handleFiles = (files: File[]) => {
    const validFiles: File[] = [];
    const newErrors: string[] = [];
    
    // Validate each file
    files.forEach(file => {
      // Check file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        newErrors.push(`${file.name} is too large (max 100MB)`);
        return;
      }
      
      // Check file type
      const allowedTypes = [
        'text/plain', 'text/markdown', 'application/json', 'text/csv',
        'text/xml', 'text/yaml', 'text/plain', 'application/pdf',
        'text/x-python', 'text/javascript', 'text/typescript',
        'text/x-java-source', 'text/x-c++src', 'text/x-csrc',
        'text/x-go', 'text/x-rust', 'text/x-php', 'text/html',
        'text/css', 'text/x-sql'
      ];
      
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const allowedExtensions = [
        'txt', 'md', 'json', 'csv', 'xml', 'yaml', 'log',
        'py', 'js', 'ts', 'java', 'cpp', 'c', 'go', 'rs',
        'php', 'html', 'css', 'sql', 'pdf'
      ];
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
        newErrors.push(`${file.name} has an unsupported file type`);
        return;
      }
      
      validFiles.push(file);
    });
    
    // Update state
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setErrors(prev => [...prev, ...newErrors]);
    
    // Call parent callback with valid files
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };
  
  // Remove selected file
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // Remove error
  const removeError = (index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  };
  
  // Clear all
  const clearAll = () => {
    setSelectedFiles([]);
    setErrors([]);
  };
  
  // Handle upload button click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div className="space-y-4">
      {/* Drag and Drop Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Upload className={`mx-auto h-12 w-12 mb-4 ${
          isDragOver ? 'text-blue-500' : 'text-gray-400'
        }`} />
        
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          or{' '}
          <button
            type="button"
            onClick={handleUploadClick}
            className="text-blue-600 hover:text-blue-500 font-medium"
            disabled={isUploading}
          >
            browse files
          </button>
        </p>
        
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Supports: PDF, TXT, MD, JSON, CSV, XML, YAML, LOG, and code files
          <br />
          Max file size: 100MB
        </p>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.json,.csv,.xml,.yaml,.log,.py,.js,.ts,.java,.cpp,.c,.go,.rs,.php,.html,.css,.sql,.pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>
      
      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Selected Files ({selectedFiles.length})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear All
            </Button>
          </div>
          
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border"
              >
                <div className="flex items-center space-x-3">
                  <File className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-200 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Errors ({errors.length})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setErrors([])}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear
            </Button>
          </div>
          
          <div className="space-y-2">
            {errors.map((error, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-red-100 dark:bg-red-900/40 rounded border border-red-200 dark:border-red-800"
              >
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeError(index)}
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
