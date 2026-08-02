import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoGalleryProps {
  images: string[];
  startIndex?: number;
  onClose: () => void;
}

const PhotoGallery = ({ images, startIndex = 0, onClose }: PhotoGalleryProps) => {
  const [current, setCurrent] = useState(startIndex);

  const prev = () => setCurrent(i => (i > 0 ? i - 1 : images.length - 1));
  const next = () => setCurrent(i => (i < images.length - 1 ? i + 1 : 0));

  return (
    <div className="fixed inset-0 z-50 bg-foreground/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[52px] shrink-0">
        <span className="text-primary-foreground/70 text-sm tabular-nums">
          {current + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-primary-foreground/10 flex items-center justify-center"
        >
          <X className="w-4.5 h-4.5 text-primary-foreground" />
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-2 relative">
        <img
          src={images[current]}
          alt=""
          className="max-w-full max-h-full object-contain rounded-lg"
        />

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-primary-foreground" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5 text-primary-foreground" />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-6 pt-3">
          {images.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === current ? 'bg-primary-foreground' : 'bg-primary-foreground/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
