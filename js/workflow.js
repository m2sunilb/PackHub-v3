import { ApiService } from './api.js';
import { AppState, AppController } from './app.js';
import { ValidationService } from './validation.js';

export const WorkflowModule = {
  activePhase: 1, // 1 to 4
  activeStageId: 1, // 1 to 15
  attachments: [], // Current stage attachments

  init() {
    // Phase Stepper Button Listeners
    for (let i = 1; i <= 4; i++) {
      const btn = document.getElementById(`phase-btn-${i}`);
      if (btn) {
        btn.addEventListener('click', () => {
          this.switchPhase(i);
        });
      }
    }

    // Previous / Next Button Listeners
    document.getElementById('btn-wf-prev').addEventListener('click', () => {
      this.navigatePrevious();
    });

    document.getElementById('btn-wf-next').addEventListener('click', () => {
      this.navigateNext();
    });

    // View Audit History button
    document.getElementById('btn-wf-view-history').addEventListener('click', () => {
      AppController.switchScreen('history');
    });

    // History screen Back button
    document.getElementById('btn-history-back').addEventListener('click', () => {
      AppController.switchScreen('workflow');
    });

    // Universal Status Clicks
    document.getElementById('btn-status-proceed').addEventListener('click', () => {
      this.submitStageStatus('Green');
    });

    document.getElementById('btn-status-hold').addEventListener('click', () => {
      // Toggle Hold reason container
      const reasonContainer = document.getElementById('hold-reason-container');
      reasonContainer.classList.remove('hidden');
    });

    document.getElementById('btn-status-na').addEventListener('click', () => {
      this.submitStageStatus('Gray');
    });

    // Save hold reason click
    document.getElementById('btn-save-hold-reason').addEventListener('click', () => {
      const reasonInput = document.getElementById('hold-reason-input');
      const reason = reasonInput.value.trim();
      if (!reason) {
        alert('Reason is mandatory when placing a stage On Hold.');
        return;
      }
      this.submitStageStatus('Amber', reason);
    });

    // Handle file upload
    const fileInput = document.getElementById('stage-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          this.uploadFile(file);
        }
      });
    }

    // Drag-and-drop file upload
    const uploaderBox = document.getElementById('attachment-uploader-box');
    if (uploaderBox) {
      ['dragenter', 'dragover'].forEach(eventName => {
        uploaderBox.addEventListener(eventName, e => {
          e.preventDefault();
          uploaderBox.classList.add('border-indigo-600', 'bg-indigo-50/50');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        uploaderBox.addEventListener(eventName, e => {
          e.preventDefault();
          uploaderBox.classList.remove('border-indigo-600', 'bg-indigo-50/50');
        }, false);
      });

      uploaderBox.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        if (file) {
          this.uploadFile(file);
        }
      });
    }
  },

  switchPhase(phaseNum) {
    this.activePhase = phaseNum;

    // Toggle horizontal style
    for (let i = 1; i <= 4; i++) {
      const btn = document.getElementById(`phase-btn-${i}`);
      if (btn) {
        if (i === phaseNum) {
          btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-sm');
          btn.classList.remove('text-slate-400', 'bg-slate-50');
        } else {
          btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-sm');
          btn.classList.add('text-slate-400');
        }
      }
    }

    // Render left stages list for this phase
    this.renderPhaseStagesList();
  },

  renderPhaseStagesList() {
    const listContainer = document.getElementById('phase-stages-list');
    if (!listContainer) return;

    const project = AppState.currentProject;
    if (!project) return;

    // Define stage ranges per phase
    const phaseRanges = {
      1: [1, 2, 3],
      2: [4, 5, 6],
      3: [7, 8, 9, 10, 11, 12],
      4: [13, 14, 15],
    };

    const stageNames = [
      '',
      'Marketing Brief',
      'Technical Brief',
      'Start Gate',
      'Idea Generation',
      'Idea Screening',
      'Develop Gate',
      'Design & Prototype',
      'Concept Design Lock',
      'Pilot Tool Creation',
      'Pilot & Testing',
      'Feasibility & Validation',
      'Launch Lock Gate',
      'Product Design Lock',
      'Launch Lock',
      'Scale-up & Implementation',
    ];

    const range = phaseRanges[this.activePhase];

    listContainer.innerHTML = range
      .map(s => {
        const stage = project.stages[s];
        const status = stage ? stage.status : 'White';
        const isActive = s === this.activeStageId;

        // Is locked (cannot click future stages beyond current project stage)
        const isLocked = s > project.currentStage;

        // Colors
        let dotColor = 'border border-slate-300 bg-white';
        if (status === 'Green') dotColor = 'bg-green-500';
        else if (status === 'Amber') dotColor = 'bg-amber-500';
        else if (status === 'Gray') dotColor = 'bg-slate-400';

        let btnClass = isActive
          ? 'bg-slate-100 text-slate-950 font-bold border-l-4 border-indigo-600 pl-3'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900';

        if (isLocked) {
          btnClass = 'text-slate-300 cursor-not-allowed';
        }

        return `
        <button 
          ${isLocked ? 'disabled' : ''} 
          data-stage-btn="${s}"
          class="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${btnClass}"
        >
          <span class="h-2.5 w-2.5 rounded-full ${dotColor} flex-shrink-0"></span>
          <span class="truncate flex-1">${s}. ${stageNames[s]}</span>
          ${isLocked ? '<i data-lucide="lock" class="h-3 w-3 text-slate-300"></i>' : ''}
        </button>
      `;
      })
      .join('');

    // Click listeners to load a specific stage
    listContainer.querySelectorAll('[data-stage-btn]').forEach(btn => {
      btn.addEventListener('click', e => {
        const s = parseInt(e.currentTarget.getAttribute('data-stage-btn'), 10);
        this.loadStage(s);
      });
    });

    lucide.createIcons();
  },

  async loadProjectWorkflow(projectId) {
    try {
      const project = await ApiService.getProject(projectId);
      AppState.currentProject = project;

      // Update static page details
      document.getElementById('wf-project-name').innerText = project.name;
      
      const typeBadge = document.getElementById('wf-badge-type');
      typeBadge.innerText = project.type;
      typeBadge.className = 'inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset uppercase tracking-wider';
      if (project.type === 'Innovation') {
        typeBadge.classList.add('bg-indigo-400/10', 'text-indigo-400', 'ring-indigo-400/20');
      } else if (project.type === 'Renovation') {
        typeBadge.classList.add('bg-emerald-400/10', 'text-emerald-400', 'ring-emerald-400/20');
      } else if (project.type === '5S') {
        typeBadge.classList.add('bg-amber-400/10', 'text-amber-400', 'ring-amber-400/20');
      } else {
        typeBadge.classList.add('bg-purple-400/10', 'text-purple-400', 'ring-purple-400/20');
      }

      document.getElementById('wf-badge-category').innerText = project.category;
      document.getElementById('wf-badge-country').innerText = project.country;

      let contributorList = project.contributors.join(', ') || 'None';
      const start = project.startDate ? new Date(project.startDate) : new Date(project.createdAt);
      const startStr = start.toLocaleDateString();
      const endStr = project.endDate ? new Date(project.endDate).toLocaleDateString() : '—';
      document.getElementById(
        'wf-project-owner-meta'
      ).innerHTML = `Owner: ${project.ownerName} | Contributors: ${contributorList} <span class="mx-2 text-slate-600">|</span> Start Date: <b class="text-slate-300 font-semibold">${startStr}</b> <span class="mx-2 text-slate-600">|</span> End Date: <b class="text-slate-300 font-semibold">${endStr}</b>`;

      // Update overall status badge
      const overallStatusBadge = document.getElementById('wf-overall-status');
      overallStatusBadge.innerText = project.status;
      overallStatusBadge.className = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset';

      if (project.status === 'Completed') {
        overallStatusBadge.classList.add('bg-green-50', 'text-green-700', 'ring-green-600/20');
      } else if (project.status === 'On Hold') {
        overallStatusBadge.classList.add('bg-amber-50', 'text-amber-700', 'ring-amber-600/20');
      } else {
        overallStatusBadge.classList.add('bg-blue-50', 'text-blue-700', 'ring-blue-600/20');
      }

      // Auto-focus on current progress stage
      this.activeStageId = project.currentStage;

      // Determine phase from activeStageId
      if (this.activeStageId <= 3) this.activePhase = 1;
      else if (this.activeStageId <= 6) this.activePhase = 2;
      else if (this.activeStageId <= 12) this.activePhase = 3;
      else this.activePhase = 4;

      // Reset horizontal tabs
      this.switchPhase(this.activePhase);

      // Load active stage content
      await this.loadStage(this.activeStageId);
    } catch (e) {
      console.error('Error loading project workflow:', e);
    }
  },

  async loadStage(stageId) {
    this.activeStageId = stageId;

    // Refresh vertical phase stage indicators
    this.renderPhaseStagesList();

    // Get current stage requirements
    const project = AppState.currentProject;
    const stage = project.stages[stageId];
    const status = stage ? stage.status : 'White';

    // Update headers
    document.getElementById('active-stage-label').innerText = `Stage ${stageId} of 15`;

    const stageNames = [
      '',
      'Marketing Brief',
      'Technical Brief',
      'Start Gate Decision',
      'Idea Generation Phase',
      'Idea Screening Phase',
      'Develop Gate Decision',
      'Design & Prototype Development',
      'Concept Design Lock',
      'Pilot Tool Creation',
      'Pilot & Testing',
      'Feasibility & Validation',
      'Launch Lock Gate',
      'Product Design Lock',
      'Launch Lock Process',
      'Scale-up & Implementation',
    ];
    document.getElementById('active-stage-name').innerText = stageNames[stageId];

    // Status badge rendering
    const badge = document.getElementById('active-stage-status-badge');
    badge.className = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold';
    let dotHTML = '';

    if (status === 'Green') {
      badge.classList.add('bg-green-50', 'text-green-700', 'ring-1', 'ring-green-600/20');
      dotHTML = '<span class="h-2 w-2 rounded-full bg-green-500"></span>Completed';
    } else if (status === 'Amber') {
      badge.classList.add('bg-amber-50', 'text-amber-700', 'ring-1', 'ring-amber-600/20');
      dotHTML = '<span class="h-2 w-2 rounded-full bg-amber-500"></span>WIP / On Hold';
    } else if (status === 'Gray') {
      badge.classList.add('bg-slate-50', 'text-slate-600', 'ring-1', 'ring-slate-500/10');
      dotHTML = '<span class="h-2 w-2 rounded-full bg-slate-400"></span>Not Applicable';
    } else {
      badge.classList.add('bg-slate-50', 'text-slate-500', 'ring-1', 'ring-slate-500/10');
      dotHTML = '<span class="h-2 w-2 rounded-full border border-slate-300 bg-white"></span>Not Started';
    }
    badge.innerHTML = dotHTML;

    // Reset hold reason bar
    document.getElementById('hold-reason-container').classList.add('hidden');
    document.getElementById('hold-reason-input').value = '';

    // Show Not Applicable button for all stages
    const naBtn = document.getElementById('btn-status-na');
    if (naBtn) {
      naBtn.classList.remove('hidden');
    }

    // Enable/Disable next/previous navigations
    document.getElementById('btn-wf-prev').disabled = stageId === 1;

    // Next is enabled if the current stage is Green/Gray, OR if user has already passed this stage!
    // In stage 15, if status is 'Green' (Completed), 'Gray' (Not Applicable) or 'Amber' (On Hold), next button is enabled.
    let isNextEnabled = status === 'Green' || status === 'Gray' || (stageId < project.currentStage);
    if (stageId === 15) {
      isNextEnabled = status === 'Green' || status === 'Gray' || status === 'Amber';
    }
    document.getElementById('btn-wf-next').disabled = !isNextEnabled;

    // Per user request, allow changes at any time even after crossing stage 15 / completing project
    const isLocked = false;

    // Render Stage-specific Q&A fields
    this.renderStageFields(stageId, stage, isLocked);

    // Load Attachments list
    await this.loadAttachments();
  },

  renderStageFields(stageId, stage, isLocked) {
    const qaArea = document.getElementById('active-stage-qa-area');
    if (!qaArea) return;

    const project = AppState.currentProject;
    const reqs = ValidationService.getStageRequirements(stageId, project.type);
    const answers = stage?.answers || {};

    let html = '';

    // Draw training document helper info if named tool applies
    const trainingDocsSim = (toolName) => {
      return `
        <div class="mt-2 text-xs flex items-center gap-1 bg-indigo-50/50 text-indigo-700 p-2 rounded-lg border border-indigo-100">
          <i data-lucide="info" class="h-3.5 w-3.5"></i>
          <span>Desire Lab Training Link: 
            <a href="#training-link-placeholder" class="underline font-bold hover:text-indigo-900" onclick="alert('Simulation: Navigating to ${toolName} technical specification / guidelines. Real URL gets wired here.')">${toolName} Documentation</a>
          </span>
        </div>
      `;
    };

    switch (reqs.type) {
      case 'choice_upload_reason': {
        const hasBrief = answers.hasBrief !== undefined ? answers.hasBrief : '';
        const reason = answers.reason || '';

        html = `
          <div class="space-y-4">
            <p class="text-sm font-semibold text-slate-700">${reqs.question}</p>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="hasBrief" value="Yes" ${hasBrief === 'Yes' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                Yes (File upload required)
              </label>
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="hasBrief" value="No" ${hasBrief === 'No' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                No (Reason description required)
              </label>
            </div>

            <!-- Conditional upload hint -->
            <div id="brief-upload-msg" class="hidden text-xs text-green-600 bg-green-50 p-2.5 rounded-xl border border-green-100 flex items-center gap-1.5">
              <i data-lucide="info" class="h-4 w-4"></i>
              <span>Excellent. Please attach the brief document in the attachments uploader below.</span>
            </div>

            <!-- Conditional reason textbox -->
            <div id="brief-reason-box" class="hidden space-y-2">
              <label for="brief-no-reason" class="block text-xs font-semibold text-slate-700">Mandatory Reason *</label>
              <textarea 
                id="brief-no-reason" 
                rows="3" 
                ${isLocked ? 'disabled' : ''}
                placeholder="Explain why the Packaging Brief is missing..."
                class="block w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
              >${reason}</textarea>
            </div>
          </div>
        `;
        break;
      }
      case 'gate': {
        const isCompleted = answers.isCompleted === 'Yes';
        html = `
          <div class="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h4 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <i data-lucide="shield-alert" class="h-5 w-5 text-indigo-600"></i>
              <span>Gate Sign-off Checkpoint</span>
            </h4>
            <p class="text-sm text-slate-600">${reqs.question}</p>
            <label class="flex items-center gap-2.5 text-sm font-bold text-slate-800 bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" id="gate-completion" ${isCompleted ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Yes, this stage has been fully reviewed and signed off by the leadership gatekeepers.</span>
            </label>
            <p class="text-xs text-slate-400">Note: The "Proceed" option will only unlock after you select the checkpoint above.</p>
          </div>
        `;
        break;
      }
      case 'idea_generation': {
        const method = answers.method || '';
        const digitalTool = answers.digitalTool || '';

        html = `
          <div class="space-y-4">
            <p class="text-sm font-semibold text-slate-700">${reqs.question}</p>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="idea-method" value="Digital" ${method === 'Digital' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                Digital Innovation Sourcing
              </label>
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="idea-method" value="Traditional" ${method === 'Traditional' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                Traditional Sourcing
              </label>
            </div>

            <!-- Digital Sub-questions -->
            <div id="idea-digital-box" class="hidden space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
              <div>
                <label for="idea-tool" class="block text-xs font-bold text-slate-700">Select Digital Sourcing Tool *</label>
                <select id="idea-tool" ${isLocked ? 'disabled' : ''} class="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 sm:text-sm">
                  <option value="" disabled ${!digitalTool ? 'selected' : ''}>Select platform</option>
                  <option value="Convotrack" ${digitalTool === 'Convotrack' ? 'selected' : ''}>Convotrack Sourcing</option>
                  <option value="Vurvey" ${digitalTool === 'Vurvey' ? 'selected' : ''}>Vurvey Insight Builder</option>
                  <option value="Both" ${digitalTool === 'Both' ? 'selected' : ''}>Both Platforms</option>
                </select>
              </div>
              <div class="space-y-2">
                ${trainingDocsSim('Convotrack')}
                ${trainingDocsSim('Vurvey')}
              </div>
              <p class="text-xs text-indigo-600 font-semibold bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 flex items-center gap-1.5">
                <i data-lucide="check-circle" class="h-4 w-4"></i>
                <span>Once insights are generated using these tools, attach the document below.</span>
              </p>
            </div>

            <!-- Traditional Sourcing Sub-questions -->
            <div id="idea-traditional-box" class="hidden text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100 flex items-center gap-1.5">
              <i data-lucide="info" class="h-4 w-4"></i>
              <span>Traditional method: Uploading the Project Brief document is mandatory.</span>
            </div>
          </div>
        `;
        break;
      }
      case 'idea_screening': {
        const method = answers.method || '';
        const digitalTool = answers.digitalTool || '';

        html = `
          <div class="space-y-4">
            <p class="text-sm font-semibold text-slate-700">${reqs.question}</p>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="screen-method" value="Digital" ${method === 'Digital' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                Digital Screening
              </label>
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="screen-method" value="Traditional" ${method === 'Traditional' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                Traditional Screening
              </label>
            </div>

            <!-- Digital Sub-questions -->
            <div id="screen-digital-box" class="hidden space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
              <div>
                <label for="screen-tool" class="block text-xs font-bold text-slate-700">Select Digital Screening Tool *</label>
                <select id="screen-tool" ${isLocked ? 'disabled' : ''} class="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 shadow-sm sm:text-sm">
                  <option value="" disabled ${!digitalTool ? 'selected' : ''}>Select tool</option>
                  <option value="Boltchat" ${digitalTool === 'Boltchat' ? 'selected' : ''}>Boltchat AI Screener</option>
                  <option value="PactInsta AI" ${digitalTool === 'PactInsta AI' ? 'selected' : ''}>PactInsta AI Visual Evaluator</option>
                  <option value="Both" ${digitalTool === 'Both' ? 'selected' : ''}>Both Systems</option>
                </select>
              </div>
              
              <div class="space-y-2">
                ${trainingDocsSim('Boltchat')}
                ${trainingDocsSim('PactInsta AI')}
              </div>

              <p class="text-xs text-indigo-600 font-semibold bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 flex items-center gap-1.5">
                <i data-lucide="info" class="h-4 w-4"></i>
                <span>The Digital tools are brief based, please reach out to your respective CMI counterparts to use these tools. Attach results below.</span>
              </p>
            </div>

            <!-- Traditional Screening -->
            <div id="screen-traditional-box" class="hidden text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100 flex items-center gap-1.5">
              <i data-lucide="info" class="h-4 w-4"></i>
              <span>Traditional method: Uploading the Project Brief document is mandatory.</span>
            </div>
          </div>
        `;
        break;
      }
      case 'design_prototype': {
        const method = answers.method || '';
        const designSubMethod = answers.designSubMethod || '';
        const hasUsedPrototyping = answers.hasUsedPrototyping || '';
        const prototypingReason = answers.prototypingReason || '';
        const hasMade3D = answers.hasMade3D || '';
        const print3DReason = answers.print3DReason || '';

        html = `
          <div class="space-y-6">
            <!-- Part 1: How do you want to proceed? -->
            <div class="space-y-3">
              <p class="text-sm font-semibold text-slate-700">How do you want to proceed?</p>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="radio" name="design-method" value="Explore" ${method === 'Explore' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                  Explore existing design
                </label>
                <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="radio" name="design-method" value="Create" ${method === 'Create' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                  Create new one
                </label>
              </div>
            </div>

            <!-- Explore design message -->
            <div id="design-explore-msg" class="hidden text-sm bg-indigo-50 border border-indigo-150 p-4 rounded-xl text-indigo-700 font-semibold flex items-center gap-2">
              <i data-lucide="sparkles" class="h-5 w-5"></i>
              <span>Use Unilever Pack studio to look for existing pack designs</span>
            </div>

            <!-- Create design forms -->
            <div id="design-create-form" class="hidden space-y-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <!-- Sub-question: How do you want to proceed -->
              <div class="space-y-3">
                <p class="text-sm font-semibold text-slate-700">How do you want to proceed</p>
                <div class="space-y-2">
                  <label class="flex items-start gap-2 text-sm font-medium text-slate-700">
                    <input type="radio" name="design-sub-method" value="2D" ${designSubMethod === '2D' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="mt-1 h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                    <span>Create 2D inspiration through UCA / Adobe firefly in Desire Lab, Mumbai</span>
                  </label>
                  <label class="flex items-start gap-2 text-sm font-medium text-slate-700">
                    <input type="radio" name="design-sub-method" value="3D" ${designSubMethod === '3D' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="mt-1 h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                    <span>Create 3D design from inspiration using Kaedim</span>
                  </label>
                </div>
              </div>

              <!-- Question 1 -->
              <div class="space-y-3 border-t border-slate-200 pt-4">
                <p class="text-sm font-semibold text-slate-700">Have you used the prototyping tools mentioned above? *</p>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="radio" name="proto-used" value="Yes" ${hasUsedPrototyping === 'Yes' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                    Yes – attach the pictures
                  </label>
                  <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="radio" name="proto-used" value="No" ${hasUsedPrototyping === 'No' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                    No – Free text for reason
                  </label>
                </div>
                <div id="proto-yes-msg" class="hidden text-xs text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg flex items-center gap-2 animate-fade-in">
                  <i data-lucide="image" class="h-4 w-4"></i>
                  <span>Please attach the pictures using the attachment uploader below.</span>
                </div>
                <div id="proto-reason-box" class="hidden mt-2">
                  <textarea id="proto-reason" rows="2" placeholder="Free text for reason..." ${isLocked ? 'disabled' : ''} class="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500">${prototypingReason}</textarea>
                </div>
              </div>

              <!-- Question 2 -->
              <div class="space-y-3 border-t border-slate-200 pt-4">
                <p class="text-sm font-semibold text-slate-700">Following the Digital 3D design, Have you made 3D prototype using 3D printing capability available in Desire Lab? *</p>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="radio" name="print-3d" value="Yes" ${hasMade3D === 'Yes' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                    Yes – attach the pictures
                  </label>
                  <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="radio" name="print-3d" value="No" ${hasMade3D === 'No' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                    No – Free text for reason
                  </label>
                </div>
                <div id="print-yes-msg" class="hidden text-xs text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg flex items-center gap-2 animate-fade-in">
                  <i data-lucide="image" class="h-4 w-4"></i>
                  <span>Please attach the pictures using the attachment uploader below.</span>
                </div>
                <div id="print-reason-box" class="hidden mt-2">
                  <textarea id="print-reason" rows="2" placeholder="Free text for reason..." ${isLocked ? 'disabled' : ''} class="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500">${print3DReason}</textarea>
                </div>
              </div>
            </div>
          </div>
        `;
        break;
      }
      case 'pilot_tool': {
        const hasInitiated = answers.hasInitiated || '';
        const readyDate = answers.readyDate || '';
        const reason = answers.reason || '';

        html = `
          <div class="space-y-4">
            <p class="text-sm font-semibold text-slate-700">${reqs.question}</p>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="pilot-init" value="Yes" ${hasInitiated === 'Yes' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                Yes
              </label>
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="pilot-init" value="No" ${hasInitiated === 'No' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                No
              </label>
            </div>

            <!-- If Yes -> date picker -->
            <div id="pilot-yes-box" class="hidden space-y-2">
              <label for="pilot-date" class="block text-xs font-bold text-slate-700">When will the pilot tool be ready for testing and validation? *</label>
              <input type="date" id="pilot-date" value="${readyDate}" ${isLocked ? 'disabled' : ''} class="block w-full max-w-xs rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900" />
            </div>

            <!-- If No -> reason text box -->
            <div id="pilot-no-box" class="hidden space-y-2">
              <label for="pilot-reason" class="block text-xs font-bold text-slate-700">Mandatory Reason *</label>
              <textarea id="pilot-reason" rows="3" placeholder="Provide reason why pilot tooling hasn't been initiated..." ${isLocked ? 'disabled' : ''} class="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm">${reason}</textarea>
            </div>
          </div>
        `;
        break;
      }
      case 'pilot_testing': {
        const needsTesting = answers.needsTesting || '';
        const reason = answers.reason || '';

        html = `
          <div class="space-y-4">
            <p class="text-sm font-semibold text-slate-700">${reqs.question}</p>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="pilot-test" value="Yes" ${needsTesting === 'Yes' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                Yes (File upload required)
              </label>
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="pilot-test" value="No" ${needsTesting === 'No' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                No (Reason required)
              </label>
            </div>

            <!-- If Yes -> instruction & links -->
            <div id="pilot-test-yes-box" class="hidden space-y-2 text-xs text-indigo-600 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
              <p class="font-bold">Instructions:</p>
              <p>Use MCA to Qualify your Rigid component. Make sure you attach the test validation sheet.</p>
              ${trainingDocsSim('MCA')}
            </div>

            <!-- If No -> reason text box -->
            <div id="pilot-test-no-box" class="hidden space-y-2">
              <label for="pilot-test-reason" class="block text-xs font-bold text-slate-700">Mandatory Reason *</label>
              <textarea id="pilot-test-reason" rows="3" placeholder="Explain why rigid test verification is not required..." ${isLocked ? 'disabled' : ''} class="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm">${reason}</textarea>
            </div>
          </div>
        `;
        break;
      }
      case 'feasibility_validation': {
        const needsFeasibility = answers.needsFeasibility || '';
        const validationMethod = answers.validationMethod || '';
        const hasPhysicallyValidated = answers.hasPhysicallyValidated || '';
        const physicalReason = answers.physicalReason || '';
        const reason = answers.reason || '';

        html = `
          <div class="space-y-4">
            <p class="text-sm font-semibold text-slate-700">${reqs.question}</p>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="feasibility-needed" value="Yes" ${needsFeasibility === 'Yes' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                Yes
              </label>
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="radio" name="feasibility-needed" value="No" ${needsFeasibility === 'No' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                No (Reason required)
              </label>
            </div>

            <!-- If Yes options -->
            <div id="feasibility-yes-box" class="hidden space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <p class="text-xs font-bold text-slate-700">How do you want to validate your design? *</p>
                <div class="flex gap-4 mt-2">
                  <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="radio" name="validate-method" value="Digital" ${validationMethod === 'Digital' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                    Digital Simulation
                  </label>
                  <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="radio" name="validate-method" value="Physical" ${validationMethod === 'Physical' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                    Physical Testing
                  </label>
                </div>
              </div>

              <!-- Digital Option -->
              <div id="validate-digital-box" class="hidden space-y-2 text-xs text-indigo-600 bg-indigo-50/50 p-3 rounded-xl border border-indigo-150">
                <p class="font-bold flex items-center gap-1"><i data-lucide="info" class="h-4 w-4"></i> 3DX Virtual Validation:</p>
                <p>Use 3DX Simulator to validate your design virtually. Reach out to Pack Excellence Digital lead.</p>
                ${trainingDocsSim('3DX Simulator')}
              </div>

              <!-- Physical Option -->
              <div id="validate-physical-box" class="hidden space-y-3 pt-3 border-t border-slate-200">
                <p class="text-sm font-semibold text-slate-700">Have you validated the design physically? *</p>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="radio" name="phys-val" value="Yes" ${hasPhysicallyValidated === 'Yes' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                    Yes (Attach test sheets)
                  </label>
                  <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="radio" name="phys-val" value="No" ${hasPhysicallyValidated === 'No' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                    No (Provide reason)
                  </label>
                </div>
                <p class="text-xs text-slate-400 font-medium">Make sure you capture all the test data in the appropriate digital tools i.e. LIMS or ELN.</p>
                <div id="phys-reason-box" class="hidden mt-2">
                  <textarea id="phys-reason" rows="2" placeholder="Explain why physical verification was not finalized..." ${isLocked ? 'disabled' : ''} class="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm"></textarea>
                </div>
              </div>
            </div>

            <!-- If No -> overall reason textbox -->
            <div id="feasibility-no-box" class="hidden space-y-2">
              <label for="feasibility-reason" class="block text-xs font-bold text-slate-700">Reason for skipping Feasibility Check *</label>
              <textarea id="feasibility-reason" rows="3" placeholder="Provide details..." ${isLocked ? 'disabled' : ''} class="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm">${reason}</textarea>
            </div>
          </div>
        `;
        break;
      }
      case 'gate_upload': {
        const isCompleted = answers.isCompleted === 'Yes';
        html = `
          <div class="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h4 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <i data-lucide="shield-check" class="h-5 w-5 text-indigo-600"></i>
              <span>Gate Sign-off Checkpoint & Attachments</span>
            </h4>
            <p class="text-sm text-slate-600">${reqs.question}</p>
            <label class="flex items-center gap-2.5 text-sm font-bold text-slate-800 bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" id="gate-completion" ${isCompleted ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Yes, Product / Launch Lock requirements are complete.</span>
            </label>
            <p class="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100 flex items-center gap-1.5 mt-2">
              <i data-lucide="alert-circle" class="h-4 w-4"></i>
              <span>Mandatory: Attach PDL sample pictures/documentation below to activate the "Proceed" option.</span>
            </p>
          </div>
        `;
        break;
      }
      case 'scale_up': {
        const hasDoneMPT = answers.hasDoneMPT || '';
        const mptReason = answers.mptReason || '';
        const isAWSChecked = answers.isAWSChecked === 'Yes';
        const launchTimeline = answers.launchTimeline || '';
        const workflowFieldVal = answers.workflowFieldVal || '';
        const finalSubmissionChecked = answers.finalSubmissionChecked === 'Yes';
        const proceedClicked = answers.mptDecisionProceed === 'Yes';

        const is5S = project.type === '5S';

        html = `
          <div class="space-y-6">
            <!-- Question 1: Have you done the MPT -->
            <div class="space-y-3">
              <p class="text-sm font-semibold text-slate-700">Have you done the Manufacturing Trial (MPT)? *</p>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="radio" name="mpt-done" value="Yes" ${hasDoneMPT === 'Yes' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                  Yes (Attach report below)
                </label>
                <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="radio" name="mpt-done" value="No" ${hasDoneMPT === 'No' ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-4 w-4 text-indigo-600 border-slate-300" />
                  No (Provide reason)
                </label>
              </div>
              <div id="mpt-reason-box" class="hidden mt-2">
                <textarea id="mpt-reason" rows="2" placeholder="Provide reason for not concluding the MPT trial..." ${isLocked ? 'disabled' : ''} class="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500">${mptReason}</textarea>
              </div>
            </div>

            <!-- Decision proceeding or holding buttons -->
            <div id="mpt-decisions-container" class="${hasDoneMPT ? '' : 'hidden'} flex gap-3 border-t border-slate-100 pt-4">
              <button type="button" id="btn-mpt-proceed" class="px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 cursor-pointer flex items-center gap-1.5 transition-all">
                <i data-lucide="play" class="h-4 w-4"></i>
                <span>Proceed to Final Sign-off</span>
              </button>
              <button type="button" id="btn-mpt-hold" class="px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-500 text-white shadow-sm hover:bg-amber-400 cursor-pointer flex items-center gap-1.5 transition-all">
                <i data-lucide="pause" class="h-4 w-4"></i>
                <span>Place On Hold</span>
              </button>
            </div>

            <!-- Final Agreement Container (shown if proceed is clicked or already clicked before) -->
            <div id="final-agreement-container" class="${proceedClicked ? '' : 'hidden'} space-y-6 border-t border-slate-200 pt-5 fade-in">
              <h4 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <i data-lucide="file-signature" class="h-4 w-4 text-indigo-600"></i>
                <span>Final Agreement & Sign-off</span>
              </h4>

              <!-- Optional timeline and customized project field -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="timeline-date" class="block text-xs font-bold text-slate-700">Tentative Launch Timeline (Optional)</label>
                  <input type="date" id="timeline-date" value="${launchTimeline}" ${isLocked ? 'disabled' : ''} class="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm" />
                </div>

                <div>
                  <label for="wf-custom-field" class="block text-xs font-bold text-slate-700">
                    ${is5S ? 'Saving Numbers ($) *' : 'Tentative ITO Number (Optional)'}
                  </label>
                  <input 
                    type="${is5S ? 'number' : 'text'}" 
                    id="wf-custom-field" 
                    value="${workflowFieldVal}" 
                    ${isLocked ? 'disabled' : ''}
                    placeholder="${is5S ? 'e.g. 150000' : 'e.g. ITO-45892'}" 
                    class="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500" 
                  />
                </div>
              </div>

              <!-- AWS Specification Checkbox (MANDATORY) -->
              <div class="space-y-2">
                <label class="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 cursor-pointer">
                  <input type="checkbox" id="aws-spec-check" ${isAWSChecked ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5" />
                  <div>
                    <span class="block text-sm font-bold text-slate-900">AWS Specification Sign-off *</span>
                    <span class="block text-xs text-slate-500 mt-0.5">I agree that I have created and signed off Packaging & P&P specification in Unilever AWS tool.</span>
                  </div>
                </label>
              </div>

              <!-- Final project submission checkout (Activates Submit button!) -->
              <div class="space-y-4">
                <label class="flex items-start gap-3 bg-indigo-50 p-4 rounded-xl border border-indigo-150 cursor-pointer">
                  <input type="checkbox" id="final-sub-check" ${finalSubmissionChecked ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5" />
                  <div>
                    <span class="block text-sm font-extrabold text-indigo-900">Final Gate Submission Confirmation</span>
                    <span class="block text-xs text-indigo-700 mt-0.5">Check this box to lock all stages and complete the "Packaging Hub" workflow tracker. This operation cannot be undone.</span>
                  </div>
                </label>

                <!-- Conditionally render Submit Button if scale-up is active -->
                <div id="final-submit-btn-container" class="flex justify-end pt-2">
                  <button 
                    type="button" 
                    id="btn-project-submit" 
                    disabled
                    class="bg-indigo-600 disabled:bg-indigo-300 text-white font-bold py-3 px-6 rounded-xl shadow-md text-sm cursor-pointer transition-all flex items-center gap-2"
                  >
                    <i data-lucide="check-square" class="h-5 w-5"></i>
                    <span>Submit & Finalize Project</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
        break;
      }
    }

    qaArea.innerHTML = html;

    // Manage visibility of universal-attachment-container
    const attContainer = document.getElementById('universal-attachment-container');
    if (attContainer) {
      if (stageId === 3 || stageId === 6) {
        attContainer.classList.add('hidden');
      } else if (stageId === 1 || stageId === 2 || stageId === 8) {
        if (answers.hasBrief === 'Yes') {
          attContainer.classList.remove('hidden');
        } else {
          attContainer.classList.add('hidden');
        }
      } else if (stageId === 15) {
        attContainer.classList.remove('hidden');
      } else {
        attContainer.classList.remove('hidden');
      }
    }

    // Bind sub-question visibility changes
    this.bindStageFieldsBehavior(stageId);

    // Apply isLocked styling (disabling inputs, etc.)
    if (isLocked) {
      // Hide uploader upload card
      document.getElementById('attachment-uploader-box').classList.add('hidden');
      // Hide status action buttons
      document.getElementById('universal-stage-footer').classList.add('hidden');
    } else {
      document.getElementById('attachment-uploader-box').classList.remove('hidden');
      document.getElementById('universal-stage-footer').classList.remove('hidden');
    }

    lucide.createIcons();
  },

  bindStageFieldsBehavior(stageId) {
    const project = AppState.currentProject;

    // Bind conditional behaviors based on options selection
    if (stageId === 1 || stageId === 2 || stageId === 8) {
      const radios = document.querySelectorAll('input[name="hasBrief"]');
      const uploadMsg = document.getElementById('brief-upload-msg');
      const reasonBox = document.getElementById('brief-reason-box');
      const textReason = document.getElementById('brief-no-reason');

      const updateVisibility = (val) => {
        const attContainer = document.getElementById('universal-attachment-container');
        if (val === 'Yes') {
          if (uploadMsg) uploadMsg.classList.remove('hidden');
          if (reasonBox) reasonBox.classList.add('hidden');
          if (attContainer) attContainer.classList.remove('hidden');
        } else if (val === 'No') {
          if (uploadMsg) uploadMsg.classList.add('hidden');
          if (reasonBox) reasonBox.classList.remove('hidden');
          if (attContainer) attContainer.classList.add('hidden');
        }
      };

      radios.forEach(radio => {
        radio.addEventListener('change', e => {
          updateVisibility(e.target.value);
        });
        if (radio.checked) updateVisibility(radio.value);
      });
    }

    if (stageId === 4) {
      const radios = document.querySelectorAll('input[name="idea-method"]');
      const digitalBox = document.getElementById('idea-digital-box');
      const traditionalBox = document.getElementById('idea-traditional-box');

      const updateVisibility = (val) => {
        if (val === 'Digital') {
          digitalBox.classList.remove('hidden');
          traditionalBox.classList.add('hidden');
        } else if (val === 'Traditional') {
          digitalBox.classList.add('hidden');
          traditionalBox.classList.remove('hidden');
        }
      };

      radios.forEach(radio => {
        radio.addEventListener('change', e => {
          updateVisibility(e.target.value);
        });
        if (radio.checked) updateVisibility(radio.value);
      });
    }

    if (stageId === 5) {
      const radios = document.querySelectorAll('input[name="screen-method"]');
      const digitalBox = document.getElementById('screen-digital-box');
      const traditionalBox = document.getElementById('screen-traditional-box');

      const updateVisibility = (val) => {
        if (val === 'Digital') {
          digitalBox.classList.remove('hidden');
          traditionalBox.classList.add('hidden');
        } else if (val === 'Traditional') {
          digitalBox.classList.add('hidden');
          traditionalBox.classList.remove('hidden');
        }
      };

      radios.forEach(radio => {
        radio.addEventListener('change', e => {
          updateVisibility(e.target.value);
        });
        if (radio.checked) updateVisibility(radio.value);
      });
    }

    if (stageId === 7) {
      const radios = document.querySelectorAll('input[name="design-method"]');
      const exploreMsg = document.getElementById('design-explore-msg');
      const createForm = document.getElementById('design-create-form');

      const updateVisibility = (val) => {
        if (val === 'Explore') {
          exploreMsg.classList.remove('hidden');
          createForm.classList.add('hidden');
        } else if (val === 'Create') {
          exploreMsg.classList.add('hidden');
          createForm.classList.remove('hidden');
        }
      };

      radios.forEach(radio => {
        radio.addEventListener('change', e => {
          updateVisibility(e.target.value);
        });
        if (radio.checked) updateVisibility(radio.value);
      });

      // Part B radios
      const protoRadios = document.querySelectorAll('input[name="proto-used"]');
      const protoReasonBox = document.getElementById('proto-reason-box');
      const protoYesMsg = document.getElementById('proto-yes-msg');
      protoRadios.forEach(radio => {
        radio.addEventListener('change', e => {
          if (e.target.value === 'No') {
            protoReasonBox.classList.remove('hidden');
            if (protoYesMsg) protoYesMsg.classList.add('hidden');
          } else {
            protoReasonBox.classList.add('hidden');
            if (protoYesMsg) protoYesMsg.classList.remove('hidden');
          }
        });
        if (radio.checked) {
          if (radio.value === 'No') protoReasonBox.classList.remove('hidden');
          if (radio.value === 'Yes' && protoYesMsg) protoYesMsg.classList.remove('hidden');
        }
      });

      const printRadios = document.querySelectorAll('input[name="print-3d"]');
      const printReasonBox = document.getElementById('print-reason-box');
      const printYesMsg = document.getElementById('print-yes-msg');
      printRadios.forEach(radio => {
        radio.addEventListener('change', e => {
          if (e.target.value === 'No') {
            printReasonBox.classList.remove('hidden');
            if (printYesMsg) printYesMsg.classList.add('hidden');
          } else {
            printReasonBox.classList.add('hidden');
            if (printYesMsg) printYesMsg.classList.remove('hidden');
          }
        });
        if (radio.checked) {
          if (radio.value === 'No') printReasonBox.classList.remove('hidden');
          if (radio.value === 'Yes' && printYesMsg) printYesMsg.classList.remove('hidden');
        }
      });
    }

    if (stageId === 9) {
      const radios = document.querySelectorAll('input[name="pilot-init"]');
      const yesBox = document.getElementById('pilot-yes-box');
      const noBox = document.getElementById('pilot-no-box');

      const updateVisibility = (val) => {
        if (val === 'Yes') {
          yesBox.classList.remove('hidden');
          noBox.classList.add('hidden');
        } else if (val === 'No') {
          yesBox.classList.add('hidden');
          noBox.classList.remove('hidden');
        }
      };

      radios.forEach(radio => {
        radio.addEventListener('change', e => {
          updateVisibility(e.target.value);
        });
        if (radio.checked) updateVisibility(radio.value);
      });
    }

    if (stageId === 10) {
      const radios = document.querySelectorAll('input[name="pilot-test"]');
      const yesBox = document.getElementById('pilot-test-yes-box');
      const noBox = document.getElementById('pilot-test-no-box');

      const updateVisibility = (val) => {
        if (val === 'Yes') {
          yesBox.classList.remove('hidden');
          noBox.classList.add('hidden');
        } else if (val === 'No') {
          yesBox.classList.add('hidden');
          noBox.classList.remove('hidden');
        }
      };

      radios.forEach(radio => {
        radio.addEventListener('change', e => {
          updateVisibility(e.target.value);
        });
        if (radio.checked) updateVisibility(radio.value);
      });
    }

    if (stageId === 11) {
      const radios = document.querySelectorAll('input[name="feasibility-needed"]');
      const yesBox = document.getElementById('feasibility-yes-box');
      const noBox = document.getElementById('feasibility-no-box');

      const updateVisibility = (val) => {
        if (val === 'Yes') {
          yesBox.classList.remove('hidden');
          noBox.classList.add('hidden');
        } else if (val === 'No') {
          yesBox.classList.add('hidden');
          noBox.classList.remove('hidden');
        }
      };

      radios.forEach(radio => {
        radio.addEventListener('change', e => {
          updateVisibility(e.target.value);
        });
        if (radio.checked) updateVisibility(radio.value);
      });

      // Nested validation method radios
      const methodRadios = document.querySelectorAll('input[name="validate-method"]');
      const digBox = document.getElementById('validate-digital-box');
      const physBox = document.getElementById('validate-physical-box');

      const updateMethodVisibility = (val) => {
        if (val === 'Digital') {
          digBox.classList.remove('hidden');
          physBox.classList.add('hidden');
        } else if (val === 'Physical') {
          digBox.classList.add('hidden');
          physBox.classList.remove('hidden');
        }
      };

      methodRadios.forEach(radio => {
        radio.addEventListener('change', e => {
          updateMethodVisibility(e.target.value);
        });
        if (radio.checked) updateMethodVisibility(radio.value);
      });

      // Nested physical checks
      const physRadios = document.querySelectorAll('input[name="phys-val"]');
      const physReasonBox = document.getElementById('phys-reason-box');
      physRadios.forEach(radio => {
        radio.addEventListener('change', e => {
          if (e.target.value === 'No') physReasonBox.classList.remove('hidden');
          else physReasonBox.classList.add('hidden');
        });
        if (radio.checked && radio.value === 'No') physReasonBox.classList.remove('hidden');
      });
    }

    if (stageId === 15) {
      const mptRadios = document.querySelectorAll('input[name="mpt-done"]');
      const mptReasonBox = document.getElementById('mpt-reason-box');
      const decisionsContainer = document.getElementById('mpt-decisions-container');

      const updateMPTStateVisibility = (val) => {
        if (val === 'No') {
          if (mptReasonBox) mptReasonBox.classList.remove('hidden');
        } else {
          if (mptReasonBox) mptReasonBox.classList.add('hidden');
        }
        if (val) {
          if (decisionsContainer) decisionsContainer.classList.remove('hidden');
        } else {
          if (decisionsContainer) decisionsContainer.classList.add('hidden');
        }
      };

      mptRadios.forEach(radio => {
        radio.addEventListener('change', e => {
          updateMPTStateVisibility(e.target.value);
        });
        if (radio.checked) updateMPTStateVisibility(radio.value);
      });

      // Bind Proceed / Hold actions
      const proceedBtn = document.getElementById('btn-mpt-proceed');
      const holdBtn = document.getElementById('btn-mpt-hold');

      if (proceedBtn) {
        proceedBtn.addEventListener('click', async () => {
          const answers = this.getStageQAAnswers(15);
          answers.mptDecisionProceed = 'Yes';
          
          // Persist the decision
          try {
            const currentStatus = AppState.currentProject.stages[15]?.status || 'Amber';
            const currentReason = AppState.currentProject.stages[15]?.reason || '';
            const updatedProject = await ApiService.updateProjectStage(AppState.currentProject.id, 15, {
              status: currentStatus,
              reason: currentReason,
              answers,
            });
            AppState.currentProject = updatedProject;
            
            // Re-render to show final agreement block
            this.renderStageFields(15, AppState.currentProject.stages[15], false);
          } catch (err) {
            alert('Failed to proceed: ' + err.message);
          }
        });
      }

      if (holdBtn) {
        holdBtn.addEventListener('click', () => {
          const reasonContainer = document.getElementById('hold-reason-container');
          if (reasonContainer) {
            reasonContainer.classList.remove('hidden');
            const input = document.getElementById('hold-reason-input');
            if (input) {
              input.value = "Placed on hold during Manufacturing Trial (MPT) decision point.";
              input.focus();
            }
          }
        });
      }

      // Final submission validation if elements are in DOM
      const awsCheck = document.getElementById('aws-spec-check');
      const submitCheck = document.getElementById('final-sub-check');
      const submitBtn = document.getElementById('btn-project-submit');

      if (awsCheck && submitCheck && submitBtn) {
        const validateSubmitState = () => {
          submitBtn.disabled = !(awsCheck.checked && submitCheck.checked);
        };

        awsCheck.addEventListener('change', validateSubmitState);
        submitCheck.addEventListener('change', validateSubmitState);
        validateSubmitState();

        // Handle final submit click
        submitBtn.addEventListener('click', () => {
          this.submitFinalProjectWorkflow();
        });
      }
    }
  },

  async loadAttachments() {
    const listContainer = document.getElementById('active-stage-files-list');
    if (!listContainer) return;

    try {
      const files = await ApiService.getAttachments(AppState.currentProject.id);
      this.attachments = files.filter(f => Number(f.stageId) === Number(this.activeStageId));

      if (this.attachments.length === 0) {
        listContainer.innerHTML = '<p class="text-xs text-slate-400 italic">No files uploaded for this stage.</p>';
        return;
      }

      listContainer.innerHTML = this.attachments
        .map(
          f => `
        <div class="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs">
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="file-text" class="h-4 w-4 text-slate-400 flex-shrink-0"></i>
            <span class="font-semibold text-slate-800 truncate max-w-[200px]" title="${f.filename}">${f.filename}</span>
            <span class="text-slate-400">(${(f.size / (1024 * 1024)).toFixed(2)} MB)</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-slate-400 text-[10px]">Uploaded by ${f.uploadedBy}</span>
            <a 
              href="${ApiService.getAttachmentDownloadUrl(AppState.currentProject.id, f.id)}" 
              target="_blank"
              class="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-lg transition-all"
              title="Download file"
            >
              <i data-lucide="download" class="h-3.5 w-3.5"></i>
            </a>
            <button 
              type="button"
              class="btn-delete-attachment text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center"
              data-id="${f.id}"
              title="Remove file"
            >
              <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
            </button>
          </div>
        </div>
      `
        )
        .join('');

      lucide.createIcons();

      // Bind delete handlers
      const deleteButtons = listContainer.querySelectorAll('.btn-delete-attachment');
      deleteButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const attachmentId = btn.getAttribute('data-id');
          if (confirm('Are you sure you want to remove this file?')) {
            try {
              await ApiService.deleteAttachment(AppState.currentProject.id, attachmentId);
              await this.loadAttachments();
            } catch (err) {
              alert('Failed to remove attachment: ' + err.message);
            }
          }
        });
      });
    } catch (e) {
      console.error('Failed to load attachments:', e);
    }
  },

  async uploadFile(file) {
    const check = ValidationService.validateFile(file);
    if (!check.valid) {
      alert(check.error);
      return;
    }

    try {
      await ApiService.uploadAttachment(AppState.currentProject.id, this.activeStageId, file);
      // Reload attachments list
      await this.loadAttachments();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  },

  getStageQAAnswers(stageId) {
    const project = AppState.currentProject;
    const reqs = ValidationService.getStageRequirements(stageId, project.type);
    const answers = {};

    switch (reqs.type) {
      case 'choice_upload_reason': {
        const selectedRadio = document.querySelector('input[name="hasBrief"]:checked');
        answers.hasBrief = selectedRadio ? selectedRadio.value : '';
        if (answers.hasBrief === 'No') {
          answers.reason = document.getElementById('brief-no-reason').value.trim();
        }
        break;
      }
      case 'gate': {
        const checked = document.getElementById('gate-completion').checked;
        answers.isCompleted = checked ? 'Yes' : 'No';
        break;
      }
      case 'idea_generation': {
        const selectedRadio = document.querySelector('input[name="idea-method"]:checked');
        answers.method = selectedRadio ? selectedRadio.value : '';
        if (answers.method === 'Digital') {
          answers.digitalTool = document.getElementById('idea-tool').value;
        }
        break;
      }
      case 'idea_screening': {
        const selectedRadio = document.querySelector('input[name="screen-method"]:checked');
        answers.method = selectedRadio ? selectedRadio.value : '';
        if (answers.method === 'Digital') {
          answers.digitalTool = document.getElementById('screen-tool').value;
        }
        break;
      }
      case 'design_prototype': {
        const selectedRadio = document.querySelector('input[name="design-method"]:checked');
        answers.method = selectedRadio ? selectedRadio.value : '';
        if (answers.method === 'Create') {
          const subMethodRadio = document.querySelector('input[name="design-sub-method"]:checked');
          answers.designSubMethod = subMethodRadio ? subMethodRadio.value : '';

          const protoRadio = document.querySelector('input[name="proto-used"]:checked');
          answers.hasUsedPrototyping = protoRadio ? protoRadio.value : '';
          if (answers.hasUsedPrototyping === 'No') {
            const protoReasonEl = document.getElementById('proto-reason');
            answers.prototypingReason = protoReasonEl ? protoReasonEl.value.trim() : '';
          }

          const printRadio = document.querySelector('input[name="print-3d"]:checked');
          answers.hasMade3D = printRadio ? printRadio.value : '';
          if (answers.hasMade3D === 'No') {
            const printReasonEl = document.getElementById('print-reason');
            answers.print3DReason = printReasonEl ? printReasonEl.value.trim() : '';
          }
        }
        break;
      }
      case 'pilot_tool': {
        const selectedRadio = document.querySelector('input[name="pilot-init"]:checked');
        answers.hasInitiated = selectedRadio ? selectedRadio.value : '';
        if (answers.hasInitiated === 'Yes') {
          answers.readyDate = document.getElementById('pilot-date').value;
        } else if (answers.hasInitiated === 'No') {
          answers.reason = document.getElementById('pilot-reason').value.trim();
        }
        break;
      }
      case 'pilot_testing': {
        const selectedRadio = document.querySelector('input[name="pilot-test"]:checked');
        answers.needsTesting = selectedRadio ? selectedRadio.value : '';
        if (answers.needsTesting === 'No') {
          answers.reason = document.getElementById('pilot-test-reason').value.trim();
        }
        break;
      }
      case 'feasibility_validation': {
        const selectedRadio = document.querySelector('input[name="feasibility-needed"]:checked');
        answers.needsFeasibility = selectedRadio ? selectedRadio.value : '';
        if (answers.needsFeasibility === 'Yes') {
          const methodRadio = document.querySelector('input[name="validate-method"]:checked');
          answers.validationMethod = methodRadio ? methodRadio.value : '';
          if (answers.validationMethod === 'Physical') {
            const physRadio = document.querySelector('input[name="phys-val"]:checked');
            answers.hasPhysicallyValidated = physRadio ? physRadio.value : '';
            if (answers.hasPhysicallyValidated === 'No') {
              answers.physicalReason = document.getElementById('phys-reason').value.trim();
            }
          }
        } else if (answers.needsFeasibility === 'No') {
          answers.reason = document.getElementById('feasibility-reason').value.trim();
        }
        break;
      }
      case 'gate_upload': {
        const checked = document.getElementById('gate-completion').checked;
        answers.isCompleted = checked ? 'Yes' : 'No';
        break;
      }
      case 'scale_up': {
        const mptRadio = document.querySelector('input[name="mpt-done"]:checked');
        answers.hasDoneMPT = mptRadio ? mptRadio.value : '';
        if (answers.hasDoneMPT === 'No') {
          const mptReasonEl = document.getElementById('mpt-reason');
          answers.mptReason = mptReasonEl ? mptReasonEl.value.trim() : (project.stages[15]?.answers?.mptReason || '');
        }

        // Preserve previous state of sequential buttons if already clicked
        answers.mptDecisionProceed = project.stages[15]?.answers?.mptDecisionProceed || '';

        const awsSpecEl = document.getElementById('aws-spec-check');
        answers.isAWSChecked = awsSpecEl ? (awsSpecEl.checked ? 'Yes' : 'No') : (project.stages[15]?.answers?.isAWSChecked || 'No');

        const timelineEl = document.getElementById('timeline-date');
        answers.launchTimeline = timelineEl ? timelineEl.value : (project.stages[15]?.answers?.launchTimeline || '');

        const customFieldEl = document.getElementById('wf-custom-field');
        answers.workflowFieldVal = customFieldEl ? customFieldEl.value.trim() : (project.stages[15]?.answers?.workflowFieldVal || '');

        const finalSubEl = document.getElementById('final-sub-check');
        answers.finalSubmissionChecked = finalSubEl ? (finalSubEl.checked ? 'Yes' : 'No') : (project.stages[15]?.answers?.finalSubmissionChecked || 'No');
        break;
      }
    }

    return answers;
  },

  validateStageInputs(stageId, answers) {
    const project = AppState.currentProject;
    const reqs = ValidationService.getStageRequirements(stageId, project.type);

    switch (reqs.type) {
      case 'choice_upload_reason':
        if (!answers.hasBrief) {
          return { valid: false, error: 'Please answer the mandatory packaging brief question.' };
        }
        if (answers.hasBrief === 'Yes' && this.attachments.length === 0) {
          return { valid: false, error: 'Mandatory: Please upload at least one brief document attachment.' };
        }
        if (answers.hasBrief === 'No' && !answers.reason) {
          return { valid: false, error: 'Please specify the mandatory reason for not having the brief.' };
        }
        break;
      case 'gate':
        if (answers.isCompleted !== 'Yes') {
          return { valid: false, error: 'Please confirm the leadership Gate checkpoint is signed off.' };
        }
        break;
      case 'idea_generation':
      case 'idea_screening':
        if (!answers.method) {
          return { valid: false, error: 'Please select an idea sourcing method.' };
        }
        if (answers.method === 'Digital' && !answers.digitalTool) {
          return { valid: false, error: 'Please select a digital tool.' };
        }
        if (this.attachments.length === 0) {
          return { valid: false, error: 'Mandatory: Please upload the required sourcing/brief documentation.' };
        }
        break;
      case 'design_prototype':
        if (!answers.method) {
          return { valid: false, error: 'Please select how you want to proceed.' };
        }
        if (answers.method === 'Create') {
          if (!answers.designSubMethod) {
            return { valid: false, error: 'Please select how you want to proceed under create new design.' };
          }
          if (!answers.hasUsedPrototyping) {
            return { valid: false, error: 'Please answer if you have used prototyping tools.' };
          }
          if (answers.hasUsedPrototyping === 'No' && !answers.prototypingReason) {
            return { valid: false, error: 'Please provide a reason for not using prototyping tools.' };
          }
          if (answers.hasUsedPrototyping === 'Yes' && this.attachments.length === 0) {
            return { valid: false, error: 'Mandatory: Please upload prototyping pictures.' };
          }

          if (!answers.hasMade3D) {
            return { valid: false, error: 'Please answer if you have made a 3D physical prototype.' };
          }
          if (answers.hasMade3D === 'No' && !answers.print3DReason) {
            return { valid: false, error: 'Please provide a reason for not using physical 3D prototyping.' };
          }
          if (answers.hasMade3D === 'Yes' && this.attachments.length === 0) {
            return { valid: false, error: 'Mandatory: Please attach physical prototype images.' };
          }
        }
        break;
      case 'pilot_tool':
        if (!answers.hasInitiated) {
          return { valid: false, error: 'Please answer if pilot tooling has been initiated.' };
        }
        if (answers.hasInitiated === 'Yes' && !answers.readyDate) {
          return { valid: false, error: 'Please specify the pilot tool ready date.' };
        }
        if (answers.hasInitiated === 'No' && !answers.reason) {
          return { valid: false, error: 'Please provide a reason for not initiating pilot tools.' };
        }
        break;
      case 'pilot_testing':
        if (!answers.needsTesting) {
          return { valid: false, error: 'Please specify if the pack design needs testing.' };
        }
        if (answers.needsTesting === 'Yes' && this.attachments.length === 0) {
          return { valid: false, error: 'Mandatory: Please upload the MCA Rigid Component Qualification sheet.' };
        }
        if (answers.needsTesting === 'No' && !answers.reason) {
          return { valid: false, error: 'Please provide a reason why testing was not completed.' };
        }
        break;
      case 'feasibility_validation':
        if (!answers.needsFeasibility) {
          return { valid: false, error: 'Please specify if feasibility validation is needed.' };
        }
        if (answers.needsFeasibility === 'Yes') {
          if (!answers.validationMethod) {
            return { valid: false, error: 'Please select a validation method.' };
          }
          if (answers.validationMethod === 'Physical') {
            if (!answers.hasPhysicallyValidated) {
              return { valid: false, error: 'Please specify if design has been validated physically.' };
            }
            if (answers.hasPhysicallyValidated === 'Yes' && this.attachments.length === 0) {
              return { valid: false, error: 'Mandatory: Please upload physical test reports.' };
            }
            if (answers.hasPhysicallyValidated === 'No' && !answers.physicalReason) {
              return { valid: false, error: 'Please provide physical validation skipping details.' };
            }
          }
        } else if (answers.needsFeasibility === 'No' && !answers.reason) {
          return { valid: false, error: 'Please provide a reason for skipping feasibility verification.' };
        }
        break;
      case 'gate_upload':
        if (answers.isCompleted !== 'Yes') {
          return { valid: false, error: 'Please check the gate lock checkbox.' };
        }
        if (this.attachments.length === 0) {
          return { valid: false, error: 'Mandatory: Please upload PDL sample pictures to complete this lock.' };
        }
        break;
      case 'scale_up':
        if (answers.mptDecisionProceed !== 'Yes') {
          return { valid: false, error: 'Please select "Proceed to Final Sign-off" to unlock and complete the final agreement.' };
        }
        if (!answers.hasDoneMPT) {
          return { valid: false, error: 'Please answer if Manufacturing Trials (MPT) were conducted.' };
        }
        if (answers.hasDoneMPT === 'Yes' && this.attachments.length === 0) {
          return { valid: false, error: 'Mandatory: Please attach the MPT trial report.' };
        }
        if (answers.hasDoneMPT === 'No' && !answers.mptReason) {
          return { valid: false, error: 'Please provide a reason for skipping the Manufacturing Trial.' };
        }
        if (answers.isAWSChecked !== 'Yes') {
          return { valid: false, error: 'AWS Specification creation and sign-off is mandatory.' };
        }
        if (project.type === '5S' && !answers.workflowFieldVal) {
          return { valid: false, error: 'Saving numbers is a mandatory field for 5S projects.' };
        }
        if (answers.finalSubmissionChecked !== 'Yes') {
          return { valid: false, error: 'Please verify the final submission checklist to finalize.' };
        }
        break;
    }

    return { valid: true };
  },

  async submitStageStatus(status, reason = '') {
    const project = AppState.currentProject;
    const stageId = this.activeStageId;

    if (stageId === 15 && status === 'Green') {
      await this.submitFinalProjectWorkflow();
      return;
    }

    // Get current form data
    const answers = this.getStageQAAnswers(stageId);

    // If status is Green (Proceed), run full checklists validations!
    if (status === 'Green') {
      const check = this.validateStageInputs(stageId, answers);
      if (!check.valid) {
        alert(check.error);
        return;
      }
    }

    try {
      const updatedProject = await ApiService.updateProjectStage(project.id, stageId, {
        status,
        reason,
        answers,
      });

      AppState.currentProject = updatedProject;

      // Reload/Advance stage-gate UI
      await this.loadProjectWorkflow(project.id);
    } catch (e) {
      alert('Failed to save stage status: ' + e.message);
    }
  },

  async submitFinalProjectWorkflow() {
    const project = AppState.currentProject;
    const answers = this.getStageQAAnswers(15);

    const check = this.validateStageInputs(15, answers);
    if (!check.valid) {
      alert(check.error);
      return;
    }

    // Submit stage 15 Green
    try {
      const updated = await ApiService.updateProjectStage(project.id, 15, {
        status: 'Green',
        reason: '',
        answers,
      });

      AppState.currentProject = updated;
      alert('Packaging Project Hub: Workflow successfully completed and archived!');
      AppController.switchScreen('dashboard');
    } catch (e) {
      alert('Submission failed: ' + e.message);
    }
  },

  navigatePrevious() {
    if (this.activeStageId > 1) {
      this.loadStage(this.activeStageId - 1);
    }
  },

  navigateNext() {
    if (this.activeStageId < 15) {
      this.loadStage(this.activeStageId + 1);
    } else if (this.activeStageId === 15) {
      AppController.switchScreen('dashboard');
    }
  },

  async loadProjectHistory(projectId) {
    const timeline = document.getElementById('history-audit-timeline');
    if (!timeline) return;

    try {
      const logs = await ApiService.getProjectHistory(projectId);
      document.getElementById('history-project-subtitle').innerText = `Audit logs for project: ${AppState.currentProject.name}`;

      if (logs.length === 0) {
        timeline.innerHTML = '<p class="text-slate-400 italic text-sm text-center py-8">No historical edit logs yet.</p>';
        return;
      }

      const stageNames = [
        'Setup',
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

      timeline.innerHTML = logs
        .map((log, i) => {
          let badgeColor = 'bg-gray-100 text-gray-800';
          let icon = 'edit';

          if (log.action === 'Proceed') {
            badgeColor = 'bg-green-100 text-green-800';
            icon = 'check-circle2';
          } else if (log.action === 'On Hold') {
            badgeColor = 'bg-amber-100 text-amber-800';
            icon = 'pause-circle';
          } else if (log.action === 'Not Applicable') {
            badgeColor = 'bg-slate-100 text-slate-800';
            icon = 'slash';
          } else if (log.action === 'Create') {
            badgeColor = 'bg-blue-100 text-blue-800';
            icon = 'plus-circle';
          } else if (log.action === 'Upload') {
            badgeColor = 'bg-indigo-100 text-indigo-800';
            icon = 'paperclip';
          }

          const isLast = i === logs.length - 1;

          return `
          <li>
            <div class="relative pb-8">
              ${isLast ? '' : '<span class="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>'}
              <div class="relative flex space-x-3">
                <div>
                  <span class="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white bg-slate-100 text-slate-500">
                    <i data-lucide="${icon}" class="h-4 w-4"></i>
                  </span>
                </div>
                <div class="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                  <div class="text-sm text-slate-500">
                    <span class="font-bold text-slate-900">${log.userName}</span> 
                    performed action 
                    <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${badgeColor}">${log.action}</span>
                    on <span class="font-semibold text-slate-700">${log.stageId === 0 ? 'Project Setup' : `Stage ${log.stageId} (${stageNames[log.stageId]})`}</span>
                    <p class="mt-1 text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-150">${log.details}</p>
                  </div>
                  <div class="text-right text-xs whitespace-nowrap text-slate-400">
                    <time datetime="${log.timestamp}">${new Date(log.timestamp).toLocaleString()}</time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        `;
        })
        .join('');

      lucide.createIcons();
    } catch (e) {
      console.error('Failed to load project history:', e);
    }
  },
};
