import React, { useState, useEffect, useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "../ui/button";
import { UploadArea } from "./UploadArea";
import { UploadProgress } from "./UploadProgress";
import { SearchAndFilters } from "./SearchAndFilters";
import { BulkOperations } from "./BulkOperations";
import { DocumentGrid } from "./DocumentGrid";
import { useDocumentSearch } from "../../hooks/useDocumentSearch";
import { FileInfo } from "../../types";

// Upload item interface for progress tracking
interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export const EnhancedUploadInterface = () => {
  // State management
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom hooks
  const { 
    filteredFiles, 
    searchQuery, 
    setSearchQuery, 
    fileTypeFilter, 
    setFileTypeFilter,
    contextFilter,
    setContextFilter
  } = useDocumentSearch(uploadedFiles);
  
  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);
  
  // Load files from backend
  const loadFiles = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke<FileInfo[]>('list_uploaded_files');
      setUploadedFiles(files);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };
  
  // Handle file selection for upload
  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    
    // Create upload queue items
    const uploadItems: UploadItem[] = files.map(file => ({
      id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending'
    }));
    
    setUploadQueue(prev => [...prev, ...uploadItems]);
    
    try {
      // Process each file sequentially
      for (const item of uploadItems) {
        await processFileUpload(item);
      }
      
      // Refresh file list after all uploads complete
      await loadFiles();
    } catch (error) {
      console.error('Upload processing failed:', error);
    } finally {
      setIsUploading(false);
      // Clear completed uploads from queue
      setUploadQueue(prev => prev.filter(item => item.status !== 'completed'));
    }
  };
  
  // Process individual file upload
  const processFileUpload = async (uploadItem: UploadItem) => {
    try {
      // Update status to uploading
      setUploadQueue(prev => prev.map(item => 
        item.id === uploadItem.id 
          ? { ...item, status: 'uploading', progress: 10 }
          : item
      ));
      
      // Convert file to byte array
      const fileData = await uploadItem.file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(fileData));
      
      // Update progress
      setUploadQueue(prev => prev.map(item => 
        item.id === uploadItem.id 
          ? { ...item, progress: 50 }
          : item
      ));
      
      // Send to Rust backend via Tauri invoke
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('upload_file', {
        fileData: bytes,
        filename: uploadItem.file.name
      });
      
      // Mark as completed
      setUploadQueue(prev => prev.map(item => 
        item.id === uploadItem.id 
          ? { ...item, status: 'completed', progress: 100 }
          : item
      ));
      
    } catch (error) {
      console.error(`Upload failed for ${uploadItem.file.name}:`, error);
      // Mark as error
      setUploadQueue(prev => prev.map(item => 
        item.id === uploadItem.id 
          ? { ...item, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
          : item
      ));
    }
  };
  
  // Handle file selection (checkbox)
  const handleFileSelect = (fileId: string, selected: boolean) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(fileId);
      } else {
        newSet.delete(fileId);
      }
      return newSet;
    });
  };
  
  // Handle file actions (preview, delete, context toggle)
  const handleFileAction = async (action: string, fileId: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      switch (action) {
        case 'delete':
          await invoke('delete_uploaded_file', { fileId });
          await loadFiles();
          // Remove from selection if selected
          setSelectedFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
          break;
          
        case 'toggle_context':
          await invoke('toggle_file_context', { fileId });
          await loadFiles();
          break;
          
        case 'preview':
          // Handle preview (will implement in DocumentCard)
          console.log('Preview file:', fileId);
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} file:`, error);
    }
  };
  
  // Handle bulk operations
  const handleBulkAction = async (action: string, fileIds: string[]) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      switch (action) {
        case 'context_enable':
          for (const fileId of fileIds) {
            await invoke('toggle_file_context', { fileId });
          }
          break;
          
        case 'context_disable':
          for (const fileId of fileIds) {
            await invoke('toggle_file_context', { fileId });
          }
          break;
          
        case 'delete':
          for (const fileId of fileIds) {
            await invoke('delete_uploaded_file', { fileId });
          }
          break;
      }
      
      // Refresh files and clear selection
      await loadFiles();
      setSelectedFiles(new Set());
      
    } catch (error) {
      console.error(`Bulk ${action} failed:`, error);
    }
  };
  
  // Handle upload button click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFilesSelected(files);
    }
    // Reset input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div className="space-y-6 p-6 bg-white dark:bg-gray-900 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Document Upload
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Upload and manage documents for AI context
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {selectedFiles.size > 0 && (
            <BulkOperations 
              selectedFiles={Array.from(selectedFiles)}
              onBulkAction={handleBulkAction}
            />
          )}
          <Button onClick={handleUploadClick} className="bg-blue-600 hover:bg-blue-700">
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      </div>
      
      {/* Upload Area */}
      <UploadArea 
        onFilesSelected={handleFilesSelected}
        isUploading={uploadQueue.length > 0}
      />
      
      {/* Progress */}
      {uploadQueue.length > 0 && (
        <UploadProgress uploads={uploadQueue} />
      )}
      
      {/* Search and Filters */}
      <SearchAndFilters 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        fileTypeFilter={fileTypeFilter}
        onTypeFilterChange={setFileTypeFilter}
        contextFilter={contextFilter}
        onContextFilterChange={setContextFilter}
      />
      
      {/* Document Grid */}
      <DocumentGrid 
        files={filteredFiles}
        selectedFiles={selectedFiles}
        onFileSelect={handleFileSelect}
        onFileAction={handleFileAction}
      />
      
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
  );
};
