"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { X, Upload, FileText, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button"; // Added Button
import { cn } from "@/lib/utils";
import api from "@/lib/api-client";
import { toast } from "sonner";

interface FileUploaderProps {
    propertyId: string;
    images?: string[]; // Existing images
    documents?: string[]; // Existing documents
    onImagesChange?: (urls: string[]) => void;
    onDocumentsChange?: (urls: string[]) => void;
}

export function FileUploader({
    propertyId,
    images,
    documents,
    onImagesChange,
    onDocumentsChange
}: FileUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [localImages, setLocalImages] = useState<string[]>(images || []);
    const [localDocuments, setLocalDocuments] = useState<string[]>(documents || []);

    // Sync props only when they actually change (not on every render)
    useEffect(() => {
        if (images) {
            setLocalImages(images);
        }
    }, [JSON.stringify(images)]);

    useEffect(() => {
        if (documents) {
            setLocalDocuments(documents);
        }
    }, [JSON.stringify(documents)]);

    // Fetch data on mount
    useEffect(() => {
        const fetchData = async () => {
            if (!propertyId) return;
            try {
                const res = await api.get(`/crm-properties/${propertyId}`);
                if (res.data) {
                    setLocalImages(res.data.images || []);
                    setLocalDocuments(res.data.documents || []);
                }
            } catch (e) {
                console.error("Failed to fetch property files", e);
            }
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [propertyId]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        setUploading(true);
        const newImages: string[] = [];
        const newDocs: string[] = [];

        try {
            for (const file of acceptedFiles) {
                const isImage = file.type.startsWith("image/");
                const endpoint = isImage
                    ? `/uploads/property/${propertyId}/images`
                    : `/uploads/property/${propertyId}/documents`;

                const formData = new FormData();
                formData.append("file", file);

                const res = await api.post(endpoint, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });

                if (res.data.url) {
                    if (isImage) {
                        newImages.push(res.data.url);
                    } else {
                        newDocs.push(res.data.url);
                    }
                }
            }

            if (newImages.length > 0) {
                const updated = [...localImages, ...newImages];
                setLocalImages(updated);
                onImagesChange?.(updated);
                toast.success(`Загружено ${newImages.length} фото`);
            }

            if (newDocs.length > 0) {
                const updated = [...localDocuments, ...newDocs];
                setLocalDocuments(updated);
                onDocumentsChange?.(updated);
                toast.success(`Загружено ${newDocs.length} документов`);
            }

        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Ошибка загрузки");
        } finally {
            setUploading(false);
        }
    }, [propertyId, localImages, localDocuments, onImagesChange, onDocumentsChange]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': [],
            'image/png': [],
            'image/webp': [],
            'application/pdf': [],
            'application/msword': [],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [], // docx
            'application/vnd.ms-excel': [],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [] // xlsx
        },
        maxSize: 10 * 1024 * 1024, // 10MB
    });

    const handleDelete = async (url: string, type: "image" | "document") => {
        try {
            const endpoint = type === "image"
                ? `/uploads/property/${propertyId}/images`
                : `/uploads/property/${propertyId}/documents`;

            // Optimistic
            if (type === "image") {
                const filtered = localImages.filter(u => u !== url);
                setLocalImages(filtered);
                onImagesChange?.(filtered);
            } else {
                const filtered = localDocuments.filter(u => u !== url);
                setLocalDocuments(filtered);
                onDocumentsChange?.(filtered);
            }

            await api.delete(endpoint, { data: { url } });
            toast.success("Файл удален");
        } catch (error) {
            toast.error("Ошибка удаления");
            // Revert needed? For now optimistic.
        }
    };

    return (
        <div className="space-y-4">
            <div
                {...getRootProps()}
                className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50",
                    uploading && "opacity-50 pointer-events-none"
                )}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {uploading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    ) : (
                        <Upload className="h-8 w-8 text-gray-400" />
                    )}
                    <span className="text-sm">
                        {isDragActive ? "Отпустите файлы" : "Фото, PDF, DOCX, XLSX (до 10MB)"}
                    </span>
                </div>
            </div>

            {/* Images Grid */}
            {localImages.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Фотографии ({localImages.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                        {localImages.map((url, idx) => (
                            <div key={idx} className="group relative aspect-square rounded-md overflow-hidden bg-gray-100 border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="prop" className="object-cover w-full h-full" />
                                <button
                                    onClick={() => handleDelete(url, "image")}
                                    className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Documents List */}
            {localDocuments.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Документы ({localDocuments.length})</p>
                    <div className="flex flex-col gap-2">
                        {localDocuments.map((url, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-md border bg-gray-50 text-sm">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
                                    <span className="truncate max-w-[200px]" title={url}>
                                        {/* Try to get filename from URL or just show generic */}
                                        {url.split('/').pop()?.split('-').slice(1).join('-') || "Документ"}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-red-500"
                                    onClick={() => handleDelete(url, "document")}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
