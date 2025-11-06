import React, { useState, useEffect } from "react";
import StudentTable from "./components/StudentTable";
import Stats from "./components/Stats";
import PhotoCapture from "./components/PhotoCapture";
import apiService from "./services/api";
import "./App.css";

function App() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [isExcelUploaded, setIsExcelUploaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchStudents();
  }, [currentPage, itemsPerPage]);

  const fetchStudents = async (page = currentPage, limit = itemsPerPage) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getStudents({
        page,
        limit,
        sortBy: 'rollNumber',
        sortOrder: 'asc'
      });
      
      if (response.success) {
        setStudents(response.students);
        setTotalStudents(response.pagination.totalStudents);
        setTotalPages(response.pagination.totalPages);
        setCurrentPage(response.pagination.currentPage);
      }
    } catch (error) {
      console.error("Failed to fetch students:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotosCaptured = async (photosArray) => {
    if (!selectedStudent || photosArray.length === 0) {
      console.error("No student selected or no photos to upload");
      return false;
    }

    try {
      console.log(`📤 Uploading ${photosArray.length} images for ${selectedStudent.rollNumber}...`);

      // Convert base64 images to File objects
      const imageFiles = await Promise.all(
        photosArray.map(async (photo, index) => {
          const response = await fetch(photo.data);
          const blob = await response.blob();
          return new File([blob], `page_${index + 1}.jpg`, { type: 'image/jpeg' });
        })
      );

      // Upload files to backend
      const formData = new FormData();
      imageFiles.forEach(file => {
        formData.append('images', file);
      });

      const response = await apiService.uploadScans(selectedStudent._id, formData);
      
      if (response.success) {
        console.log(`✅ Successfully uploaded ${photosArray.length} pages for ${selectedStudent.rollNumber}`);
        
        // Refresh students list
        await fetchStudents(currentPage, itemsPerPage);
        
        return true;
      } else {
        setError(response.message || "Failed to upload scans");
        return false;
      }
    } catch (error) {
      console.error("Upload scans error:", error);
      setError("Failed to upload scanned images");
      return false;
    }
  };

  const getNextStudent = () => {
    if (!selectedStudent || students.length === 0) return null;
    
    const currentIndex = students.findIndex(s => s._id === selectedStudent._id);
    if (currentIndex === -1) return null;
    
    // Find next pending student
    for (let i = currentIndex + 1; i < students.length; i++) {
      if (students[i].status === 'Pending' && !students[i].isScanned) {
        return students[i];
      }
    }
    
    return null;
  };

  const handleNextStudent = () => {
    const nextStudent = getNextStudent();
    if (nextStudent) {
      setSelectedStudent(nextStudent);
      setCapturedPhotos([]);
    } else {
      setShowPhotoCapture(false);
      setSelectedStudent(null);
      setCapturedPhotos([]);
    }
  };

  // ✅ UPDATED: Handle mark as absent
  const handleMarkAsAbsent = async () => {
    if (!selectedStudent) return;

    try {
      const response = await apiService.updateStudentStatus(selectedStudent._id, 'Absent');
      if (response.success) {
        await fetchStudents(currentPage, itemsPerPage);
        handleNextStudent();
      }
    } catch (error) {
      console.error("Failed to mark as absent:", error);
      setError("Failed to mark student as absent");
    }
  };

  // ✅ NEW: Handle mark as missing
  const handleMarkAsMissing = async () => {
    if (!selectedStudent) return;

    try {
      const response = await apiService.updateStudentStatus(selectedStudent._id, 'Missing');
      if (response.success) {
        await fetchStudents(currentPage, itemsPerPage);
        handleNextStudent();
      }
    } catch (error) {
      console.error("Failed to mark as missing:", error);
      setError("Failed to mark student as missing");
    }
  };

  const handleStatusChange = async (studentId, newStatus) => {
    try {
      const response = await apiService.updateStudentStatus(studentId, newStatus);
      if (response.success) {
        setStudents(prev => prev.map(student => 
          student._id === studentId 
            ? { ...student, status: newStatus }
            : student
        ));

        // Auto move to next student if current student is marked absent/missing
        if (selectedStudent && selectedStudent._id === studentId && 
            (newStatus === 'Absent' || newStatus === 'Missing')) {
          setTimeout(() => {
            handleNextStudent();
          }, 300);
        }
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      setError("Failed to update student status");
    }
  };

  // Check if next student is available
  const hasNextStudent = !!getNextStudent();

  const handleGeneratePDF = async (student) => {
    try {
      const result = await apiService.generatePDF(student._id);
      if (result.success) {
        console.log(`✅ PDF downloaded: ${result.filename}`);
        await fetchStudents(currentPage, itemsPerPage);
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
      setError("PDF download failed. Please try again.");
    }
  };

  // Upload Excel file
  const uploadExcelToBackend = async (file) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiService.uploadExcel(formData);
      
      if (response.success) {
        setIsExcelUploaded(true);
        await fetchStudents(1, itemsPerPage);
      }
    } catch (error) {
      console.error('Excel upload failed:', error);
      setError("Failed to upload Excel file");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      setError("Please upload a valid Excel file (.xlsx, .xls)");
      return;
    }

    uploadExcelToBackend(file);
    event.target.value = "";
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleItemsPerPageChange = (e) => {
    const newItemsPerPage = parseInt(e.target.value);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleRemarkChange = async (studentId, remark) => {
    try {
      const response = await apiService.updateStudentRemark(studentId, remark);
      if (response.success) {
        setStudents(prev => prev.map(student => 
          student._id === studentId 
            ? { ...student, remark }
            : student
        ));
      }
    } catch (error) {
      console.error("Failed to update remark:", error);
    }
  };

  const handleScanRequest = (student) => {
    setSelectedStudent(student);
    setShowPhotoCapture(true);
    setCapturedPhotos([]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>📱 University Exam Copy Scanner</h1>
          <p>Capture Photos & Generate PDF - Complete Student Workflow</p>
        </div>
      </header>

      <main className="main-content">
        {error && (
          <div className="error-banner">
            <span>❌ {error}</span>
            <button onClick={() => setError(null)} className="error-close">
              ×
            </button>
          </div>
        )}

        <Stats
          total={totalStudents}
          scanned={students.filter(s => s.isScanned).length}
          absent={students.filter(s => s.status === 'Absent').length}
          missing={students.filter(s => s.status === 'Missing').length} // ✅ ADDED: Missing count
        />

        <StudentTable
          students={students}
          onStatusChange={handleStatusChange}
          onRemarkChange={handleRemarkChange}
          selectedStudent={selectedStudent}
          onSelectStudent={handleScanRequest}
          onGeneratePDF={handleGeneratePDF}
          onExcelUpload={handleFileUpload}
          isExcelUploaded={isExcelUploaded}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          totalStudents={totalStudents}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />

        {showPhotoCapture && selectedStudent && (
          <PhotoCapture
            student={selectedStudent}
            capturedPhotos={capturedPhotos}
            onPhotosUpdate={setCapturedPhotos}
            onFinish={handlePhotosCaptured}
            onClose={() => {
              setShowPhotoCapture(false);
              setSelectedStudent(null);
              setCapturedPhotos([]);
            }}
            onNextStudent={handleNextStudent}
            onMarkAsAbsent={handleMarkAsAbsent}
            onMarkAsMissing={handleMarkAsMissing} // ✅ ADDED: Missing handler
            hasNextStudent={hasNextStudent}
          />
        )}
      </main>
    </div>
  );
}

export default App;