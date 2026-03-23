import { useState } from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  thumbnail?: string;
  title: string;
  duration?: string;
}

export default function VideoPlayer({
  videoUrl,
  thumbnail,
  title,
  duration
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Extract video ID from YouTube URL
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  const videoId = getYouTubeId(videoUrl);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl;

  return (
    <div className="rounded-lg overflow-hidden bg-[#0a0a0a] border border-[#1f1f1f]">
      {/* Video Container */}
      <div className="relative aspect-video bg-[#000]">
        {!isPlaying && thumbnail ? (
          <div className="relative w-full h-full group cursor-pointer" onClick={() => setIsPlaying(true)}>
            <img
              src={thumbnail}
              alt={title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-[#3b82f6] group-hover:bg-[#2563eb] flex items-center justify-center transition-all group-hover:scale-110">
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            {duration && (
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-[11px] text-white">
                {duration}
              </div>
            )}
          </div>
        ) : (
          <iframe
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        )}
      </div>

      {/* Video Info */}
      <div className="p-3 border-t border-[#1f1f1f]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="text-[13px] font-medium text-[#ededed] mb-1">{title}</h3>
            {duration && (
              <div className="flex items-center gap-1 text-[11px] text-[#666]">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {duration}
              </div>
            )}
          </div>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 bg-[#111] hover:bg-[#1a1a1a] rounded text-[11px] text-[#999] hover:text-[#ededed] transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Watch on YouTube
          </a>
        </div>
      </div>
    </div>
  );
}
