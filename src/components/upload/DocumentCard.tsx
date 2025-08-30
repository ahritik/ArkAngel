import React, { useState } from "react";
import { File, Eye, Trash2, Check } from "lucide-react";
import { Button } from "../ui/button";
import { FileInfo } from "../../types";

interface DocumentCardProps {
  file: FileInfo;
  isSelected?: boolean;
  onSelect?: (fileId: string, selected: boolean) => void;
  onAction: (action: string, fileId: string) => void;
}

// File type icon mapping
const getFileTypeIcon = (fileType: string) => {
  const iconClass = "h-8 w-8 text-gray-500 dark:text-gray-400";
  
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return <File className={`${iconClass} text-red-500`} />;
    case 'txt':
    case 'md':
      return <File className={`${iconClass} text-blue-500`} />;
    case 'json':
    case 'xml':
    case 'yaml':
    case 'csv':
      return <File className={`${iconClass} text-green-500`} />;
    case 'py':
    case 'js':
    case 'ts':
    case 'java':
    case 'cpp':
    case 'c':
    case 'go':
    case 'rs':
    case 'php':
    case 'html':
    case 'css':
    case 'sql':
      return <File className={`${iconClass} text-purple-500`} />;
    default:
      return <File className={iconClass} />;
  }
};

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Format date
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Unknown date';
  }
};

export const DocumentCard: React.FC<DocumentCardProps> = ({
  file,
  isSelected = false,
  onSelect,
  onAction
}) => {
  const [showPreview, setShowPreview] = useState(false);
  
  // Handle file selection
  const handleSelect = () => {
    if (onSelect) {
      onSelect(file.id, !isSelected);
    }
  };
  
  // Handle action buttons
  const handleAction = (action: string) => {
    onAction(action, file.id);
  };
  
  // Toggle preview
  const togglePreview = () => {
    setShowPreview(!showPreview);
  };
  
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
      isSelected ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
    }`}>
      {/* Selection checkbox */}
      {onSelect && (
        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={handleSelect}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
              isSelected 
                ? 'bg-blue-500 border-blue-500 text-white' 
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        </div>
      )}
      
      {/* Header with file info */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          {getFileTypeIcon(file.file_type)}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {file.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(file.size)} • {formatDate(file.upload_date)} • {file.file_type.toUpperCase()}
            </p>
          </div>
        </div>
      </div>
      
      {/* Content preview */}
      <div className="p-4">
        <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
          {file.content.substring(0, 150)}
          {file.content.length > 150 && '...'}
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={file.is_context_enabled}
            onChange={() => handleAction('toggle_context')}
            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 focus:ring-offset-0"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400">Context</span>
        </label>
        
        <div className="flex space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePreview}
            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Preview content"
          >
            <Eye className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAction('delete')}
            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete file"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Expanded preview */}
      {showPreview && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          <div className="mt-3">
            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              File Content Preview
            </h4>
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-40 overflow-y-auto">
              <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
                {file.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
