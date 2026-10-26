import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Mic, Volume2 } from 'lucide-react';

interface VoiceMessageBubbleProps {
  audioUrl: string;
  isOwn: boolean;
  time: string;
  senderName?: string;
}

export const VoiceMessageBubble: React.FC<VoiceMessageBubbleProps> = ({
  audioUrl,
  isOwn,
  time,
  senderName,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(Math.round(audio.duration));
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (isFinite(audio.duration) && audio.duration > 0 && duration === 0) {
        setDuration(Math.round(audio.duration));
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Pause any other playing audios on page
      document.querySelectorAll('audio').forEach((el) => el.pause());
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const formatSecs = (sec: number) => {
    if (!isFinite(sec) || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : isPlaying ? 50 : 0;

  // Waveform bars height profile
  const waveHeights = [28, 45, 70, 95, 60, 40, 85, 100, 75, 50, 80, 65, 90, 45, 30];

  return (
    <div
      className={`max-w-[85%] sm:max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs shadow-sm transition ${
        isOwn
          ? 'bg-[#E85D04] text-white rounded-br-none'
          : 'bg-white border border-black/10 text-[#262626] rounded-bl-none'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md transition active:scale-90 ${
            isOwn
              ? 'bg-white text-[#E85D04] hover:bg-white/90'
              : 'bg-[#E85D04] text-white hover:bg-[#C2410C]'
          }`}
          aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Waveform & Scrubber */}
        <div className="flex-1 min-w-[130px] space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold opacity-80 mb-0.5">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3" />
              {senderName || (isOwn ? 'Voice Note' : 'Voice Message')}
            </span>
            <span>{isPlaying ? formatSecs(currentTime) : (duration > 0 ? formatSecs(duration) : 'Voice')}</span>
          </div>

          {/* Visual Waveform Bars */}
          <div
            onClick={(e) => {
              if (!audioRef.current || duration <= 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const pct = Math.max(0, Math.min(1, clickX / rect.width));
              audioRef.current.currentTime = pct * duration;
              setCurrentTime(pct * duration);
            }}
            className="flex items-center gap-[2.5px] h-6 cursor-pointer py-1"
            title="Click to seek"
          >
            {waveHeights.map((h, i) => {
              const barPct = (i / waveHeights.length) * 100;
              const isPast = barPct <= progressPercent;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-150 ${
                    isPast
                      ? isOwn
                        ? 'bg-white'
                        : 'bg-[#E85D04]'
                      : isOwn
                      ? 'bg-white/35'
                      : 'bg-black/15'
                  } ${isPlaying && isPast ? 'animate-pulse' : ''}`}
                  style={{
                    height: `${Math.max(20, h)}%`,
                    minWidth: '2px',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className={`flex items-center justify-between mt-1 text-[9px] ${isOwn ? 'text-white/80' : 'text-[#A3A3A3]'}`}>
        <span className="flex items-center gap-1">
          <Volume2 className="w-2.5 h-2.5" />
          Audio
        </span>
        <span>{time}</span>
      </div>
    </div>
  );
};
