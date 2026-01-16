import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ArrowLeft, Upload, Video, Link as LinkIcon, X, Film, Scissors } from 'lucide-react';
import VideoEditor from '../components/VideoEditor';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Sample video URLs for demo
const SAMPLE_VIDEOS = [
  {
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1576425992375-833883be0039?w=400',
    label: 'Fire Effect'
  },
  {
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1730483385242-f8e95e412ec3?w=400',
    label: 'Adventure'
  },
  {
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1634007530041-914b5c56c69e?w=400',
    label: 'Fun Times'
  },
  {
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1744477825395-e43544c2e2cc?w=400',
    label: 'Joyride'
  }
];

export default function UploadPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileSize, setFileSize] = useState(0);
  const [compressing, setCompressing] = useState(false);
  const [compressionQuality, setCompressionQuality] = useState(0.7);
  const [showEditor, setShowEditor] = useState(false);
  const [trimInfo, setTrimInfo] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a video file');
        return;
      }
      setSelectedFile(file);
      setFileSize(file.size);
      setPreviewUrl(URL.createObjectURL(file));
      setVideoUrl('');
      
      // Show warning if file is large
      if (file.size > 50 * 1024 * 1024) {
        toast.warning('Video is large! Consider compressing for faster upload');
      }
    }
  };

  const compressVideo = async () => {
    if (!selectedFile || !videoRef.current) return;
    
    setCompressing(true);
    toast.info('Compressing video... Please wait');

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Wait for video to load metadata
      await new Promise((resolve) => {
        if (video.readyState >= 2) resolve();
        else video.onloadeddata = resolve;
      });

      // Reduce dimensions for compression
      const scale = compressionQuality;
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      // For now, we'll just reduce the quality message
      // True video compression requires server-side processing or WebCodecs API
      
      toast.success(`Video ready! Original: ${formatFileSize(selectedFile.size)}`);
      toast.info('Tip: For better compression, use a shorter video clip');
      
    } catch (error) {
      console.error('Compression error:', error);
      toast.error('Compression failed. Try uploading as-is');
    } finally {
      setCompressing(false);
    }
  };

  const uploadVideoFile = async () => {
    if (!selectedFile) return null;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      
      const response = await axios.post(`${API}/upload/video`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          // Could add progress bar here
        }
      });
      
      return response.data.video_url;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload video. Try a smaller file.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSelectSample = (sample) => {
    setVideoUrl(sample.url);
    setThumbnailUrl(sample.thumbnail);
    setPreviewUrl(sample.url);
  };

  const handleUrlChange = (url) => {
    setVideoUrl(url);
    setPreviewUrl(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let finalVideoUrl = videoUrl;
    
    // If file mode and file selected, upload first
    if (uploadMode === 'file' && selectedFile) {
      finalVideoUrl = await uploadVideoFile();
      if (!finalVideoUrl) return;
    }
    
    if (!finalVideoUrl) {
      toast.error('Please provide a video');
      return;
    }
    
    if (!caption.trim()) {
      toast.error('Please add a caption');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API}/videos`,
        {
          video_url: finalVideoUrl,
          thumbnail_url: thumbnailUrl || null,
          caption: caption.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Video uploaded successfully!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload video');
    } finally {
      setLoading(false);
    }
  };

  const clearPreview = () => {
    setVideoUrl('');
    setThumbnailUrl('');
    setPreviewUrl('');
    setSelectedFile(null);
    setFileSize(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-black pb-20" data-testid="upload-page">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-unbounded font-bold text-lg">Upload Video</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Upload Mode Toggle */}
        <div className="flex gap-2 p-1 bg-zinc-900 rounded-full">
          <button
            onClick={() => { setUploadMode('file'); clearPreview(); }}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
              uploadMode === 'file' 
                ? 'bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white' 
                : 'text-zinc-400 hover:text-white'
            }`}
            data-testid="mode-file"
          >
            <Film className="w-4 h-4 inline mr-2" />
            Upload Video
          </button>
          <button
            onClick={() => { setUploadMode('url'); clearPreview(); }}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
              uploadMode === 'url' 
                ? 'bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white' 
                : 'text-zinc-400 hover:text-white'
            }`}
            data-testid="mode-url"
          >
            <LinkIcon className="w-4 h-4 inline mr-2" />
            Video URL
          </button>
        </div>

        {/* Video Preview */}
        {previewUrl ? (
          <div className="relative aspect-[9/16] max-h-[350px] mx-auto rounded-2xl overflow-hidden bg-zinc-900">
            <video
              ref={videoRef}
              src={previewUrl}
              className="w-full h-full object-cover"
              controls
              playsInline
              data-testid="video-preview"
            />
            <button
              onClick={clearPreview}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors"
              data-testid="clear-preview"
            >
              <X className="w-4 h-4" />
            </button>
            
            {/* File Size Badge */}
            {selectedFile && (
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 text-xs font-medium">
                {formatFileSize(fileSize)}
              </div>
            )}
          </div>
        ) : (
          <div 
            onClick={() => uploadMode === 'file' && fileInputRef.current?.click()}
            className={`aspect-[9/16] max-h-[300px] mx-auto rounded-2xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center gap-4 bg-zinc-900/50 ${uploadMode === 'file' ? 'cursor-pointer hover:border-fuchsia-500 transition-colors' : ''}`}
          >
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
              <Video className="w-8 h-8 text-zinc-500" />
            </div>
            <p className="text-zinc-500 text-sm text-center px-4">
              {uploadMode === 'file' 
                ? 'Tap to select video from your device' 
                : 'Paste a video URL below'}
            </p>
            {uploadMode === 'file' && (
              <Button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600"
                data-testid="select-video-btn"
              >
                Select Video
              </Button>
            )}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="video-file-input"
        />

        {/* File Size Warning & Tips - Show when file is large */}
        {selectedFile && fileSize > 20 * 1024 * 1024 && (
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Film className="w-4 h-4 text-yellow-500" />
              </div>
              <div className="flex-1">
                <p className="text-yellow-500 font-medium text-sm">Large Video ({formatFileSize(fileSize)})</p>
                <p className="text-zinc-400 text-xs mt-1">
                  Upload time depends on your internet. Tips:
                </p>
                <ul className="text-zinc-500 text-xs mt-2 space-y-1">
                  <li>• Trim video to reduce size</li>
                  <li>• Use WiFi for faster upload</li>
                  <li>• Max recommended: 50MB</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Success message for good size */}
        {selectedFile && fileSize <= 20 * 1024 * 1024 && (
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <Film className="w-3 h-3 text-green-500" />
            </div>
            <p className="text-green-500 text-sm">Good size! ({formatFileSize(fileSize)}) Ready to upload</p>
          </div>
        )}

        {/* URL Mode - Video URL Input */}
        {uploadMode === 'url' && (
          <>
            {/* Sample Videos */}
            <div className="space-y-3">
              <Label className="text-zinc-400 text-sm">Quick Select (Sample Videos)</Label>
              <div className="grid grid-cols-4 gap-2">
                {SAMPLE_VIDEOS.map((sample, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectSample(sample)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all active-scale ${
                      videoUrl === sample.url 
                        ? 'border-primary glow-primary' 
                        : 'border-transparent hover:border-zinc-700'
                    }`}
                    data-testid={`sample-video-${index}`}
                  >
                    <img
                      src={sample.thumbnail}
                      alt={sample.label}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-end p-1">
                      <span className="text-[10px] font-medium truncate">{sample.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Video URL Input */}
            <div className="space-y-2">
              <Label htmlFor="videoUrl" className="text-zinc-400">
                <LinkIcon className="w-4 h-4 inline mr-2" />
                Video URL
              </Label>
              <Input
                id="videoUrl"
                type="url"
                placeholder="https://example.com/video.mp4"
                value={videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="bg-zinc-900/50 border-zinc-800 focus:border-primary h-12 rounded-xl"
                data-testid="video-url-input"
              />
            </div>
          </>
        )}

        {/* Caption */}
        <div className="space-y-2">
          <Label htmlFor="caption" className="text-zinc-400">Caption</Label>
          <Textarea
            id="caption"
            placeholder="Write a caption for your video..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={500}
            className="bg-zinc-900/50 border-zinc-800 focus:border-primary rounded-xl resize-none"
            data-testid="caption-input"
          />
          <p className="text-xs text-zinc-600 text-right">{caption.length}/500</p>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={loading || uploading || (uploadMode === 'file' ? !selectedFile : !videoUrl) || !caption.trim()}
          className="w-full h-12 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 font-semibold text-base active-scale disabled:opacity-50"
          data-testid="upload-submit"
        >
          {loading || uploading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {uploading ? 'Uploading Video...' : 'Posting...'}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Post Video
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
