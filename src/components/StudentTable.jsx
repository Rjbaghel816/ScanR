import React, { useRef, useEffect } from "react";
import "./StudentTable.css";

const StudentTable = ({
  students,
  onStatusChange,
  onRemarkChange,
  selectedStudent,
  onSelectStudent,
  onGeneratePDF,
  onExcelUpload,
  isExcelUploaded,
  loading,
  // Pagination Props
  currentPage,
  totalPages,
  totalStudents,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const fileInputRef = useRef(null);

  const handleScanClick = (student) => {
    if (!student.isScanned && student.status !== "Absent" && student.status !== "Missing") {
      onSelectStudent(student);
    }
  };

  const handlePDFClick = (student, event) => {
    event.stopPropagation();
    if (student.isScanned && student.pdfPath) {
      onGeneratePDF(student);
    } else if (student.isScanned && !student.pdfPath) {
      alert("PDF is being generated. Please wait a moment...");
    } else {
      alert("Please scan copies first to generate PDF.");
    }
  };

  const handleExcelUploadClick = () => {
    fileInputRef.current?.click();
  };

  const getScanTime = (scanTime) => {
    if (!scanTime) return "";
    return new Date(scanTime).toLocaleTimeString();
  };

  const getPDFTime = (pdfGeneratedAt) => {
    if (!pdfGeneratedAt) return "";
    return new Date(pdfGeneratedAt).toLocaleTimeString();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  if (loading) {
    return (
      <div className="student-table-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading students data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-table-container">
      {/* Excel Upload Section */}
      <div className="excel-upload-section">
        <button
          className="excel-upload-btn"
          onClick={handleExcelUploadClick}
          title="Upload Excel file with Roll Numbers and Subject Details"
        >
          📊 Upload Excel File
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onExcelUpload}
          accept=".xlsx, .xls, .csv"
          style={{ display: "none" }}
        />
        <span className="upload-hint">
          Upload Excel with columns: Roll Number, Subject Code, Subject Name
        </span>

        {students.length > 0 && (
          <div className="quick-stats">
            <span className="stat-item">📋 Total: {totalStudents}</span>
            <span className="stat-item">
              ✅ Scanned: {students.filter((s) => s.isScanned).length}
            </span>
            <span className="stat-item">
              📄 PDFs: {students.filter((s) => s.pdfPath).length}
            </span>
            <span className="stat-item">
              ❌ Absent: {students.filter((s) => s.status === 'Absent').length}
            </span>
            <span className="stat-item">
              📝 Missing: {students.filter((s) => s.status === 'Missing').length}
            </span>
          </div>
        )}
      </div>

      {/* Pagination Controls - Top */}
      {students.length > 0 && (
        <div className="pagination-controls top">
          <div className="pagination-info">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, totalStudents)} of{" "}
            {totalStudents} students
          </div>
          <div className="pagination-actions">
            <select
              value={itemsPerPage}
              onChange={onItemsPerPageChange}
              className="page-size-select"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>

            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="pagination-btn first"
            >
              ⏮ First
            </button>

            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="pagination-btn prev"
            >
              ◀ Prev
            </button>

            <span className="page-numbers">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="pagination-btn next"
            >
              Next ▶
            </button>

            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="pagination-btn last"
            >
              Last ⏭
            </button>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        {students.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No Students Data</h3>
            <p>Please upload an Excel file to get started</p>
            <button
              className="excel-upload-btn empty-btn"
              onClick={handleExcelUploadClick}
            >
              📊 Upload Excel File
            </button>
          </div>
        ) : (
          <table className="students-table">
            <thead className="table-header">
              <tr>
                <th>Roll No</th>
                <th>Subject Code</th>
                <th>Subject Name</th>
                <th>Scan Status</th>
                <th>Pages</th>
                <th>Scan Time</th>
                <th>PDF Status</th>
                <th>Status</th>
                <th>Remark</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr
                  key={student._id || student.id}
                  className={`student-row ${
                    student.isScanned ? "scanned" : ""
                  } ${selectedStudent?._id === student._id ? "selected" : ""} ${
                    student.status === "Absent" ? "absent" : 
                    student.status === "Missing" ? "missing" : ""
                  }`}
                >
                  <td className="roll-number">{student.rollNumber}</td>
                  <td className="subject-code">{student.subjectCode}</td>
                  <td className="subject-name">{student.subjectName}</td>

                  <td>
                    <div className="scan-status">
                      <span
                        className={`status-indicator ${
                          student.isScanned ? "scanned" : "pending"
                        }`}
                      >
                        {student.isScanned ? "✓ Scanned" : "⏳ Pending"}
                      </span>
                    </div>
                  </td>

                  <td className="pages-count">
                    <div className="pages-info">
                      <span className="pages-number">
                        {student.scannedPages ? student.scannedPages.length : 0}
                      </span>
                      {student.scannedPages &&
                        student.scannedPages.length > 0 && (
                          <span className="pages-label">pages</span>
                        )}
                    </div>
                  </td>

                  <td className="scan-time">{getScanTime(student.scanTime)}</td>

                  <td className="pdf-status">
                    <div className="pdf-info">
                      {student.pdfPath ? (
                        <span className="pdf-available" title="PDF Available">
                          📄 Ready
                        </span>
                      ) : student.isScanned ? (
                        <span
                          className="pdf-processing"
                          title="PDF Being Generated"
                        >
                          ⏳ Processing
                        </span>
                      ) : (
                        <span className="pdf-pending" title="Not Scanned Yet">
                          ❌ Not Generated
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    <select
                      value={student.status}
                      onChange={(e) =>
                        onStatusChange(
                          student._id || student.id,
                          e.target.value
                        )
                      }
                      className={`status-select ${
                        student.status === "Absent"
                          ? "absent"
                          : student.status === "Missing"
                          ? "missing"
                          : student.status === "Present"
                          ? "present"
                          : "pending"
                      }`}
                      disabled={student.isScanned}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Missing">Missing</option> {/* ✅ ADDED: Missing option */}
                    </select>
                  </td>

                  <td>
                    <input
                      type="text"
                      value={student.remark || ""}
                      onChange={(e) =>
                        onRemarkChange(
                          student._id || student.id,
                          e.target.value
                        )
                      }
                      placeholder="Add remark..."
                      className="remark-input"
                      maxLength={100}
                    />
                    {student.remark && (
                      <div className="remark-length">
                        {student.remark.length}/100
                      </div>
                    )}
                  </td>

                  <td>
                    <div className="action-buttons">
                      {/* Scan Button */}
                      <button
                        className={`scan-btn ${
                          student.isScanned ? "scanned" : ""
                        } ${
                          student.status === "Absent" || student.status === "Missing" 
                            ? "disabled" 
                            : ""
                        }`}
                        onClick={() => handleScanClick(student)}
                        disabled={
                          student.isScanned || 
                          student.status === "Absent" || 
                          student.status === "Missing"
                        }
                        title={
                          student.isScanned
                            ? "Already scanned"
                            : student.status === "Absent" || student.status === "Missing"
                            ? "Cannot scan absent/missing students"
                            : "Scan student copies"
                        }
                      >
                        {student.isScanned ? (
                          <>
                            <span className="btn-icon">✓</span>
                            Scanned
                          </>
                        ) : (
                          <>
                            <span className="btn-icon">📷</span>
                            Scan Copy
                          </>
                        )}
                      </button>

                      {/* PDF Button */}
                      {student.pdfPath ? (
                        <button
                          className="pdf-btn available"
                          onClick={(e) => handlePDFClick(student, e)}
                          title="Download PDF"
                        >
                          <span className="btn-icon">📄</span>
                          Download PDF
                        </button>
                      ) : student.isScanned ? (
                        <button
                          className="pdf-btn processing"
                          disabled
                          title="PDF is being generated"
                        >
                          <span className="btn-icon">⏳</span>
                          Generating...
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls - Bottom */}
      {students.length > 0 && totalPages > 1 && (
        <div className="pagination-controls bottom">
          <div className="pagination-info">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, totalStudents)} of{" "}
            {totalStudents} students
          </div>
          <div className="pagination-actions">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="pagination-btn first"
              title="First Page"
            >
              ⏮ First
            </button>

            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="pagination-btn prev"
              title="Previous Page"
            >
              ◀ Prev
            </button>

            <div className="page-numbers-list">
              {getPageNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`pagination-btn page-number ${
                    currentPage === page ? "active" : ""
                  }`}
                  title={`Page ${page}`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="pagination-btn next"
              title="Next Page"
            >
              Next ▶
            </button>

            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="pagination-btn last"
              title="Last Page"
            >
              Last ⏭
            </button>
          </div>
        </div>
      )}

      {students.length > 0 && (
        <div className="table-footer">
          <div className="footer-info">
            <span className="footer-item">
              💡 Tip: Scan copies first, then download PDF
            </span>
            <span className="footer-item">
              📁 PDFs are automatically generated after scanning
            </span>
            <span className="footer-item">
              📝 Use "Missing" status for students who didn't submit copies
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
export default StudentTable;