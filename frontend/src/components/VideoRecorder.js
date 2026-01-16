import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { 
  X, Camera, Video, SwitchCamera, Circle, Square, 
  Check, RotateCcw, Pause, Play, Timer, Sparkles,
  Sun, Moon, Zap, Heart, Star, Flame
} from 'lucide-react';

// Camera Filters
const FILTERS = [
  { id: 'normal', name: 'Normal', style: '', icon: Circle },
  { id: 'warm', name: 'Warm', style: 'sepia(30%) saturate(140%)', icon: Sun },
  { id: 'cool', name: 'Cool', style: 'hue-rotate(30deg) saturate(110%)', icon: Moon },
  { id: 'vintage', name: 'Vintage', style: 'sepia(50%) contrast(90%) brightness(90%)', icon: Star },
  { id: 'bw', name: 'B&W', style: 'grayscale(100%)', icon: Circle },
  { id: 'vivid', name: 'Vivid', style: 'saturate(180%) contrast(110%)', icon: Zap },
  { id: 'dramatic', name: 'Drama', style: 'contrast(130%) brightness(90%)', icon: Flame },
  { id: 'soft', name: 'Soft', style: 'brightness(105%) contrast(95%) saturate(90%)', icon: Heart },
  { id: 'neon', name: 'Neon', style: 'saturate(200%) brightness(110%) contrast(120%)', icon: Sparkles },
];

export default function VideoRecorder({ onVideoRecorded, onClose }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // 'user' = front, 'environment' = back
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasPermission, setHasPermission] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [showFilters, setShowFilters] = useState(true);
  const [beautyMode, setBeautyMode] = useState(false);
  const [flashMode, setFlashMode] = useState(false);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const MAX_DURATION = 60; // 60 seconds max

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9/16 }
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setHasPermission(true);
    } catch (error) {
      console.error('Camera error:', error);
      setHasPermission(false);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera access.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera found on this device.');
      } else {
        toast.error('Failed to access camera: ' + error.message);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const getFilterStyle = () => {
    const filter = FILTERS.find(f => f.id === selectedFilter);
    let style = filter?.style || '';
    
    // Add beauty mode (blur + brightness)
    if (beautyMode) {
      style += ' blur(0.5px) brightness(105%) contrast(95%)';
    }
    
    return style;
  };

  const startRecording = () => {
    if (!streamRef.current) {
      toast.error('Camera not ready');
      return;
    }

    chunksRef.current = [];
    
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    
    // Fallback for Safari
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      if (MediaRecorder.isTypeSupported('video/webm')) {
        options.mimeType = 'video/webm';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        options.mimeType = 'video/mp4';
      } else {
        options.mimeType = '';
      }
    }

    try {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      toast.success('Recording started!');
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setIsPaused(!isPaused);
    }
  };

  const retakeVideo = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    startCamera();
  };

  const useVideo = () => {
    if (recordedBlob) {
      // Convert blob to file
      const file = new File([recordedBlob], `recording_${Date.now()}.webm`, {
        type: 'video/webm'
      });
      onVideoRecorded(file, previewUrl);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Permission denied or no camera
  if (hasPermission === false) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <Camera className="w-16 h-16 text-zinc-600 mb-4" />
        <h2 className="font-unbounded font-bold text-xl mb-2">Camera Access Required</h2>
        <p className="text-zinc-500 text-center mb-6">
          Please allow camera access to record videos
        </p>
        <div className="flex gap-3">
          <Button
            onClick={startCamera}
            className="rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600"
          >
            Try Again
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="rounded-full border-zinc-700"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Preview recorded video
  if (previewUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full">
            <X className="w-6 h-6" />
          </button>
          <span className="font-semibold">Preview</span>
          <button onClick={useVideo} className="p-2 hover:bg-zinc-800 rounded-full text-green-500">
            <Check className="w-6 h-6" />
          </button>
        </div>

        {/* Video Preview */}
        <div className="flex-1 flex items-center justify-center p-4">
          <video
            src={previewUrl}
            className="max-h-[60vh] rounded-2xl"
            controls
            autoPlay
            loop
            playsInline
          />
        </div>

        {/* Actions */}
        <div className="p-6 space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={retakeVideo}
              variant="outline"
              className="flex-1 h-12 rounded-full border-zinc-700"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Retake
            </Button>
            <Button
              onClick={useVideo}
              className="flex-1 h-12 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600"
            >
              <Check className="w-5 h-5 mr-2" />
              Use Video
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Camera view
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
        <button 
          onClick={onClose} 
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* Recording timer */}
        {isRecording && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/50">
            <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
            <span className="font-mono font-semibold">{formatTime(recordingTime)}</span>
            <span className="text-zinc-500 text-sm">/ {formatTime(MAX_DURATION)}</span>
          </div>
        )}
        
        <div className="flex gap-2">
          {/* Beauty Mode */}
          <button 
            onClick={() => setBeautyMode(!beautyMode)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              beautyMode ? 'bg-pink-500' : 'bg-black/50'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </button>
          
          {/* Switch Camera */}
          <button 
            onClick={switchCamera}
            disabled={isRecording}
            className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center disabled:opacity-50"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera Preview with Filter */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`flex-1 object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        style={{ filter: getFilterStyle() }}
      />

      {/* Flash overlay for effect */}
      {flashMode && (
        <div className="absolute inset-0 bg-white/20 pointer-events-none animate-pulse" />
      )}

      {/* Filters Strip */}
      <div className="absolute bottom-36 left-0 right-0 px-2">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {FILTERS.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl min-w-[60px] transition-all ${
                  selectedFilter === filter.id 
                    ? 'bg-white/20 scale-105' 
                    : 'bg-black/30'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedFilter === filter.id 
                    ? 'bg-gradient-to-br from-fuchsia-500 to-violet-600' 
                    : 'bg-zinc-700'
                }`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] text-white">{filter.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recording Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 flex items-center justify-center gap-8">
        {isRecording ? (
          <>
            {/* Pause button */}
            <button
              onClick={pauseRecording}
              className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center"
            >
              {isPaused ? (
                <Play className="w-6 h-6 text-white" />
              ) : (
                <Pause className="w-6 h-6 text-white" />
              )}
            </button>

            {/* Stop button */}
            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center border-4 border-white"
              data-testid="stop-recording"
            >
              <Square className="w-8 h-8 text-white fill-white" />
            </button>

            <div className="w-14" /> {/* Spacer */}
          </>
        ) : (
          <>
            <div className="w-14" /> {/* Spacer */}

            {/* Record button */}
            <button
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center border-4 border-white active:scale-95 transition-transform"
              data-testid="start-recording"
            >
              <Circle className="w-8 h-8 text-white fill-white" />
            </button>

            <div className="w-14" /> {/* Spacer */}
          </>
        )}
      </div>

      {/* Instructions */}
      {!isRecording && (
        <div className="absolute bottom-32 left-0 right-0 text-center pointer-events-none">
          <p className="text-white/70 text-sm">Hold to record • Swipe for filters</p>
        </div>
      )}
    </div>
  );
}
