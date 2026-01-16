import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Scissors, Play, Pause, Check, X, RotateCcw } from 'lucide-react';

export default function VideoEditor({ videoFile, onSave, onCancel }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [processing, setProcessing] = useState(false);
  const videoRef = useRef(null);
  const previewUrl = useRef(null);

  useEffect(() => {
    if (videoFile) {
      previewUrl.current = URL.createObjectURL(videoFile);
    }
    return () => {
      if (previewUrl.current) {
        URL.revokeObjectURL(previewUrl.current);
      }
    };
  }, [videoFile]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setTrimEnd(100);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Stop at trim end
      const endTime = (trimEnd / 100) * duration;
      if (videoRef.current.currentTime >= endTime) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // Start from trim start if at beginning
        const startTime = (trimStart / 100) * duration;
        if (videoRef.current.currentTime < startTime) {
          videoRef.current.currentTime = startTime;
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTrimChange = (values) => {
    setTrimStart(values[0]);
    setTrimEnd(values[1]);
    
    // Seek to trim start when adjusting
    if (videoRef.current) {
      videoRef.current.currentTime = (values[0] / 100) * duration;
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTrimmmedDuration = () => {
    const startSec = (trimStart / 100) * duration;
    const endSec = (trimEnd / 100) * duration;
    return endSec - startSec;
  };

  const getEstimatedSize = () => {
    if (!videoFile || !duration) return 0;
    const ratio = getTrimmmedDuration() / duration;
    return videoFile.size * ratio;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSave = async () => {
    setProcessing(true);
    
    // Pass trim info to parent
    const trimInfo = {
      startTime: (trimStart / 100) * duration,
      endTime: (trimEnd / 100) * duration,
      duration: getTrimmmedDuration(),
      estimatedSize: getEstimatedSize()
    };
    
    // For now, we pass the original file with trim metadata
    // Server-side trimming would be needed for actual file size reduction
    onSave(videoFile, trimInfo);
    setProcessing(false);
  };

  const resetTrim = () => {
    setTrimStart(0);
    setTrimEnd(100);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <button onClick={onCancel} className="p-2 hover:bg-zinc-800 rounded-full">
          <X className="w-6 h-6" />
        </button>
        <h2 className="font-unbounded font-bold">Trim Video</h2>
        <button 
          onClick={handleSave}
          disabled={processing}
          className="p-2 hover:bg-zinc-800 rounded-full text-green-500"
        >
          {processing ? (
            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Video Preview */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative max-h-[50vh] aspect-[9/16] rounded-xl overflow-hidden bg-zinc-900">
          <video
            ref={videoRef}
            src={previewUrl.current}
            className="w-full h-full object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            playsInline
          />
          
          {/* Play/Pause overlay */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 active:bg-black/40 transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-8 h-8 text-white" />
              ) : (
                <Play className="w-8 h-8 text-white ml-1" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-4 border-t border-zinc-800">
        {/* Time display */}
        <div className="flex justify-between text-sm text-zinc-400">
          <span>Start: {formatTime((trimStart / 100) * duration)}</span>
          <span>Duration: {formatTime(getTrimmmedDuration())}</span>
          <span>End: {formatTime((trimEnd / 100) * duration)}</span>
        </div>

        {/* Trim Slider */}
        <div className="py-2">
          <Slider
            value={[trimStart, trimEnd]}
            onValueChange={handleTrimChange}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Size info */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-fuchsia-500" />
            <span className="text-sm">Estimated size:</span>
          </div>
          <span className={`font-semibold ${getEstimatedSize() < 50 * 1024 * 1024 ? 'text-green-500' : 'text-yellow-500'}`}>
            {formatFileSize(getEstimatedSize())}
          </span>
        </div>

        {/* Reset button */}
        <div className="flex gap-3">
          <Button
            onClick={resetTrim}
            variant="outline"
            className="flex-1 h-11 rounded-xl border-zinc-700"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={processing}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600"
          >
            <Check className="w-4 h-4 mr-2" />
            Use This Clip
          </Button>
        </div>

        {/* Help text */}
        <p className="text-xs text-zinc-600 text-center">
          Drag the sliders to select the part you want to keep
        </p>
      </div>
    </div>
  );
}
