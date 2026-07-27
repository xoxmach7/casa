"use client"

import { useState, useRef, useCallback } from "react"
import { Upload, X, Image, Video, File, Loader2, Maximize2, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { API_URL } from "@/lib/config"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '')

const getFileUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${BACKEND_BASE}${url}`
}

interface UploadedFile {
  fileName: string
  originalName: string
  mimeType: string
  size: number
  category: string
  url: string
}

interface FileUploadProps {
  onUpload: (files: UploadedFile[]) => void
  onRemove?: (url: string) => void
  existingFiles?: string[]
  accept?: string
  multiple?: boolean
  maxFiles?: number
  maxSize?: number // in MB
  category?: "images" | "videos" | "documents" | "all"
  className?: string
}

export function FileUpload({
  onUpload,
  onRemove,
  existingFiles = [],
  accept,
  multiple = true,
  maxFiles = 10,
  maxSize = 50,
  category = "all",
  className,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<string[]>(existingFiles)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const acceptTypes = accept || {
    images: "image/jpeg,image/png,image/webp,image/gif",
    videos: "video/mp4,video/webm,video/quicktime",
    documents: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    all: "image/*,video/*,application/pdf,.doc,.docx",
  }[category]

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    // Check max files
    if (files.length + selectedFiles.length > maxFiles) {
      setError(`Максимум ${maxFiles} файлов`)
      return
    }

    // Check file sizes
    for (const file of Array.from(selectedFiles)) {
      if (file.size > maxSize * 1024 * 1024) {
        setError(`Файл ${file.name} слишком большой (макс. ${maxSize}MB)`)
        return
      }
    }

    setUploading(true)
    setError(null)
    setProgress(0)

    try {
      const token = localStorage.getItem("token")
      const formData = new FormData()

      if (multiple && selectedFiles.length > 1) {
        Array.from(selectedFiles).forEach((file) => {
          formData.append("files", file)
        })

        const response = await fetch(`${API_URL}/upload/multiple`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (!response.ok) {
          throw new Error("Ошибка загрузки")
        }

        const data = await response.json()
        const newUrls = data.files.map((f: UploadedFile) => f.url)
        setFiles((prev) => [...prev, ...newUrls])
        onUpload(data.files)
      } else {
        formData.append("file", selectedFiles[0])

        const response = await fetch(`${API_URL}/upload/single`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (!response.ok) {
          throw new Error("Ошибка загрузки")
        }

        const data = await response.json()
        setFiles((prev) => [...prev, data.file.url])
        onUpload([data.file])
      }

      setProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }, [files, maxFiles, maxSize, multiple, onUpload])

  const handleRemove = useCallback((url: string) => {
    setFiles((prev) => prev.filter((f) => f !== url))
    onRemove?.(url)
  }, [onRemove])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0 && fileInputRef.current) {
      const dataTransfer = new DataTransfer()
      Array.from(droppedFiles).forEach((file) => dataTransfer.items.add(file))
      fileInputRef.current.files = dataTransfer.files
      fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }))
    }
  }, [])

  const getFileIcon = (url: string) => {
    if (url.includes("/images/") || url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return <Image className="h-4 w-4" />
    }
    if (url.includes("/videos/") || url.match(/\.(mp4|webm|mov)$/i)) {
      return <Video className="h-4 w-4" />
    }
    return <File className="h-4 w-4" />
  }

  const isImage = (url: string) => {
    return url.includes("/images/") || url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          uploading ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
          "cursor-pointer"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Загрузка... {progress}%</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Нажмите или перетащите файлы</p>
            <p className="text-xs text-muted-foreground">
              {category === "images" && "PNG, JPG, WEBP до "}
              {category === "videos" && "MP4, WEBM до "}
              {category === "documents" && "PDF, DOC, DOCX до "}
              {category === "all" && "Изображения, видео, документы до "}
              {maxSize}MB
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Uploaded files preview */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {files.map((url, index) => (
            <div
              key={index}
              className="relative group rounded-lg border overflow-hidden bg-muted aspect-square"
            >
              {isImage(url) ? (
                <>
                  <img
                    src={getFileUrl(url)}
                    alt={`Uploaded ${index + 1}`}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => {
                      setLightboxIndex(index)
                      setLightboxOpen(true)
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLightboxIndex(index)
                      setLightboxOpen(true)
                    }}
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-white" />
                  </Button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                  {getFileIcon(url)}
                  <span className="mt-2 text-xs text-center truncate max-w-full">
                    {url.split("/").pop()}
                  </span>
                </div>
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(url)
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              {/* Image number badge */}
              <span className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox for full-size image viewing */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Просмотр изображения</DialogTitle>
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Image counter */}
            <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
              {lightboxIndex + 1} / {files.filter(isImage).length}
            </div>
            
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Previous button */}
            {lightboxIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                onClick={() => setLightboxIndex((prev) => Math.max(0, prev - 1))}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}

            {/* Main image */}
            <img
              src={getFileUrl(files[lightboxIndex])}
              alt={`Image ${lightboxIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain"
            />

            {/* Next button */}
            {lightboxIndex < files.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                onClick={() => setLightboxIndex((prev) => Math.min(files.length - 1, prev + 1))}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}

            {/* Thumbnails */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded-lg max-w-[80vw] overflow-x-auto">
              {files.filter(isImage).map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightboxIndex(idx)}
                  className={cn(
                    "w-12 h-12 rounded overflow-hidden border-2 flex-shrink-0 transition-all",
                    lightboxIndex === idx ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img src={getFileUrl(url)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
