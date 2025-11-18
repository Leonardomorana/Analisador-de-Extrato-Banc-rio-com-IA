
import React, { useCallback, useState } from 'react';
import { UploadCloudIcon } from './icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert("Por favor, envie um arquivo de imagem (PNG, JPG) ou PDF.");
      }
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
       const file = e.target.files[0];
       onFileSelect(file);
    }
  };

  return (
    <div 
        className={`relative flex flex-col items-center justify-center w-full p-12 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
    >
        <input 
            type="file"
            id="file-upload"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept="image/*,application/pdf"
            onChange={handleChange}
        />
      <div className="text-center pointer-events-none">
        <UploadCloudIcon className="mx-auto h-12 w-12 text-slate-400" />
        <p className="mt-2 text-lg font-semibold text-slate-700">
          Clique para enviar ou arraste e solte
        </p>
        <p className="text-sm text-slate-500">
          PDF, PNG, JPG, GIF ou WEBP
        </p>
      </div>
    </div>
  );
};
