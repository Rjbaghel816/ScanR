import React, { useRef, useState, useCallback, useEffect } from "react";
import "./PhotoCapture.css";

const PhotoCapture = ({
  student,
  capturedPhotos = [],
  onPhotosUpdate,
  onFinish,
  onClose,
  onNextStudent,
  onMarkAsAbsent,
  onMarkAsMissing,
  hasNextStudent,
}) => {
  // Refs
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

  // Safe student data access
  const studentData = student || {
    rollNumber: "Unknown",
    name: "Unknown Student",
  };

  // Camera setup function
  const setupCamera = useCallback(async () => {
    try {
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

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setCameraReady(true);
      return true;
    } catch (error) {
      // Try front camera as fallback
      try {
        const fallbackConstraints = {
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        setStream(fallbackStream);
        setCameraReady(true);
        return true;
      } catch (fallbackError) {
        setCameraError("Camera access failed. Please check permissions.");
        setCameraReady(false);
        return false;
      }
    }
  }, [stream]);

  // Photo capture functions
  const handleTakePhoto = useCallback(async () => {
    if (isProcessing || !cameraReady || !stream) return;

    try {
      setIsProcessing(true);

      if ("ImageCapture" in window) {
        const track = stream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(track);

        try {
          const blob = await imageCapture.takePhoto();
          const reader = new FileReader();
          reader.onload = (e) => {
            setCurrentPhoto(e.target.result);
            setIsProcessing(false);
          };
          reader.readAsDataURL(blob);
        } catch {
          await captureWithCanvasFallback();
        }
      } else {
        await captureWithCanvasFallback();
      }
    } catch (error) {
      console.error("Error capturing photo:", error);
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
      setCurrentPhoto(imageDataURL);
      tempVideo.srcObject = null;
    } catch (error) {
      console.error("Canvas fallback failed:", error);
      throw error;
    }
  }, [stream]);

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
      addCurrentPhotoToCaptured();
      setTimeout(() => {
        if (captureBtnRef.current) {
          captureBtnRef.current.focus();
        }
      }, 100);
    }
  }, [currentPhoto, isProcessing, addCurrentPhotoToCaptured]);

  // Retake photo
  const handleRetake = useCallback(() => {
    setCurrentPhoto(null);
  }, []);

  // ✅ FIXED: handleFinish function - Clean and working
  const handleFinish = useCallback(async () => {
    const totalPhotos = (capturedPhotos?.length || 0) + (currentPhoto ? 1 : 0);

    if (totalPhotos === 0) {
      alert("Please capture at least one photo before finishing.");
      return;
    }

    try {
      setUploading(true);
      
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

      const success = await onFinish(finalPhotos);
      
      if (success) {
        setCurrentPhoto(null);
        if (onPhotosUpdate) {
          onPhotosUpdate([]);
        }
        
        // Auto move to next student
        if (hasNextStudent) {
          setTimeout(() => {
            onNextStudent();
          }, 500);
        } else {
          onClose();
        }
      }
    } catch (error) {
      console.error("Error finishing photo session:", error);
    } finally {
      setUploading(false);
    }
  }, [
    currentPhoto,
    capturedPhotos,
    onFinish,
    studentData.rollNumber,
    hasNextStudent,
    onPhotosUpdate,
    onNextStudent,
    onClose,
  ]);

  // Handle next student
  const handleNextStudent = useCallback(() => {
    setCurrentPhoto(null);
    if (onPhotosUpdate) {
      onPhotosUpdate([]);
    }
    onNextStudent();
  }, [onNextStudent, onPhotosUpdate]);

  // Keyboard shortcuts
  const handleKeyPress = useCallback(
    (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") {
        return;
      }

      const activeElement = document.activeElement;
      const isFocusOnButton = activeElement?.tagName === "BUTTON";

      if (isFocusOnButton && e.key === "Enter") {
        return;
      }

      if (["r", "R", "k", "K", "f", "F", "a", "A", "n", "N", "Escape"].includes(e.key)) {
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

  // Auto-focus management
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
          setCameraError("Failed to initialize camera.");
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
            </span>
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
              title="Take Photo (Enter)"
            >
              📷
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

                <div className="status-actions">
                  <button
                    type="button"
                    className="action-btn absent"
                    onClick={onMarkAsAbsent}
                    disabled={uploading}
                  >
                    ❌ Absent
                  </button>
                  <button
                    type="button"
                    className="action-btn missing"
                    onClick={onMarkAsMissing}
                    disabled={uploading}
                  >
                    📝 Missing
                  </button>
                </div>

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
                <div className="status-buttons-bottom">
                  <button
                    type="button"
                    className="status-btn absent-btn"
                    onClick={onMarkAsAbsent}
                    disabled={uploading}
                  >
                    ❌ Mark Absent
                  </button>
                  <button
                    type="button"
                    className="status-btn missing-btn"
                    onClick={onMarkAsMissing}
                    disabled={uploading}
                  >
                    📝 Mark Missing
                  </button>
                </div>

                {capturedPhotos && capturedPhotos.length > 0 && (
                  <button
                    type="button"
                    className="finish-btn-mini"
                    onClick={handleFinish}
                    disabled={uploading}
                  >
                    {uploading
                      ? "⏳ Uploading..."
                      : `📄 Finish (${capturedPhotos.length} pages)`}
                  </button>
                )}

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
              ? "Camera unavailable. Please ensure camera permissions are granted."
              : `Shortcuts: Enter=Capture/Keep & Next, R=Retake, K/F=Finish & Save, A=Keep & Next${hasNextStudent ? ", N=Next Student" : ""}, Esc=Close`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PhotoCapture;