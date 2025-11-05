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

  // ✅ UPDATED: handlePhotosCaptured - Automatically moves to next student after success
  const handlePhotosCaptured = async (photosArray) => {
    if (!selectedStudent || photosArray.length === 0) {
      console.error("No student selected or no photos to upload");
      return false;
    }

    setError(null);
    try {
      console.log('🔄 Converting base64 images to files...');
      
      // Convert base64 images to File objects
      const imageFiles = await Promise.all(
        photosArray.map(async (photo, index) => {
          try {
            const response = await fetch(photo.data);
            const blob = await response.blob();
            return new File([blob], `page_${index + 1}.jpg`, { type: 'image/jpeg' });
          } catch (error) {
            console.error(`Error converting image ${index + 1}:`, error);
            throw new Error(`Failed to convert image ${index + 1}`);
          }
        })
      );

      console.log(`📤 Uploading ${imageFiles.length} images to backend for student ${selectedStudent.rollNumber}...`);

      // Upload files to backend
      const formData = new FormData();
      imageFiles.forEach(file => {
        formData.append('images', file);
      });

      formData.append('studentId', selectedStudent._id);
      formData.append('rollNumber', selectedStudent.rollNumber);

      const response = await apiService.uploadScans(selectedStudent._id, formData);
      
      if (response.success) {
        const successMessage = `✅ Successfully scanned ${response.scannedPages || imageFiles.length} pages for ${selectedStudent.rollNumber}`;
        console.log(successMessage);
        
        // ✅ Refresh students list to update scan status
        await fetchStudents(currentPage, itemsPerPage);
        
        console.log('✅ Upload completed successfully');
        
        // ✅ AUTOMATICALLY MOVE TO NEXT STUDENT AFTER SUCCESS
        const nextStudent = getNextStudent();
        if (nextStudent) {
          console.log(`🔄 Automatically moving to next student: ${nextStudent.rollNumber}`);
          setSelectedStudent(nextStudent);
          setCapturedPhotos([]); // Reset photos for new student
          return true;
        } else {
          console.log('🎉 No more students available for scanning');
          // No more students, keep modal open but don't change student
          return true;
        }
      } else {
        const errorMsg = response.message || "Failed to upload scans";
        console.error('❌ Upload failed:', errorMsg);
        setError(errorMsg);
        return false;
      }
    } catch (error) {
      console.error("❌ Upload scans error:", error);
      const errorMsg = error.message || "Failed to upload scanned images";
      setError(errorMsg);
      return false;
    }
  };

  // ✅ UPDATED: getNextStudent - Finds next unscanned student
  const getNextStudent = () => {
    if (!selectedStudent || students.length === 0) return null;
    
    const currentIndex = students.findIndex(s => s._id === selectedStudent._id);
    if (currentIndex === -1) return null;
    
    // Find next unscanned student starting from current index + 1
    for (let i = currentIndex + 1; i < students.length; i++) {
      if (!students[i].isScanned && students[i].status !== 'Absent') {
        return students[i];
      }
    }
    
    // If no more in current page, try first student of next page
    if (currentPage < totalPages) {
      // You can implement auto-page change here if needed
      console.log('📄 Next student might be on next page');
      return null;
    }
    
    return null;
  };

  // ✅ UPDATED: Handle next student selection
  const handleNextStudent = () => {
    const nextStudent = getNextStudent();
    if (nextStudent) {
      setSelectedStudent(nextStudent);
      setCapturedPhotos([]);
      console.log(`🔄 Moving to next student: ${nextStudent.rollNumber}`);
    } else {
      // No more students, close the modal
      setShowPhotoCapture(false);
      setSelectedStudent(null);
      setCapturedPhotos([]);
      alert("🎉 All students scanned! Or no more students available for scanning.");
    }
  };

  // Check if next student is available
  const hasNextStudent = !!getNextStudent();

  // Handle PDF generation
  const handleGeneratePDF = async (student) => {
    setError(null);
    try {
      if (!student.isScanned) {
        setError("Student has not been scanned yet. Please scan copies first.");
        return;
      }

      if (!student.pdfPath) {
        setError("PDF not generated yet. Please wait or rescan the copies.");
        return;
      }

      const result = await apiService.generatePDF(student._id);
      if (result.success) {
        console.log(`✅ PDF downloaded: ${result.filename}`);
        
        // Refresh students list to update PDF status
        await fetchStudents(currentPage, itemsPerPage);
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
      setError(error.message || "PDF download failed. Please try scanning again.");
    }
  };

  // Upload Excel file
  const uploadExcelToBackend = async (file) => {
    setLoading(true);
    setError(null);
    try {
      console.log('📤 Uploading file to backend:', file.name);

      const formData = new FormData();
      formData.append('file', file);

      const response = await apiService.uploadExcel(formData);
      
      if (response.success) {
        setIsExcelUploaded(true);
        await fetchStudents(1, itemsPerPage);
        console.log('✅ Excel upload successful:', response);
      }
    } catch (error) {
      console.error('❌ Excel upload failed:', error);
      setError(error.message || "Failed to upload Excel file");
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

  const handleStatusChange = async (studentId, newStatus) => {
    try {
      const response = await apiService.updateStudentStatus(studentId, newStatus);
      if (response.success) {
        setStudents(prev => prev.map(student => 
          student._id === studentId 
            ? { ...student, status: newStatus }
            : student
        ));
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      setError("Failed to update student status");
    }
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
      setError("Failed to update student remark");
    }
  };

  const handleScanRequest = (student) => {
    setSelectedStudent(student);
    setShowPhotoCapture(true);
    setCapturedPhotos([]);
    console.log(`📷 Starting scan for student: ${student.rollNumber}`);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>📱 University Exam Copy Scanner</h1>
          <p>Capture Photos & Generate PDF - Auto Next Student Scanning</p>
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
            onFinish={handlePhotosCaptured} // ✅ Now automatically moves to next student
            onClose={() => {
              setShowPhotoCapture(false);
              setSelectedStudent(null);
              setCapturedPhotos([]);
              console.log('📷 Photo capture modal closed');
            }}
            onNextStudent={handleNextStudent} // ✅ Manual next student handler
            hasNextStudent={hasNextStudent} // ✅ Next student availability
          />
        )}
      </main>
    </div>
  );
}

export default App;