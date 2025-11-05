import React, { useRef, useState, useCallback, useEffect } from "react";
import "./PhotoCapture.css";

const PhotoCapture = ({
  student,
  capturedPhotos = [],
  onPhotosUpdate,
  onFinish,
  onClose,
  onNextStudent,
  hasNextStudent,
}) => {
  // Refs
  const fileInputRef = useRef(null);
  const keepAndAddRef = useRef(null);
  const finishBtnRef = useRef(null);
  const captureBtnRef = useRef(null);
  const nextStudentBtnRef = useRef(null);

  // States
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stream, setStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [uploading, setUploading] = useState(false);

  // ✅ REMOVED: setCapturedPhotos state - using onPhotosUpdate prop instead

  // Safe student data access
  const studentData = student || {
    rollNumber: "Unknown",
    name: "Unknown Student",
  };

  // Camera setup function
  const setupCamera = useCallback(async () => {
    try {
      console.log("Starting camera setup...");
      setCameraError(null);

      // Stop existing stream if any
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      console.log("Requesting camera with constraints:", constraints);

      const mediaStream = await navigator.mediaDevices.getUserMedia(
        constraints
      );
      console.log("Camera access granted");

      setStream(mediaStream);
      setCameraReady(true);
      return true;
    } catch (error) {
      console.error("Camera setup failed:", error);

      // Try front camera as fallback
      try {
        console.log("Trying front camera...");
        const fallbackConstraints = {
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const fallbackStream = await navigator.mediaDevices.getUserMedia(
          fallbackConstraints
        );
        setStream(fallbackStream);
        setCameraReady(true);
        return true;
      } catch (fallbackError) {
        console.error("All camera attempts failed:", fallbackError);
        setCameraError(
          "Camera access failed. Please check permissions and ensure camera is available."
        );
        setCameraReady(false);
        return false;
      }
    }
  }, [stream]);

  // Photo capture functions
  const handleTakePhoto = useCallback(async () => {
    if (isProcessing || !cameraReady || !stream) {
      console.log(
        "Cannot capture - Processing:",
        isProcessing,
        "Camera Ready:",
        cameraReady,
        "Stream:",
        !!stream
      );
      return;
    }

    try {
      setIsProcessing(true);
      console.log("Starting photo capture...");

      if ("ImageCapture" in window) {
        const track = stream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(track);

        try {
          const blob = await imageCapture.takePhoto();
          console.log("Photo captured via ImageCapture API");

          const reader = new FileReader();
          reader.onload = (e) => {
            setCurrentPhoto(e.target.result);
            setIsProcessing(false);
          };
          reader.readAsDataURL(blob);
        } catch (imageCaptureError) {
          console.error(
            "ImageCapture failed, using fallback:",
            imageCaptureError
          );
          await captureWithCanvasFallback();
        }
      } else {
        await captureWithCanvasFallback();
      }
    } catch (error) {
      console.error("Error capturing photo:", error);
      alert("Failed to capture photo. Please try again or use file upload.");
      setIsProcessing(false);
    }
  }, [isProcessing, cameraReady, stream]);

  const captureWithCanvasFallback = useCallback(async () => {
    if (!stream) return;

    try {
      const tempVideo = document.createElement("video");
      tempVideo.srcObject = stream;
      tempVideo.muted = true;

      await new Promise((resolve, reject) => {
        tempVideo.onloadedmetadata = () => {
          tempVideo.play().then(resolve).catch(reject);
        };
        setTimeout(() => reject(new Error("Video load timeout")), 5000);
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = document.createElement("canvas");
      canvas.width = tempVideo.videoWidth || 1280;
      canvas.height = tempVideo.videoHeight || 720;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);

      const imageDataURL = canvas.toDataURL("image/jpeg", 0.9);
      console.log("Photo captured via canvas fallback");

      setCurrentPhoto(imageDataURL);
      tempVideo.srcObject = null;
    } catch (error) {
      console.error("Canvas fallback failed:", error);
      throw error;
    }
  }, [stream]);

  // File selection handler
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPEG, PNG, etc.)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Image size should be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCurrentPhoto(e.target.result);
    };
    reader.onerror = () => {
      alert("Error reading file. Please try another image.");
    };
    reader.readAsDataURL(file);

    event.target.value = "";
  }, []);

  // Add current photo to captured list
  const addCurrentPhotoToCaptured = useCallback(() => {
    if (!currentPhoto) return false;

    try {
      const newPhoto = {
        id: Date.now() + Math.random(),
        data: currentPhoto,
        pageNumber: (capturedPhotos?.length || 0) + 1,
        timestamp: new Date().toISOString(),
        studentRoll: studentData.rollNumber,
      };

      if (onPhotosUpdate) {
        onPhotosUpdate((prev) => [...(prev || []), newPhoto]);
      }

      setCurrentPhoto(null);
      return true;
    } catch (error) {
      console.error("Error adding photo:", error);
      return false;
    }
  }, [currentPhoto, capturedPhotos, onPhotosUpdate, studentData.rollNumber]);

  // Keep and add more photos
  const handleKeepAndAddMore = useCallback(() => {
    if (currentPhoto && !isProcessing) {
      const success = addCurrentPhotoToCaptured();
      if (success) {
        console.log("Photo added successfully");
        setTimeout(() => {
          if (captureBtnRef.current) {
            captureBtnRef.current.focus();
          }
        }, 100);
      }
    }
  }, [currentPhoto, isProcessing, addCurrentPhotoToCaptured]);

  // Retake photo
  const handleRetake = useCallback(() => {
    setCurrentPhoto(null);
  }, []);

  // ✅ FIXED: handleFinish function - removed setCapturedPhotos
  // ✅ UPDATED: handleFinish function - No changes needed here, just better UI
