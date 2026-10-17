"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { File as FileIcon, X } from "lucide-react";

interface FilePreviewProps {
  files: File[];
  onRemove: (index: number) => void;
}

function PreviewImage({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <Image
      src={url}
      alt={file.name}
      width={64}
      height={64}
      unoptimized
      className="object-cover w-full h-full"
    />
  );
}

export function FilePreview({ files, onRemove }: FilePreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 py-2 bg-surface/50 border-t border-border overflow-x-auto">
      {files.map((file, index) => (
        <div key={`${file.name}-${file.lastModified}-${index}`} className="relative flex-shrink-0 group">
          {file.type.startsWith("image/") ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-border">
              <PreviewImage file={file} />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-surface border border-border flex flex-col items-center justify-center p-2">
              <FileIcon className="w-5 h-5 text-secondary mb-1" />
              <span className="text-[9px] text-secondary truncate w-full text-center">
                {file.name.slice(0, 8)}...
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            aria-label={`Remove ${file.name}`}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
