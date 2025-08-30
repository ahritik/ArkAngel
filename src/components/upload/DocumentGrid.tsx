import React from "react";
import { DocumentCard } from "./DocumentCard";
import { FileInfo } from "../../types";

interface DocumentGridProps {
  files: FileInfo[];
  selectedFiles: Set<string>;
  onFileSelect: (fileId: string, selected: boolean) => void;
  onFileAction: (action: string, fileId: string) => void;
}

export const DocumentGrid: React.FC<DocumentGridProps> = ({
  files,
  selectedFiles,
  onFileSelect,
  onFileAction
}) => {
  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No documents found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Upload some documents to get started, or try adjusting your search filters.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Grid Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Documents ({files.length})
          </h3>
          
          {selectedFiles.size > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {selectedFiles.size} selected
            </span>
          )}
        </div>
        
        {/* Grid View Options */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Grid View
          </span>
        </div>
      </div>
      
      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {files.map((file) => (
          <div key={file.id} className="relative">
            <DocumentCard
              file={file}
              isSelected={selectedFiles.has(file.id)}
              onSelect={onFileSelect}
              onAction={onFileAction}
            />
          </div>
        ))}
      </div>
      
      {/* Empty State for No Results */}
      {files.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No documents match your search
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search terms or filters to find what you're looking for.
          </p>
        </div>
      )}
    </div>
  );
};
