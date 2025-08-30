import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, File, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface FileInfo {
  id: string;
  name: string;
  file_type: string;
  size: number;
  upload_date: string;
  content: string;
  is_context_enabled: boolean;
}

export const FileUploadSettings = () => {
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const files = await invoke<FileInfo[]>('list_uploaded_files');
      setUploadedFiles(files);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const handleFileUpload = async () => {
    // 1. Create hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.txt,.md,.json,.csv,.xml,.yaml,.log,.py,.js,.ts,.java,.cpp,.c,.go,.rs,.php,.html,.css,.sql,.pdf';
    
    // 2. Handle file selection
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.files) return;
      
      setIsUploading(true);
      
      try {
        // 3. Process each selected file
        for (const file of Array.from(target.files)) {
          // 4. Convert file to byte array
          const fileData = await file.arrayBuffer();
          const bytes = Array.from(new Uint8Array(fileData));
          
          // 5. Send to Rust backend via Tauri
          await invoke('upload_file', {
            fileData: bytes,
            filename: file.name
          });
        }
        
        // 6. Refresh file list
        await loadFiles();
      } catch (error) {
        console.error('Upload failed:', error);
      } finally {
        setIsUploading(false);
      }
    };
    
    // 7. Trigger file picker
    input.click();
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await invoke('delete_uploaded_file', { fileId });
      await loadFiles();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleToggleContext = async (fileId: string) => {
    try {
      await invoke('toggle_file_context', { fileId });
      await loadFiles();
    } catch (error) {
      console.error('Toggle context failed:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">File Uploads</h4>
        <p className="text-xs text-muted-foreground">
          Upload files to provide context for AI conversations
        </p>
      </div>
      
      {/* Upload Button */}
      <Button 
        onClick={handleFileUpload} 
        disabled={isUploading}
        className="w-full"
        variant="outline"
      >
        <Upload className="h-4 w-4 mr-2" />
        {isUploading ? 'Uploading...' : 'Upload Files'}
      </Button>
      
      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">Uploaded Files</h5>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-2 border rounded-lg text-xs">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <File className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-muted-foreground">
                      {formatFileSize(file.size)} • {formatDate(file.upload_date)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={file.is_context_enabled}
                    onChange={() => handleToggleContext(file.id)}
                    className="h-3 w-3"
                    title={file.is_context_enabled ? "Disable context" : "Enable context"}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFile(file.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    title="Delete file"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
