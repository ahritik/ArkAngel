import React from "react";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface UploadProgressProps {
  uploads: UploadItem[];
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ uploads }) => {
  // Calculate overall progress
  const totalProgress = uploads.length > 0 
    ? uploads.reduce((acc, upload) => acc + upload.progress, 0) / uploads.length 
    : 0;
  
  // Get status counts
  const statusCounts = uploads.reduce((acc, upload) => {
    acc[upload.status] = (acc[upload.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'uploading':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };
  
  // Get progress bar color
  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'uploading':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };
  
  if (uploads.length === 0) return null;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Header with overall progress */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Upload Progress
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {statusCounts.completed || 0} completed • {statusCounts.uploading || 0} uploading • {statusCounts.error || 0} failed
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {Math.round(totalProgress)}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Overall Progress
          </div>
        </div>
      </div>
      
      {/* Overall progress bar */}
      <div className="mb-6">
        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>
      
      {/* Individual file progress */}
      <div className="space-y-3">
        {uploads.map((upload) => (
          <div key={upload.id} className="space-y-2">
            {/* File info and status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(upload.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {upload.file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-sm font-medium ${getStatusColor(upload.status)}`}>
                  {upload.status === 'completed' && 'Complete'}
                  {upload.status === 'error' && 'Failed'}
                  {upload.status === 'uploading' && `${upload.progress}%`}
                  {upload.status === 'pending' && 'Pending'}
                </div>
                {upload.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {upload.error}
                  </p>
                )}
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`${getProgressBarColor(upload.status)} h-2 rounded-full transition-all duration-300`}
                style={{ width: `${upload.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      
      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {statusCounts.completed || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {statusCounts.uploading || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Uploading</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {statusCounts.error || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Failed</div>
          </div>
        </div>
      </div>
    </div>
  );
};
