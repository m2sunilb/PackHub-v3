import fs from 'fs/promises';
import path from 'path';

export interface User {
  id: string; // Enter username / email
  name: string;
}

export interface Attachment {
  id: string;
  projectId: string;
  stageId: number;
  filename: string;
  size: number;
  mimetype: string;
  uploadedBy: string;
  uploadedAt: string;
  filePath: string;
}

export interface AuditLog {
  id: string;
  projectId: string;
  stageId: number;
  userId: string;
  userName: string;
  action: 'Proceed' | 'On Hold' | 'Not Applicable' | 'Create' | 'Submit' | 'Upload';
  details: string; // Free-text reason or action description
  timestamp: string;
}

export interface StageData {
  status: 'White' | 'Green' | 'Amber' | 'Gray';
  reason?: string;
  completedBy?: string;
  completedAt?: string;
  answers?: any; // Stores the Q&A specific to this stage
}

export interface Project {
  id: string;
  name: string;
  type: 'Innovation' | 'Renovation' | '5S' | 'Others';
  typeDetails?: string;
  category: 'HC' | 'PC' | 'B&W' | 'Foods' | 'UI';
  country: string;
  contributors: string[]; // Team member names
  ownerId: string; // User ID of creator
  ownerName: string;
  status: 'In Progress' | 'Completed' | 'On Hold';
  currentStage: number; // 1 to 15
  stages: { [stageId: number]: StageData };
  createdAt: string;
  updatedAt: string;
  startDate?: string;
  endDate?: string;
}

interface DatabaseSchema {
  users: { [id: string]: User };
  projects: { [id: string]: Project };
  attachments: { [id: string]: Attachment };
  auditLogs: AuditLog[];
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

class Database {
  private data: DatabaseSchema = {
    users: {},
    projects: {},
    attachments: {},
    auditLogs: [],
  };
  private isLoaded = false;

  private async ensureDir() {
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
    } catch (e) {
      // already exists or can't create
    }
  }

  async load() {
    if (this.isLoaded) return;
    await this.ensureDir();
    try {
      const content = await fs.readFile(DB_FILE, 'utf-8');
      this.data = JSON.parse(content);
    } catch (error) {
      // File doesn't exist, save default schema
      await this.save();
    }
    this.isLoaded = true;
  }

  async save() {
    await this.ensureDir();
    await fs.writeFile(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  // Auth / Users
  async getUser(id: string): Promise<User | null> {
    await this.load();
    const userId = id.trim().toLowerCase();
    return this.data.users[userId] || null;
  }

  async createUser(id: string, name: string): Promise<User> {
    await this.load();
    const userId = id.trim().toLowerCase();
    const user: User = { id: userId, name };
    this.data.users[userId] = user;
    await this.save();
    return user;
  }

  async listUsers(): Promise<User[]> {
    await this.load();
    return Object.values(this.data.users);
  }

  // Projects
  async getProject(id: string): Promise<Project | null> {
    await this.load();
    return this.data.projects[id] || null;
  }

  async createProject(project: Project): Promise<Project> {
    await this.load();
    this.data.projects[project.id] = project;
    await this.save();
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    await this.load();
    const project = this.data.projects[id];
    if (!project) return null;
    const updated = { ...project, ...updates, updatedAt: new Date().toISOString() };
    this.data.projects[id] = updated;
    await this.save();
    return updated;
  }

  async listProjects(): Promise<Project[]> {
    await this.load();
    return Object.values(this.data.projects);
  }

  // Attachments
  async addAttachment(attachment: Attachment): Promise<Attachment> {
    await this.load();
    this.data.attachments[attachment.id] = attachment;
    await this.save();
    return attachment;
  }

  async getAttachment(id: string): Promise<Attachment | null> {
    await this.load();
    return this.data.attachments[id] || null;
  }

  async listAttachments(projectId: string): Promise<Attachment[]> {
    await this.load();
    return Object.values(this.data.attachments).filter(a => a.projectId === projectId);
  }

  async listStageAttachments(projectId: string, stageId: number): Promise<Attachment[]> {
    await this.load();
    return Object.values(this.data.attachments).filter(
      a => a.projectId === projectId && a.stageId === stageId
    );
  }

  async deleteAttachment(id: string): Promise<boolean> {
    await this.load();
    if (!this.data.attachments[id]) return false;
    delete this.data.attachments[id];
    await this.save();
    return true;
  }

  // Audit Logs
  async addAuditLog(log: AuditLog): Promise<AuditLog> {
    await this.load();
    this.data.auditLogs.push(log);
    await this.save();
    return log;
  }

  async listAuditLogs(projectId: string): Promise<AuditLog[]> {
    await this.load();
    return this.data.auditLogs
      .filter(log => log.projectId === projectId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getAnalyticsSummary(userId: string): Promise<any> {
    await this.load();
    const projects = Object.values(this.data.projects).filter(
      p => p.ownerId === userId || p.contributors.map(c => c.toLowerCase()).includes(userId.toLowerCase())
    );

    const total = projects.length;
    const inProgress = projects.filter(p => p.status === 'In Progress').length;
    const completed = projects.filter(p => p.status === 'Completed').length;
    const onHold = projects.filter(p => p.status === 'On Hold').length;

    // Check for "overdue" projects or stages. Overdue can be mock or based on status
    // If On Hold or In Progress for > 30 days, we can classify as overdue for demonstration
    const now = new Date();
    const overdue = projects.filter(p => {
      if (p.status === 'Completed') return false;
      const startDate = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
      const diffDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 30; // Mark overdue if open for > 30 days
    }).length;

    // Breakdown by type
    const byType = {
      Innovation: projects.filter(p => p.type === 'Innovation').length,
      Renovation: projects.filter(p => p.type === 'Renovation').length,
      '5S': projects.filter(p => p.type === '5S').length,
      Others: projects.filter(p => p.type === 'Others').length,
    };

    // Stage progress tracker statistics for each project
    const projectProgress = projects.map(p => {
      const stageStatuses = Object.keys(p.stages).map(stageId => ({
        stageId: Number(stageId),
        status: p.stages[Number(stageId)].status,
      }));
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        currentStage: p.currentStage,
        status: p.status,
        stageStatuses,
      };
    });

    return {
      stats: { total, inProgress, completed, onHold, overdue },
      byType,
      projects: projectProgress,
    };
  }
}

export const db = new Database();
