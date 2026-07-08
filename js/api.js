/**
 * API Service for Packaging Hub
 * Handles all backend communication and session management.
 */

const API_BASE = '/api';

export const ApiService = {
  // Session management
  setSession(token, user) {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
  },

  getSessionToken() {
    return sessionStorage.getItem('token');
  },

  getCurrentUser() {
    const userStr = sessionStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  clearSession() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  },

  // Helper for requests
  async request(endpoint, options = {}) {
    const token = this.getSessionToken();
    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.clearSession();
        window.dispatchEvent(new CustomEvent('unauthorized'));
      }
      let errorMsg = 'An unexpected error occurred';
      try {
        const errJson = await res.json();
        errorMsg = errJson.error || errorMsg;
      } catch (e) {
        // failed to parse json
      }
      throw new Error(errorMsg);
    }

    // Check if download or normal json
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    return res;
  },

  // Auth Api
  async login(id, name) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: { id, name },
    });
    this.setSession(data.token, data.user);
    return data.user;
  },

  // Users Api
  async getUsers() {
    return await this.request('/users');
  },

  // Projects Api
  async getProjects(search = '') {
    return await this.request(`/projects?search=${encodeURIComponent(search)}`);
  },

  async getProject(id) {
    return await this.request(`/projects/${id}`);
  },

  async createProject(projectData) {
    return await this.request('/projects', {
      method: 'POST',
      body: projectData,
    });
  },

  async updateProjectStage(projectId, stageId, { status, reason, answers }) {
    return await this.request(`/projects/${projectId}/stages/${stageId}`, {
      method: 'PATCH',
      body: { status, reason, answers },
    });
  },

  // Attachments Api
  async uploadAttachment(projectId, stageId, file) {
    const formData = new FormData();
    formData.append('stageId', stageId);
    formData.append('file', file);

    return await this.request(`/projects/${projectId}/attachments`, {
      method: 'POST',
      body: formData,
    });
  },

  async getAttachments(projectId) {
    return await this.request(`/projects/${projectId}/attachments`);
  },

  async deleteAttachment(projectId, attachmentId) {
    return await this.request(`/projects/${projectId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  },

  getAttachmentDownloadUrl(projectId, attachmentId) {
    return `${API_BASE}/projects/${projectId}/attachments/${attachmentId}/download`;
  },

  // History Api
  async getProjectHistory(projectId) {
    return await this.request(`/projects/${projectId}/history`);
  },

  // Dashboard Api
  async getDashboardSummary() {
    return await this.request('/dashboard/summary');
  },
};
