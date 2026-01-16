import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ArrowLeft, Upload, Video, Link as LinkIcon, X, Film } from 'lucide-react';

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
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        toast.error('Video must be less than 100MB');
        return;
      }
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a video file');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setVideoUrl('');
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
        }
      });
      
      return response.data.video_url;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload video');
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
        {/* Video Preview */}
        {previewUrl ? (
          <div className="relative aspect-[9/16] max-h-[400px] mx-auto rounded-2xl overflow-hidden bg-zinc-900">
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
          </div>
        ) : (
          <div className="aspect-[9/16] max-h-[300px] mx-auto rounded-2xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center gap-4 bg-zinc-900/50">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
              <Video className="w-8 h-8 text-zinc-500" />
            </div>
            <p className="text-zinc-500 text-sm text-center px-4">
              Select a sample video or paste a video URL below
            </p>
          </div>
        )}

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
          disabled={loading || !videoUrl || !caption.trim()}
          className="w-full h-12 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 font-semibold text-base active-scale disabled:opacity-50"
          data-testid="upload-submit"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Uploading...
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
