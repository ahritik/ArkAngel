import { useState, useMemo } from 'react';
import { FileInfo } from '../types';

export const useDocumentSearch = (files: FileInfo[]) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [contextFilter, setContextFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  
  // Get unique file types for filter dropdown
  const availableFileTypes = useMemo(() => {
    const types = new Set(files.map(file => file.file_type));
    return Array.from(types).sort();
  }, [files]);
  
  // Filtered files based on search and filters
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      // Text search - search in filename and content
      const matchesSearch = searchQuery === '' || 
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      // File type filter
      const matchesType = fileTypeFilter === 'all' || file.file_type === fileTypeFilter;
      
      // Context filter
      const matchesContext = contextFilter === 'all' || 
        (contextFilter === 'enabled' && file.is_context_enabled) ||
        (contextFilter === 'disabled' && !file.is_context_enabled);
      
      return matchesSearch && matchesType && matchesContext;
    });
  }, [files, searchQuery, fileTypeFilter, contextFilter]);
  
  // Search statistics
  const searchStats = useMemo(() => {
    const totalFiles = files.length;
    const filteredCount = filteredFiles.length;
    const contextEnabledCount = files.filter(f => f.is_context_enabled).length;
    const contextDisabledCount = totalFiles - contextEnabledCount;
    
    return {
      totalFiles,
      filteredCount,
      contextEnabledCount,
      contextDisabledCount,
      hasResults: filteredCount > 0,
      hasFilters: searchQuery !== '' || fileTypeFilter !== 'all' || contextFilter !== 'all'
    };
  }, [files, filteredFiles, searchQuery, fileTypeFilter, contextFilter]);
  
  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setFileTypeFilter('all');
    setContextFilter('all');
  };
  
  return {
    // State
    searchQuery,
    setSearchQuery,
    fileTypeFilter,
    setFileTypeFilter,
    contextFilter,
    setContextFilter,
    
    // Computed values
    filteredFiles,
    availableFileTypes,
    searchStats,
    
    // Actions
    clearFilters
  };
};
