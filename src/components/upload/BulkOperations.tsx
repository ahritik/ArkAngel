import React, { useState } from "react";
import { MoreHorizontal, CheckCircle, XCircle, Trash2, Download } from "lucide-react";
import { Button } from "../ui/button";

interface BulkOperationsProps {
  selectedFiles: string[];
  onBulkAction: (action: string, fileIds: string[]) => void;
}

export const BulkOperations: React.FC<BulkOperationsProps> = ({
  selectedFiles,
  onBulkAction
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (selectedFiles.length === 0) return null;
  
  const handleAction = (action: string) => {
    onBulkAction(action, selectedFiles);
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      {/* Selected Files Badge */}
      <div className="flex items-center space-x-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {selectedFiles.length} selected
        </span>
        
        {/* Bulk Actions Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-1"
          >
            <span>Actions</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          
          {/* Dropdown Menu */}
          {isOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsOpen(false)}
              />
              
              {/* Menu */}
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                <div className="py-1">
                  {/* Context Actions */}
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Context
                  </div>
                  
                  <button
                    onClick={() => handleAction('context_enable')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Enable Context</span>
                  </button>
                  
                  <button
                    onClick={() => handleAction('context_disable')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <XCircle className="h-4 w-4 text-yellow-500" />
                    <span>Disable Context</span>
                  </button>
                  
                  {/* File Actions */}
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-t border-gray-200 dark:border-gray-700 mt-2">
                    Files
                  </div>
                  
                  <button
                    onClick={() => handleAction('download')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4 text-blue-500" />
                    <span>Download Selected</span>
                  </button>
                  
                  <button
                    onClick={() => handleAction('delete')}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Selected</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Quick Actions (for small selections) */}
      {selectedFiles.length <= 3 && (
        <div className="flex items-center space-x-2 ml-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAction('context_enable')}
            className="h-8 px-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Enable
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAction('context_disable')}
            className="h-8 px-2 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Disable
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAction('delete')}
            className="h-8 px-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
};
