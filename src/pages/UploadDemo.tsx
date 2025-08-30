import React from "react";
import { EnhancedUploadInterface } from "../components/upload";

export const UploadDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Enhanced Document Upload Interface
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            A comprehensive document management system with drag-and-drop uploads, 
            real-time progress tracking, and intelligent search capabilities.
          </p>
        </div>
        
        <EnhancedUploadInterface />
      </div>
    </div>
  );
};
