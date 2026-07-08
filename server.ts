import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import multer from 'multer';
import { db, Project, StageData, Attachment, AuditLog, User } from './src/db.js';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON bodies
app.use(express.json());

// Ensure uploads folder exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Helper for generating random UUIDs
function generateUUID() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Auth Middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing session token' });
    return;
  }
  const userId = authHeader.split(' ')[1].toLowerCase();
  db.getUser(userId)
    .then(user => {
      if (!user) {
        res.status(401).json({ error: 'Unauthorized: Invalid user session' });
        return;
      }
      (req as any).user = user;
      next();
    })
    .catch(err => {
      res.status(500).json({ error: 'Internal server error in auth' });
    });
}

// ---------------------- API Endpoints ----------------------

// 1. Auth Login (Mock SSO)
app.post('/api/auth/login', async (req, res) => {
  const { id, name } = req.body;
  if (!id || !id.trim() || !name || !name.trim()) {
    res.status(400).json({ error: 'Username/ID and Name are mandatory' });
    return;
  }

  try {
    let user = await db.getUser(id);
    if (!user) {
      user = await db.createUser(id, name.trim());
    }
    res.json({
      token: user.id,
      user,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
});

// 2. Get Users (for contributors list)
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await db.listUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// 3. Get Projects
app.get('/api/projects', requireAuth, async (req, res) => {
  const user = (req as any).user as User;
  const search = (req.query.search as string || '').toLowerCase();

  try {
    const projects = await db.listProjects();
    const isAdmin = user.id.toLowerCase() === 'admin';
    // Filter projects where user is owner or contributor (skip if user is admin)
    let filtered = projects;
    if (!isAdmin) {
      filtered = projects.filter(
        p =>
          p.ownerId === user.id ||
          p.contributors.some(c => c.toLowerCase() === user.id.toLowerCase() || c.toLowerCase() === user.name.toLowerCase())
      );
    }

    // Apply search filter if present
    if (search) {
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(search) ||
          p.type.toLowerCase().includes(search) ||
          p.category.toLowerCase().includes(search) ||
          p.country.toLowerCase().includes(search)
      );
    }

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve projects' });
  }
});

// 4. Create Project
app.post('/api/projects', requireAuth, async (req, res) => {
  const user = (req as any).user as User;
  const { name, type, typeDetails, category, country, contributors } = req.body;

  if (!name || !name.trim() || !type || !category || !country) {
    res.status(400).json({ error: 'All fields except contributors are mandatory' });
    return;
  }

  try {
    const projectId = generateUUID();
    const initialStages: { [key: number]: StageData } = {};

    // Initialize stages 1 to 15
    for (let i = 1; i <= 15; i++) {
      initialStages[i] = {
        status: 'White',
        answers: {},
      };
    }

    // Stage 1 is marked as active / White initially
    const newProject: Project = {
      id: projectId,
      name: name.trim(),
      type,
      typeDetails: type === 'Others' ? typeDetails : undefined,
      category,
      country,
      contributors: Array.isArray(contributors) ? contributors.filter(c => c && c.trim()) : [],
      ownerId: user.id,
      ownerName: user.name,
      status: 'In Progress',
      currentStage: 1,
      stages: initialStages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startDate: new Date().toISOString(),
    };

    const saved = await db.createProject(newProject);

    // Audit log
    await db.addAuditLog({
      id: generateUUID(),
      projectId,
      stageId: 0,
      userId: user.id,
      userName: user.name,
      action: 'Create',
      details: `Project '${name.trim()}' was created with type '${type}' and category '${category}'.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// 4b. Seed 15 Random Projects with Dummy Data
app.post('/api/projects/seed', requireAuth, async (req, res) => {
  const user = (req as any).user as User;
  
  const seedProjectTemplates = [
    { name: "Project Aurora Recycled HDPE", type: "Innovation", category: "Foods", country: "United Kingdom", desc: "Developing PCR HDPE high-barrier bottles for ambient food liquids." },
    { name: "Unilever Eco-Refill Pods", type: "Renovation", category: "PC", country: "Netherlands", desc: "Redesigning plastic pods with 75% less virgin plastic content." },
    { name: "Lightweight PET Jar for Dressings", type: "5S", category: "Foods", country: "United States", desc: "Reducing neck height and wall thickness to shave 4g off the PET jar." },
    { name: "Biodegradable Soap Wrappers", type: "Innovation", category: "PC", country: "India", desc: "Sourcing seaweed-based bio-films for bar soap secondary wrap." },
    { name: "Mono-material Sachet for Haircare", type: "Renovation", category: "PC", country: "Brazil", desc: "Converting multi-layer metalized laminate sachets into clean recyclable PE." },
    { name: "Aerosol Propellant Alternative", type: "Others", typeDetails: "Propellant Safety", category: "HC", country: "Germany", desc: "Testing low-GWP propellant alternatives for aerosol product stability." },
    { name: "Zero-waste Laundry Detergent Carton", type: "Innovation", category: "HC", country: "France", desc: "Developing water-resistant cardboard packaging for highly concentrated powder." },
    { name: "Project Sunbeam PCR Bottles", type: "5S", category: "B&W", country: "South Africa", desc: "Switching current black plastics to fully-recyclable carbon-free pigments." },
    { name: "Smart Label QR Code Integration", type: "Others", typeDetails: "Digital Tagging", category: "Foods", country: "Japan", desc: "Laser engraving scannable supply-chain origin codes on closures." },
    { name: "Recycled PP Tube for Oral Care", type: "Renovation", category: "PC", country: "China", desc: "Transitioning toothpaste tubes from aluminum-laminated barrier to recycle-friendly PE." },
    { name: "Cardboard Deodorant Stick Pack", type: "Innovation", category: "PC", country: "Australia", desc: "Replacing turn-dial plastic packaging with push-up paperboard structure." },
    { name: "Sustainably Sourced Squeeze Cap", type: "5S", category: "HC", country: "Mexico", desc: "Optimizing masterbatch dosage and cap diameter to reduce post-molding scrap." },
    { name: "Dual Chamber Flexible Pouch", type: "Others", typeDetails: "E-Commerce Pack", category: "Foods", country: "Canada", desc: "Robust double-chamber flexible film container optimized for drop-test compliance." },
    { name: "Compostable Tea Bags Outer Film", type: "Renovation", category: "Foods", country: "United Kingdom", desc: "Qualifying paper-based high seal-integrity outer bags for loose tea range." },
    { name: "Water-soluble Pod Film Renovations", type: "Innovation", category: "HC", country: "Italy", desc: "Formulating polyvinyl-alcohol film alternatives with faster dissolution rates." }
  ] as const;

  const sampleContributors = [
    ["Sunil Kumar", "Sarah Jenkins", "Hans Müller"],
    ["Sarah Jenkins", "Sunil Kumar", "Marta Silva"],
    ["John Doe", "Jane Smith", "Sunil Kumar"],
    ["Carlos Santana", "Sunil Kumar"],
    ["Sunil Kumar", "Yuki Tanaka", "Chen Wei"],
    ["Sunil Kumar"],
    ["Sarah Jenkins", "Sunil Kumar", "John Doe"],
    ["Hans Müller", "Sunil Kumar"],
    ["Sunil Kumar", "Jane Smith"],
    ["Yuki Tanaka", "Sunil Kumar", "Chen Wei"],
    ["Sunil Kumar", "Sarah Jenkins"],
    ["Sunil Kumar", "Carlos Santana"],
    ["Chen Wei", "Sunil Kumar"],
    ["Hans Müller", "Sunil Kumar", "Sarah Jenkins"],
    ["Marta Silva", "Sunil Kumar"]
  ];

  try {
    const seededProjects: Project[] = [];
    const now = new Date();

    for (let i = 0; i < seedProjectTemplates.length; i++) {
      const template = seedProjectTemplates[i];
      const contributors = sampleContributors[i];
      const projectId = generateUUID();

      // Randomize stage progress (between 1 and 15)
      // Make 2 projects completed (stage 15, status Completed)
      // Make 2 projects on hold (currentStage 4 or 8, status On Hold, currentStage status Amber)
      // Make 11 projects in progress at various stages
      let currentStage = Math.floor(Math.random() * 14) + 1; // 1 to 14
      let status: 'In Progress' | 'Completed' | 'On Hold' = 'In Progress';

      if (i === 1 || i === 7) {
        currentStage = 15;
        status = 'Completed';
      } else if (i === 4 || i === 11) {
        status = 'On Hold';
      }

      // Overdue randomization: 4 projects created >30 days ago to trigger the overdue card
      // Let's make projects 0, 3, 6, and 12 older (created 35-49 days ago)
      let daysAgo = Math.floor(Math.random() * 20) + 2; // 2 to 21 days ago
      if (i === 0 || i === 3 || i === 6 || i === 12) {
        daysAgo = Math.floor(Math.random() * 15) + 35; // 35 to 49 days ago
      }

      const createdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const updatedDate = new Date(now.getTime() - Math.floor(Math.random() * daysAgo) * 24 * 60 * 60 * 1000);

      const initialStages: { [key: number]: StageData } = {};
      for (let s = 1; s <= 15; s++) {
        if (s < currentStage) {
          // Completed preceding stages
          initialStages[s] = {
            status: Math.random() > 0.15 ? 'Green' : 'Gray',
            reason: 'All gate requirements met and approved by project lead.',
            completedBy: user.name,
            completedAt: new Date(createdDate.getTime() + s * 1.5 * 24 * 60 * 60 * 1000).toISOString(),
            answers: {
              gate_comments: "Seeded test phase comments.",
              gate_checklist: ["verified", "signed_off"]
            },
          };
        } else if (s === currentStage) {
          if (status === 'Completed') {
            initialStages[s] = {
              status: 'Green',
              reason: 'Project successfully commercialized.',
              completedBy: user.name,
              completedAt: updatedDate.toISOString(),
              answers: { gate_comments: "Successfully scaled up and rolled out." },
            };
          } else if (status === 'On Hold') {
            initialStages[s] = {
              status: 'Amber',
              reason: 'On hold due to raw material PCR supply disruption in regional market.',
              completedBy: user.name,
              completedAt: updatedDate.toISOString(),
              answers: {},
            };
          } else {
            // Normal active stage in progress
            initialStages[s] = {
              status: 'White',
              answers: {},
            };
          }
        } else {
          // Future stages
          initialStages[s] = {
            status: 'White',
            answers: {},
          };
        }
      }

      const newProject: Project = {
        id: projectId,
        name: template.name,
        type: template.type as any,
        typeDetails: 'typeDetails' in template ? template.typeDetails : undefined,
        category: template.category as any,
        country: template.country,
        contributors,
        ownerId: user.id,
        ownerName: user.name,
        status,
        currentStage,
        stages: initialStages,
        createdAt: createdDate.toISOString(),
        updatedAt: updatedDate.toISOString(),
        startDate: createdDate.toISOString(),
        endDate: status === 'Completed' ? updatedDate.toISOString() : undefined,
      };

      const saved = await db.createProject(newProject);
      seededProjects.push(saved);

      // Create an Audit Log
      await db.addAuditLog({
        id: generateUUID(),
        projectId,
        stageId: 0,
        userId: user.id,
        userName: user.name,
        action: 'Create',
        details: `Project '${template.name}' was seeded with stage ${currentStage} and status '${status}' (${template.desc}).`,
        timestamp: createdDate.toISOString(),
      });
    }

    res.status(201).json({ message: "Successfully seeded 15 mock projects", projects: seededProjects });
  } catch (error) {
    res.status(500).json({ error: 'Failed to seed mock projects' });
  }
});

// 5. Get Specific Project
app.get('/api/projects/:id', requireAuth, async (req, res) => {
  const projectId = req.params.id;
  try {
    const project = await db.getProject(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve project details' });
  }
});

// 6. Update Project Stage (Stage Gate submission / update)
app.patch('/api/projects/:id/stages/:stageId', requireAuth, async (req, res) => {
  const user = (req as any).user as User;
  const projectId = req.params.id;
  const stageId = parseInt(req.params.stageId, 10);
  const { status, reason, answers } = req.body;

  if (isNaN(stageId) || stageId < 1 || stageId > 15) {
    res.status(400).json({ error: 'Invalid stage ID' });
    return;
  }

  if (!status || !['Green', 'Amber', 'Gray'].includes(status)) {
    res.status(400).json({ error: 'Status must be Green, Amber, or Gray' });
    return;
  }

  if (status === 'Amber' && (!reason || !reason.trim())) {
    res.status(400).json({ error: 'Reason is mandatory when placing a stage On Hold' });
    return;
  }

  try {
    const project = await db.getProject(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Check permissions (must be owner or contributor or admin)
    const isAdmin = user.id.toLowerCase() === 'admin';
    const isContributor =
      isAdmin ||
      project.ownerId === user.id ||
      project.contributors.some(
        c => c.toLowerCase() === user.id.toLowerCase() || c.toLowerCase() === user.name.toLowerCase()
      );
    if (!isContributor) {
      res.status(403).json({ error: 'Forbidden: You are not a member of this project' });
      return;
    }

    // Prepare updated stages map
    const updatedStages = { ...project.stages };
    updatedStages[stageId] = {
      status,
      reason: reason || undefined,
      completedBy: user.name,
      completedAt: new Date().toISOString(),
      answers: answers || {},
    };

    let nextStage = project.currentStage;
    let projectStatus: 'In Progress' | 'Completed' | 'On Hold' = project.status;

    if (status === 'Green' || status === 'Gray') {
      // Advance stage-gate if the completed stage was the current active stage
      if (stageId === project.currentStage) {
        if (stageId < 15) {
          nextStage = stageId + 1;
          projectStatus = 'In Progress'; // Resume progress if previously On Hold
        } else if (stageId === 15) {
          // Final stage submission
          projectStatus = 'Completed';
        }
      }
    } else if (status === 'Amber') {
      projectStatus = 'On Hold';
    }

    // Save changes
    const updated = await db.updateProject(projectId, {
      stages: updatedStages,
      currentStage: nextStage,
      status: projectStatus,
      endDate: projectStatus === 'Completed' ? new Date().toISOString() : undefined,
    });

    // Add Audit Log
    let auditAction: 'Proceed' | 'On Hold' | 'Not Applicable' = 'Proceed';
    if (status === 'Amber') auditAction = 'On Hold';
    if (status === 'Gray') auditAction = 'Not Applicable';

    const stageNames = [
      '',
      'Marketing Brief',
      'Technical Brief',
      'Start Decision Gate',
      'Idea Generation',
      'Idea Screening',
      'Develop Decision Gate',
      'Design & Prototype Development',
      'Concept Design Lock',
      'Pilot Tool Creation',
      'Pilot & Testing',
      'Feasibility & Validation',
      'Launch Lock Gate',
      'Product Design Lock',
      'Launch Lock',
      'Scale-up & Implementation',
    ];

    await db.addAuditLog({
      id: generateUUID(),
      projectId,
      stageId,
      userId: user.id,
      userName: user.name,
      action: auditAction,
      details: `Stage ${stageId} (${stageNames[stageId]}) marked as '${status}'.${
        reason ? ` Reason: ${reason}` : ''
      }`,
      timestamp: new Date().toISOString(),
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update stage' });
  }
});

// 7. File Upload for Attachments
app.post(
  '/api/projects/:id/attachments',
  requireAuth,
  (req, res, next) => {
    // Custom error handler for Multer size limit
    upload.single('file')(req, res, err => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File size exceeds the 10 MB limit' });
        return;
      } else if (err) {
        res.status(500).json({ error: 'File upload failed: ' + err.message });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const user = (req as any).user as User;
    const projectId = req.params.id;
    const stageId = parseInt(req.body.stageId, 10);

    if (isNaN(stageId) || stageId < 1 || stageId > 15) {
      res.status(400).json({ error: 'Valid Stage ID is mandatory' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    try {
      const project = await db.getProject(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const attachmentId = generateUUID();
      const attachment: Attachment = {
        id: attachmentId,
        projectId,
        stageId,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedBy: user.name,
        uploadedAt: new Date().toISOString(),
        filePath: req.file.filename,
      };

      const saved = await db.addAttachment(attachment);

      // Audit log
      await db.addAuditLog({
        id: generateUUID(),
        projectId,
        stageId,
        userId: user.id,
        userName: user.name,
        action: 'Upload',
        details: `Uploaded file '${req.file.originalname}' (${(req.file.size / (1024 * 1024)).toFixed(
          2
        )} MB) for Stage ${stageId}.`,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: 'Failed to process attachment' });
    }
  }
);

// 8. Download / Retrieve Attachment File
app.get('/api/projects/:id/attachments/:attachmentId/download', requireAuth, async (req, res) => {
  const attachmentId = req.params.attachmentId;

  try {
    const attachment = await db.getAttachment(attachmentId);
    if (!attachment || attachment.projectId !== req.params.id) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const fullPath = path.join(UPLOADS_DIR, attachment.filePath);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'File not found on server disk' });
      return;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
    res.setHeader('Content-Type', attachment.mimetype);
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// 9. Get Project Attachments list
app.get('/api/projects/:id/attachments', requireAuth, async (req, res) => {
  const projectId = req.params.id;
  try {
    const attachments = await db.listAttachments(projectId);
    res.json(attachments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve attachments list' });
  }
});

// 9.5. Delete Attachment
app.delete('/api/projects/:id/attachments/:attachmentId', requireAuth, async (req, res) => {
  const { id: projectId, attachmentId } = req.params;
  const user = (req as any).user as User;

  try {
    const attachment = await db.getAttachment(attachmentId);
    if (!attachment || attachment.projectId !== projectId) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    // Attempt to delete file from disk
    const fullPath = path.join(UPLOADS_DIR, attachment.filePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error('Failed to delete file from disk:', err);
      }
    }

    await db.deleteAttachment(attachmentId);

    // Add Audit Log
    await db.addAuditLog({
      id: generateUUID(),
      projectId,
      stageId: attachment.stageId,
      userId: user.id,
      userName: user.name,
      action: 'Proceed',
      details: `Removed file '${attachment.filename}' from Stage ${attachment.stageId}.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// 10. Get Audit Log History
app.get('/api/projects/:id/history', requireAuth, async (req, res) => {
  const projectId = req.params.id;
  try {
    const logs = await db.listAuditLogs(projectId);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

// 11. Dashboard / Reports Summary
app.get('/api/dashboard/summary', requireAuth, async (req, res) => {
  const user = (req as any).user as User;
  try {
    const summary = await db.getAnalyticsSummary(user.id);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// ---------------------- Vite Development/Production Server ----------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Packaging Hub Server running on http://localhost:${PORT}`);
  });
}

startServer();
