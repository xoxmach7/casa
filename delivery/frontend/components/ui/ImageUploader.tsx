
"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { X, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import api from "@/lib/api-client";
import { toast } from "sonner";

interface ImageUploaderProps {
    propertyId: string;
    images?: string[];
    onImagesChange?: (urls: string[]) => void;
}

export function ImageUploader({ propertyId, images = [], onImagesChange }: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [localImages, setLocalImages] = useState<string[]>(images);

    // Fetch existing images when component mounts
    useEffect(() => {
        const fetchImages = async () => {
            try {
                const res = await api.get(`/crm-properties/${propertyId}`);
                const existingImages = res.data.images || [];
                setLocalImages(existingImages);
                onImagesChange?.(existingImages);
            } catch (error) {
                console.error("Failed to fetch property images:", error);
            } finally {
                setLoading(false);
            }
        };

        if (propertyId) {
            fetchImages();
        }
    }, [propertyId]);


    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        setUploading(true);
        const newUrls: string[] = [];

        try {
            // Upload sequentially or parallel
            for (const file of acceptedFiles) {
                const formData = new FormData();
                formData.append("file", file);

                const res = await api.post(`/uploads/property/${propertyId}/images`, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                if (res.data.url) {
                    newUrls.push(res.data.url);
                }
            }

            const updatedList = [...localImages, ...newUrls];
            setLocalImages(updatedList);
            onImagesChange?.(updatedList);
            toast.success(`Загружено ${newUrls.length} фото`);
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Ошибка загрузки");
        } finally {
            setUploading(false);
        }
    }, [propertyId, localImages, onImagesChange]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': [],
            'image/png': [],
            'image/webp': []
        },
        maxSize: 10 * 1024 * 1024, // 10MB
    });

    const handleDelete = async (urlToDelete: string) => {
        try {
            // Optimistic update
            const filtered = localImages.filter(url => url !== urlToDelete);
            setLocalImages(filtered);
            onImagesChange?.(filtered);

            await api.delete(`/uploads/property/${propertyId}/images`, {
                data: { url: urlToDelete }
            });
            toast.success("Фото удалено");
        } catch (error) {
            toast.error("Ошибка удаления");
            // Revert if needed, but optimistic is fine for now
        }
    };

    return (
        <div className="space-y-4">
            {/* DROPZONE */}
            <div
                {...getRootProps()}
                className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50",
                    (uploading || loading) && "opacity-50 pointer-events-none"
                )}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {(uploading || loading) ? (
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                    ) : (
                        <Upload className="h-10 w-10 text-gray-400" />
                    )}
                    {loading ? (
                        <p>Загрузка фото...</p>
                    ) : uploading ? (
                        <p>Загрузка...</p>
                    ) : isDragActive ? (
                        <p className="text-indigo-600 font-medium">Отпустите файлы сюда</p>
                    ) : (
                        <div>
                            <p className="font-medium text-gray-700">Перетащите фото сюда</p>
                            <p className="text-xs text-gray-500 mt-1">или кликните для выбора (до 10MB)</p>
                        </div>
                    )}
                </div>
            </div>

            {/* GALLERY GRID */}
            {localImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {localImages.map((url, idx) => (
                        <div key={idx} className="group relative aspect-[4/3] rounded-md overflow-hidden bg-gray-100 border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={url}
                                alt={`Photo ${idx}`}
                                className="object-cover w-full h-full transition-transform group-hover:scale-105"
                            />

                            <button
                                onClick={() => handleDelete(url)}
                                className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                title="Удалить"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
