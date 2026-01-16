import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Download, Share2, Copy, Play } from 'lucide-react';

export default function QRCodePage() {
  const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();
  
  // App URL - replace with deployed URL
  const appUrl = window.location.origin;
  
  const handleDownloadQR = async () => {
    setDownloading(true);
    try {
      const svg = document.getElementById('app-qr-code');
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = 512;
        canvas.height = 512;
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw QR code
        ctx.drawImage(img, 56, 56, 400, 400);
        
        // Add text
        ctx.fillStyle = 'black';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Fun Video App', canvas.width / 2, canvas.height - 20);
        
        // Download
        const link = document.createElement('a');
        link.download = 'funvideo-qr-code.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        toast.success('QR Code downloaded!');
        setDownloading(false);
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download');
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      toast.success('Link copied!');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Fun Video App',
          text: 'Check out Fun Video App - Watch, Create & Share Fun Videos!',
          url: appUrl
        });
      } else {
        await navigator.clipboard.writeText(appUrl);
        toast.success('Link copied!');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black pb-20" data-testid="qr-code-page">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-unbounded font-bold text-lg">Share App</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        {/* App Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center glow-primary">
              <Play className="w-8 h-8 text-white fill-white" />
            </div>
          </div>
          <h2 className="font-unbounded font-black text-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 bg-clip-text text-transparent">
            Fun Video
          </h2>
          <p className="text-zinc-500 text-sm mt-1">Watch, Create & Share Fun Videos</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="p-6 bg-white rounded-3xl shadow-lg">
            <QRCodeSVG
              id="app-qr-code"
              value={appUrl}
              size={200}
              level="H"
              includeMargin={false}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center">
          <p className="text-zinc-400 text-sm">
            Scan this QR code to open the app
          </p>
          <p className="text-zinc-600 text-xs mt-2 break-all">
            {appUrl}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleDownloadQR}
            disabled={downloading}
            className="w-full h-12 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 font-semibold"
            data-testid="download-qr"
          >
            {downloading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Download QR Code
              </>
            )}
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="h-12 rounded-full border-zinc-700 hover:bg-zinc-800"
              data-testid="copy-link"
            >
              <Copy className="w-5 h-5 mr-2" />
              Copy Link
            </Button>

            <Button
              onClick={handleShare}
              variant="outline"
              className="h-12 rounded-full border-zinc-700 hover:bg-zinc-800"
              data-testid="share-app"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Tips */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <h3 className="font-semibold text-sm mb-2">Share Tips:</h3>
          <ul className="text-zinc-500 text-xs space-y-1">
            <li>• Download QR code and add to your Instagram/Snapchat story</li>
            <li>• Share the link directly on WhatsApp or other apps</li>
            <li>• Print QR code for offline sharing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
