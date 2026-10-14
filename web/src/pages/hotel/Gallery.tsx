import { useState } from 'react';

interface GalleryProps {
  images: Array<{ url: string; caption: string | null }>;
  name: string;
}

/** Hero photo with a strip of four thumbnails beneath it (frame 1h). Photos come from the hotel provider. */
export function Gallery({ images, name }: GalleryProps) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return (
      <div className="flex h-gallery-hero items-center justify-center rounded-md bg-surface-muted font-sans text-sm text-text-secondary" role="img" aria-label={`No photos available for ${name}`}>
        Photos not available
      </div>
    );
  }
  const hero = images[Math.min(active, images.length - 1)]!;
  const thumbs = images.slice(0, 4);
  return (
    <div className="flex flex-col gap-2">
      <img src={hero.url} alt={hero.caption ?? name} className="h-gallery-hero w-full rounded-md bg-surface-muted object-cover" />
      {thumbs.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {thumbs.map((img, i) => (
            <button key={img.url} type="button" onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={i === active} className="cursor-pointer overflow-hidden rounded-sm border-0 bg-transparent p-0">
              <img src={img.url} alt="" loading="lazy" className="h-gallery-thumb w-full bg-surface-muted object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
