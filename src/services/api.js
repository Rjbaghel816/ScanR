const API_BASE = 'http://localhost:5000/api';

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    const isFormData = options.body instanceof FormData;
    const config = {
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object' && !isFormData) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'API request failed');
        }

        return data;
      } else {
        if (!response.ok) {
          try {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Download failed');
          } catch {
            throw new Error('Download failed');
          }
        }
        return response;
      }
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Students API
  async getStudents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/students?${query}`);
  }

  async getStudent(studentId) {
    return this.request(`/students/${studentId}`);
  }

  // ✅ ADDED: updateStudentStatus function
  async updateStudentStatus(studentId, status, remark = '') {
    return this.request(`/students/${studentId}/status`, {
      method: 'PATCH',
      body: { status, remark }
    });
  }

  // ✅ ADDED: updateStudentRemark function
  async updateStudentRemark(studentId, remark) {
    return this.request(`/students/${studentId}/remark`, {
      method: 'PATCH',
      body: { remark }
    });
  }

  // Excel Upload
  async uploadExcel(formData) {
    try {
      console.log('📤 Uploading Excel file via API...');
      
      const response = await fetch(`${API_BASE}/students/upload-excel`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Excel upload failed');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Excel upload API error:', error);
      throw error;
    }
  }

  async deleteStudent(studentId) {
    return this.request(`/students/${studentId}`, {
      method: 'DELETE'
    });
  }

  async deleteAllStudents() {
    return this.request('/students', {
      method: 'DELETE'
    });
  }

  // Uploads API
  async uploadScans(studentId, formData) {
    const response = await fetch(`${API_BASE}/upload/scan/${studentId}`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }
    
    return response.json();
  }

  async deleteScans(studentId) {
    return this.request(`/upload/scan/${studentId}`, {
      method: 'DELETE'
    });
  }

  // PDF API
  async generatePDF(studentId) {
    try {
      const response = await fetch(`${API_BASE}/students/${studentId}/generate-pdf`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'PDF generation failed');
      }

      // Get filename from response headers or create default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `Copy_${studentId}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      return { 
        success: true,
        filename: filename
      };
    } catch (error) {
      console.error('PDF download error:', error);
      throw error;
    }
  }

  async downloadPDF(studentId) {
    try {
      const response = await fetch(`${API_BASE}/upload/pdf/${studentId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'PDF download failed');
      }

      const contentDisposition = response.headers.get('content-disposition');
      let filename = `Copy_${studentId}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      return { 
        success: true,
        filename: filename
      };
    } catch (error) {
      console.error('PDF download error:', error);
      throw error;
    }
  }

  // Stats API
  async getStats() {
    return this.request('/students/stats/summary');
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Utility method to convert base64 to file for upload
  base64ToFile(base64Data, filename = 'image.jpg') {
    const base64WithoutPrefix = base64Data.replace(/^data:image\/\w+;base64,/, '');
    
    const byteCharacters = atob(base64WithoutPrefix);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    const blob = new Blob(byteArrays, { type: 'image/jpeg' });
    return new File([blob], filename, { type: 'image/jpeg' });
  }

  // Batch operations
  async batchUpdateStatus(updates) {
    return this.request('/students/batch/status', {
      method: 'PATCH',
      body: { updates }
    });
  }

  async batchGeneratePDFs(studentIds) {
    return this.request('/students/batch/generate-pdf', {
      method: 'POST',
      body: { studentIds }
    });
  }
}

// Create global instance
const apiService = new ApiService();

// Add error handling wrapper
const createApiServiceWithErrorHandling = () => {
  const handler = {
    get(target, prop) {
      const value = target[prop];
      
      if (typeof value === 'function') {
        return async function (...args) {
          try {
            console.log(`🔄 API Call: ${prop}`, args[0]); // Log only first arg for brevity
            return await value.apply(target, args);
          } catch (error) {
            console.error(`API Error in ${prop}:`, error);
            
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
              throw new Error('Network error: Please check server connection.');
            } else if (error.message.includes('404')) {
              throw new Error('Requested resource not found.');
            } else if (error.message.includes('500')) {
              throw new Error('Server error: Please try again later.');
            } else {
              throw error;
            }
          }
        };
      }
      
      return value;
    }
  };
  
  return new Proxy(apiService, handler);
};

export default createApiServiceWithErrorHandling();