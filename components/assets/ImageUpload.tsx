
import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CameraIcon, FileUploadIcon, CloseIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';

interface ImageUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
  isUploading: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  isOpen,
  onClose,
  onUpload,
  isUploading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Effect to handle setting up and tearing down the video stream
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = cameraStream;

      const handleCanPlay = () => {
        video.play().catch(err => {
          console.error("Camera play error:", err.message);
          setCameraError("امکان نمایش تصویر دوربین وجود ندارد.");
          setIsCameraReady(false);
        });
      };

      const handlePlaying = () => {
        setIsCameraReady(true);
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('playing', handlePlaying);

      // Cleanup function for when the stream changes or component unmounts
      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('playing', handlePlaying);
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        }
        video.srcObject = null;
      };
    }
  }, [cameraStream]);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(event.target.files || [])]);
    }
  };

  const openFileBrowser = () => {
    fileInputRef.current?.click();
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraReady(false);
    if (cameraStream) {
        // Safeguard, should be handled by button logic
        stopCamera();
        return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
    } catch (err: any) {
      console.error('Error accessing camera:', err.message);
      setCameraError('دسترسی به دوربین ممکن نیست. لطفاً اجازه دسترسی را بدهید.');
    }
  };

  const stopCamera = () => {
    // Setting stream to null will trigger the useEffect cleanup
    if (cameraStream) {
        setCameraStream(null);
    }
    setIsCameraReady(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current && isCameraReady) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setCameraError("ابعاد ویدئو در دسترس نیست. لطفاً دوباره امتحان کنید.");
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setSelectedFiles(prev => [...prev, file]); // Append photo
          stopCamera(); // Stop camera after taking a successful photo
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const handleUploadClick = async () => {
    if (selectedFiles.length > 0) {
      await onUpload(selectedFiles);
      setSelectedFiles([]);
      // The parent component is responsible for closing the modal
    }
  };

  const removeSelectedFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleModalClose = () => {
    stopCamera();
    setSelectedFiles([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title="آپلود تصویر">
      <div className="space-y-6">
        {/* Upload from file */}
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">انتخاب فایل (قابلیت انتخاب چندگانه)</h4>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept="image/jpeg, image/png, image/jpg"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={openFileBrowser}
            fullWidth
            disabled={isUploading || !!cameraStream}
          >
            <FileUploadIcon className="ml-2" /> انتخاب تصاویر از گالری/فایل
          </Button>
          
          {selectedFiles.length > 0 && !cameraStream && (
            <div className="mt-3 border rounded p-2 bg-gray-50 max-h-40 overflow-y-auto">
              <p className="text-xs text-gray-500 mb-2 text-right">{selectedFiles.length} فایل انتخاب شده:</p>
              <ul className="space-y-1">
                  {selectedFiles.map((file, index) => (
                      <li key={index} className="flex justify-between items-center text-sm bg-white p-1 px-2 rounded shadow-sm">
                          <span className="truncate max-w-[200px]">{file.name}</span>
                          <button onClick={() => removeSelectedFile(index)} className="text-red-500 hover:text-red-700 px-2">
                              <i className="fas fa-times"></i>
                          </button>
                      </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        <div className="relative flex justify-center items-center my-4">
          <div className="absolute w-full border-t border-gray-300"></div>
          <span className="relative z-10 bg-white px-3 text-sm text-gray-500">یا</span>
        </div>

        {/* Capture from camera */}
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">گرفتن تصویر با دوربین</h4>
          {!cameraStream ? (
            <Button
              type="button"
              variant="secondary"
              onClick={startCamera}
              fullWidth
              disabled={isUploading}
            >
              <CameraIcon className="ml-2" /> باز کردن دوربین
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              onClick={stopCamera}
              fullWidth
              disabled={isUploading}
            >
              <CloseIcon className="ml-2" /> بستن دوربین
            </Button>
          )}

          {cameraError && (
            <div className="mt-2 text-sm text-red-600 bg-red-100 p-2 rounded-md">
              {cameraError}
            </div>
          )}

          {cameraStream && (
            <div className="mt-4 relative">
              {/* Added bg-black for better loading appearance */}
              <video ref={videoRef} className="w-full h-auto rounded-lg shadow-md bg-black" autoPlay playsInline muted></video>
              <canvas ref={canvasRef} className="hidden"></canvas>
              <Button
                type="button"
                onClick={takePhoto}
                fullWidth
                className="mt-2"
                disabled={isUploading || !isCameraReady}
              >
                {!isCameraReady ? <Spinner className="ml-2 h-4 w-4" /> : <CameraIcon className="ml-2" />}
                {isCameraReady ? 'گرفتن عکس' : 'آماده سازی دوربین...'}
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-start space-x-4 space-x-reverse mt-6 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="primary"
            onClick={handleUploadClick}
            disabled={selectedFiles.length === 0 || isUploading}
            loading={isUploading}
          >
            {isUploading ? 'در حال آپلود...' : `آپلود (${selectedFiles.length} فایل)`}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleModalClose}
            disabled={isUploading}
          >
            لغو
          </Button>
        </div>
      </div>
    </Modal>
  );
};