const handleFinish = useCallback(async () => {
  const totalPhotos = (capturedPhotos?.length || 0) + (currentPhoto ? 1 : 0);

  if (totalPhotos === 0) {
    alert("Please capture at least one photo before finishing.");
    return;
  }

  try {
    setUploading(true);
    console.log(`🔄 Finishing session with ${totalPhotos} photos for ${studentData.rollNumber}...`);
    
    let finalPhotos = [...(capturedPhotos || [])];

    // Add current photo if exists
    if (currentPhoto) {
      const newPhoto = {
        id: Date.now(),
        data: currentPhoto,
        pageNumber: (capturedPhotos?.length || 0) + 1,
        timestamp: new Date().toISOString(),
        studentRoll: studentData.rollNumber,
      };
      finalPhotos.push(newPhoto);
    }

    // Call onFinish with photos and get success status
    console.log('📤 Sending photos to upload...');
    const success = await onFinish(finalPhotos);
    
    if (success) {
      console.log('✅ Upload successful, waiting for next student...');
      // ✅ AUTOMATIC: Parent component will handle moving to next student
      // Just reset the current state
      setCurrentPhoto(null);
      
      if (onPhotosUpdate) {
        onPhotosUpdate([]);
      }
      
      console.log('✅ Ready for next student...');
    } else {
      console.error('❌ Upload failed');
    }
  } catch (error) {
    console.error("❌ Error finishing photo session:", error);
    alert("Error finishing session. Please try again.");
  } finally {
    setUploading(false);
  }
}, [
  currentPhoto,
  capturedPhotos,
  onFinish,
  studentData.rollNumber,
  onPhotosUpdate,
]);

  // ✅ FIXED: Handle next student directly - clear photos properly
  const handleNextStudent = useCallback(() => {
    if (onNextStudent) {
      // ✅ FIXED: Clear photos before moving to next student
      setCurrentPhoto(null);
      if (onPhotosUpdate) {
        onPhotosUpdate([]);
      }
      onNextStudent();
    }
  }, [onNextStudent, onPhotosUpdate]);

  // Keyboard shortcuts (updated)
  const handleKeyPress = useCallback(
    (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "SELECT"
      ) {
        return;
      }

      const activeElement = document.activeElement;
      const isFocusOnButton = activeElement?.tagName === "BUTTON";

      if (isFocusOnButton && e.key === "Enter") {
        return;
      }

      if (
        ["r", "R", "c", "C", "k", "K", "f", "F", "a", "A", "n", "N", "Escape"].includes(
          e.key
        )
      ) {
        e.preventDefault();
      }

      switch (e.key) {
        case "Enter":
          if (!isFocusOnButton) {
            if (!currentPhoto && !isProcessing && cameraReady) {
              handleTakePhoto();
            } else if (currentPhoto) {
              handleKeepAndAddMore();
            }
          }
          break;
        case "r":
        case "R":
          if (currentPhoto) handleRetake();
          break;
        case "k":
        case "K":
        case "f":
        case "F":
          if ((capturedPhotos?.length || 0) > 0 || currentPhoto) {
            handleFinish();
          }
          break;
        case "a":
        case "A":
          if (currentPhoto) handleKeepAndAddMore();
          break;
        case "n":
        case "N":
          if (hasNextStudent && !uploading) {
            handleNextStudent();
          }
          break;
        case "Escape":
          if (onClose) onClose();
          break;
        case "Tab":
          break;
        default:
          break;
      }
    },
    [
      currentPhoto,
      isProcessing,
      cameraReady,
      capturedPhotos,
      uploading,
      hasNextStudent,
      handleTakePhoto,
      handleKeepAndAddMore,
      handleRetake,
      handleFinish,
      handleNextStudent,
      onClose,
    ]
  );

  // Auto-focus management (updated)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (currentPhoto && keepAndAddRef.current) {
        keepAndAddRef.current.focus();
      } else if (!currentPhoto && captureBtnRef.current && cameraReady) {
        captureBtnRef.current.focus();
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [currentPhoto, cameraReady]);

  // Camera initialization
  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      try {
        await setupCamera();
      } catch (error) {
        if (mounted) {
          console.error("Camera initialization failed:", error);
          setCameraError(
            "Failed to initialize camera. You can still use file upload."
          );
        }
      }
    };

    initCamera();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  const handleRemovePhoto = useCallback(
    (photoId) => {
      if (onPhotosUpdate) {
        onPhotosUpdate((prev) => prev.filter((photo) => photo.id !== photoId));
      }
    },
    [onPhotosUpdate]
  );

  // Camera retry function
  const handleRetryCamera = async () => {
    setCameraError(null);
    setCameraReady(false);
    await setupCamera();
  };

  if (!studentData) {
    return (
      <div className="photo-capture-overlay">
        <div className="photo-capture-modal">
          <div style={{ padding: "20px", textAlign: "center" }}>
            <h3>Error: No student data provided</h3>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-capture-overlay">
      <div className="photo-capture-modal fast-capture">
        <div className="capture-header">
          <div className="header-info">
            <h3>
              📸 {studentData.rollNumber} - {studentData.name}
            </h3>
            <span className="pages-count">
              {(capturedPhotos?.length || 0) + (currentPhoto ? 1 : 0)} pages
              {isProcessing && " (Capturing...)"}
              {uploading && " (Uploading...)"}
              {!cameraReady && !cameraError && " (Camera initializing...)"}
            </span>
            {/* ✅ ADDED: Next student indicator */}
            {hasNextStudent && (
              <span className="next-student-indicator">
                ⏭ Next student available
              </span>
            )}
          </div>
          <div className="quick-actions">
            <button
              type="button"
              className="quick-btn"
              onClick={handleTakePhoto}
              disabled={isProcessing || !cameraReady || uploading}
              title={cameraReady ? "Take Photo (Enter)" : "Camera not ready"}
            >
              📷
            </button>
            <button
              type="button"
              className="quick-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Choose from Files"
            >
              🖼️
            </button>
            <button
              type="button"
              className="close-btn"
              onClick={onClose}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          style={{ display: "none" }}
          disabled={uploading}
        />

        <div className="capture-content">
          {cameraError ? (
            <div className="camera-error">
              <div className="error-icon">📷</div>
              <h3>Camera Not Available</h3>
              <p>{cameraError}</p>
              <div className="camera-error-actions">
                <button
                  className="retry-camera-btn"
                  onClick={handleRetryCamera}
                  disabled={uploading}
                >
                  🔄 Retry Camera
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  📁 Use File Upload Instead
                </button>
              </div>
            </div>
          ) : currentPhoto ? (
            <div className="preview-mode fast-preview">
              <div className="photo-preview">
                <div className="image-container">
                  <img src={currentPhoto} alt="Captured" />
                  <div className="photo-badge">
                    Page {(capturedPhotos?.length || 0) + 1}
                  </div>
                </div>
              </div>

              <div className="quick-actions-preview">
                <button
                  ref={keepAndAddRef}
                  type="button"
                  className="action-btn keep-add"
                  onClick={handleKeepAndAddMore}
                  disabled={isProcessing || uploading}
                >
                  ➕ Keep & Next (Enter/A)
                </button>
                <button
                  ref={finishBtnRef}
                  type="button"
                  className="action-btn finish"
                  onClick={handleFinish}
                  disabled={uploading}
                >
                  {uploading ? "⏳ Uploading..." : "📄 Finish & Save (K/F)"}
                </button>
                <button
                  type="button"
                  className="action-btn retake"
                  onClick={handleRetake}
                  disabled={uploading}
                >
                  🔄 Retake (R)
                </button>
                
                {/* ✅ ADDED: Next Student Button */}
                {hasNextStudent && (
                  <button
                    ref={nextStudentBtnRef}
                    type="button"
                    className="action-btn next-student"
                    onClick={handleNextStudent}
                    disabled={uploading}
                  >
                    ⏭ Next Student (N)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="capture-mode fast-capture-ui">
              {!cameraReady && !cameraError && (
                <div className="camera-status">
                  <div className="spinner"></div>
                  <p>Initializing camera... Please wait</p>
                </div>
              )}

              {cameraReady && (
                <div className="camera-ready-indicator">
                  <div className="camera-icon">📷</div>
                  <p>Camera Ready - Point at document and click capture</p>
                </div>
              )}

              {capturedPhotos && capturedPhotos.length > 0 && (
                <div className="photos-grid-mini">
                  <p className="mini-photos-title">Captured Pages:</p>
                  <div className="mini-photos-container">
                    {capturedPhotos.slice(-4).map((photo) => (
                      <div key={photo.id} className="mini-photo">
                        <img
                          src={photo.data}
                          alt={`Page ${photo.pageNumber}`}
                        />
                        <span className="mini-page-no">{photo.pageNumber}</span>
                        <button
                          type="button"
                          className="mini-remove"
                          onClick={() => handleRemovePhoto(photo.id)}
                          title="Remove this page"
                          disabled={uploading}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="capture-main">
                {isProcessing ? (
                  <div className="processing-overlay">
                    <div className="spinner"></div>
                    <p>Capturing Photo...</p>
                  </div>
                ) : (
                  <button
                    ref={captureBtnRef}
                    type="button"
                    className="capture-btn-large"
                    onClick={handleTakePhoto}
                    disabled={isProcessing || !cameraReady || uploading}
                  >
                    <div className="camera-icon-large">📷</div>
                    <div className="capture-text">
                      {cameraReady
                        ? "Click to Capture Photo"
                        : "Camera Loading..."}
                    </div>
                    <div className="shortcut-hint">
                      {cameraReady ? "Or Press Enter Key" : "Please Wait"}
                    </div>
                  </button>
                )}
              </div>

              <div className="bottom-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  📁 Choose File Instead
                </button>
                {capturedPhotos && capturedPhotos.length > 0 && (
                  <button
                    type="button"
                    className="finish-btn-mini"
                    onClick={handleFinish}
                    disabled={uploading}
                  >
                    {uploading ? "⏳ Uploading..." : `📄 Finish (${capturedPhotos.length} pages)`}
                  </button>
                )}
                
                {/* ✅ ADDED: Next Student in bottom actions */}
                {hasNextStudent && (
                  <button
                    type="button"
                    className="next-student-btn-mini"
                    onClick={handleNextStudent}
                    disabled={uploading}
                  >
                    ⏭ Next Student
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="shortcuts-help">
          <span>
            {cameraError
              ? "Camera unavailable. Use file upload instead."
              : `Shortcuts: Enter=Capture/Keep & Next, R=Retake, K/F=Finish & Save, A=Keep & Next${hasNextStudent ? ", N=Next Student" : ""}, Esc=Close`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PhotoCapture;