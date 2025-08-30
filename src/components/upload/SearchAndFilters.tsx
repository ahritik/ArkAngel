import React from "react";
import { Search, Filter, X, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  fileTypeFilter: string;
  onTypeFilterChange: (type: string) => void;
  contextFilter: 'all' | 'enabled' | 'disabled';
  onContextFilterChange: (filter: 'all' | 'enabled' | 'disabled') => void;
  availableFileTypes?: string[];
  searchStats?: {
    totalFiles: number;
    filteredCount: number;
    hasFilters: boolean;
  };
  onClearFilters?: () => void;
}

export const SearchAndFilters: React.FC<SearchAndFiltersProps> = ({
  searchQuery,
  onSearchChange,
  fileTypeFilter,
  onTypeFilterChange,
  contextFilter,
  onContextFilterChange,
  availableFileTypes = [],
  searchStats,
  onClearFilters
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search documents by name or content..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* File Type Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Type:
            </label>
            <select
              value={fileTypeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {availableFileTypes.map((type) => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          
          {/* Context Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Context:
            </label>
            <select
              value={contextFilter}
              onChange={(e) => onContextFilterChange(e.target.value as 'all' | 'enabled' | 'disabled')}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          
          {/* Clear Filters Button */}
          {searchStats?.hasFilters && onClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
        
        {/* Search Stats */}
        {searchStats && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {searchStats.hasFilters ? (
                <>
                  Showing {searchStats.filteredCount} of {searchStats.totalFiles} documents
                </>
              ) : (
                <>
                  {searchStats.totalFiles} document{searchStats.totalFiles !== 1 ? 's' : ''} total
                </>
              )}
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              {searchQuery && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Search: "{searchQuery}"
                </span>
              )}
              {fileTypeFilter !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  Type: {fileTypeFilter.toUpperCase()}
                </span>
              )}
              {contextFilter !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Context: {contextFilter === 'enabled' ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
