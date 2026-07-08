import { ApiService } from './api.js';
import { AppState, AppController } from './app.js';

const getProjectPhase = (stageNum) => {
  const stage = Number(stageNum);
  if (stage >= 1 && stage <= 3) return 'Pre-start';
  if (stage >= 4 && stage <= 6) return 'Explore';
  if (stage >= 7 && stage <= 12) return 'Validate';
  if (stage >= 13 && stage <= 15) return 'Execute';
  return 'Unknown';
};

export const DashboardModule = {
  init() {
    // Dashboard create project button
    const dashCreateBtn = document.getElementById('btn-dash-create');
    if (dashCreateBtn) {
      dashCreateBtn.addEventListener('click', () => {
        AppController.switchScreen('new-project');
      });
    }

    // Dashboard seed mock projects button
    const dashSeedBtn = document.getElementById('btn-dash-seed');
    if (dashSeedBtn) {
      dashSeedBtn.addEventListener('click', async () => {
        try {
          dashSeedBtn.disabled = true;
          dashSeedBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin h-4 w-4"></i><span>Seeding...</span>';
          if (window.lucide) window.lucide.createIcons();

          const result = await ApiService.request('/projects/seed', { method: 'POST' });
          alert(result.message || 'Successfully seeded 15 mock projects!');

          // Refresh the screen state
          AppController.switchScreen('dashboard');
        } catch (err) {
          console.error(err);
          alert('Error seeding projects: ' + err.message);
        } finally {
          dashSeedBtn.disabled = false;
          dashSeedBtn.innerHTML = '<i data-lucide="database" class="h-4 w-4"></i><span>Seed 15 Mock Projects</span>';
          if (window.lucide) window.lucide.createIcons();
        }
      });
    }

    const listCreateBtn = document.getElementById('btn-create-project-list');
    if (listCreateBtn) {
      listCreateBtn.addEventListener('click', () => {
        AppController.switchScreen('new-project');
      });
    }

    // Projects list filter tabs
    this.bindFilterTabs();

    // Dashboard filter tabs
    this.bindDashboardFilters();
  },

  bindFilterTabs() {
    this.activeFilters = { status: 'All', type: 'All', stage: 'All', phase: 'All' };

    const filters = {
      all: document.getElementById('project-filter-all'),
      progress: document.getElementById('project-filter-progress'),
      completed: document.getElementById('project-filter-completed'),
      hold: document.getElementById('project-filter-hold'),
      overdue: document.getElementById('project-filter-overdue'),
    };

    const typeSelect = document.getElementById('filter-type-select');
    const stageSelect = document.getElementById('filter-stage-select');
    const phaseSelect = document.getElementById('filter-phase-select');

    if (!filters.all) return;

    const resetFiltersStyle = () => {
      Object.values(filters).forEach(btn => {
        if (btn) {
          btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
          btn.classList.add('text-slate-600', 'hover:bg-slate-100');
        }
      });
    };

    const applyCombinedFilters = () => {
      const { status, type, stage, phase } = this.activeFilters;
      const filtered = AppState.projects.filter(p => {
        let matchesStatus = false;
        if (status === 'All') {
          matchesStatus = true;
        } else if (status === 'Overdue') {
          if (p.status !== 'Completed') {
            const start = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
            const now = new Date();
            const diffDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            matchesStatus = diffDays > 30;
          } else {
            matchesStatus = false;
          }
        } else {
          matchesStatus = p.status === status;
        }
        const matchesType = type === 'All' || p.type === type;
        const matchesStage = stage === 'All' || String(p.currentStage) === String(stage);
        const matchesPhase = phase === 'All' || getProjectPhase(p.currentStage) === phase;
        return matchesStatus && matchesType && matchesStage && matchesPhase;
      });
      this.renderProjectsList(filtered);
    };

    filters.all.addEventListener('click', () => {
      resetFiltersStyle();
      filters.all.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      filters.all.classList.remove('text-slate-600', 'hover:bg-slate-100');
      this.activeFilters.status = 'All';
      applyCombinedFilters();
    });

    filters.progress.addEventListener('click', () => {
      resetFiltersStyle();
      filters.progress.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      filters.progress.classList.remove('text-slate-600', 'hover:bg-slate-100');
      this.activeFilters.status = 'In Progress';
      applyCombinedFilters();
    });

    filters.completed.addEventListener('click', () => {
      resetFiltersStyle();
      filters.completed.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      filters.completed.classList.remove('text-slate-600', 'hover:bg-slate-100');
      this.activeFilters.status = 'Completed';
      applyCombinedFilters();
    });

    filters.hold.addEventListener('click', () => {
      resetFiltersStyle();
      filters.hold.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      filters.hold.classList.remove('text-slate-600', 'hover:bg-slate-100');
      this.activeFilters.status = 'On Hold';
      applyCombinedFilters();
    });

    if (filters.overdue) {
      filters.overdue.addEventListener('click', () => {
        resetFiltersStyle();
        filters.overdue.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        filters.overdue.classList.remove('text-slate-600', 'hover:bg-slate-100');
        this.activeFilters.status = 'Overdue';
        applyCombinedFilters();
      });
    }

    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.activeFilters.type = e.target.value;
        applyCombinedFilters();
      });
    }

    if (stageSelect) {
      stageSelect.addEventListener('change', (e) => {
        this.activeFilters.stage = e.target.value;
        applyCombinedFilters();
      });
    }

    if (phaseSelect) {
      phaseSelect.addEventListener('change', (e) => {
        this.activeFilters.phase = e.target.value;
        applyCombinedFilters();
      });
    }
  },

  bindDashboardFilters() {
    this.dashboardFilters = { status: 'All', type: 'All', stage: 'All', phase: 'All' };

    const filters = {
      all: document.getElementById('dash-filter-all'),
      progress: document.getElementById('dash-filter-progress'),
      completed: document.getElementById('dash-filter-completed'),
      hold: document.getElementById('dash-filter-hold'),
      overdue: document.getElementById('dash-filter-overdue'),
    };

    const typeSelect = document.getElementById('dash-filter-type-select');
    const stageSelect = document.getElementById('dash-filter-stage-select');
    const phaseSelect = document.getElementById('dash-filter-phase-select');

    if (!filters.all) return;

    const resetFiltersStyle = () => {
      Object.values(filters).forEach(btn => {
        if (btn) {
          btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
          btn.classList.add('text-slate-600', 'hover:bg-slate-100');
        }
      });
    };

    filters.all.addEventListener('click', () => {
      resetFiltersStyle();
      filters.all.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      filters.all.classList.remove('text-slate-600', 'hover:bg-slate-100');
      this.dashboardFilters.status = 'All';
      this.applyDashboardFilters();
    });

    filters.progress.addEventListener('click', () => {
      resetFiltersStyle();
      filters.progress.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      filters.progress.classList.remove('text-slate-600', 'hover:bg-slate-100');
      this.dashboardFilters.status = 'In Progress';
      this.applyDashboardFilters();
    });

    filters.completed.addEventListener('click', () => {
      resetFiltersStyle();
      filters.completed.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      filters.completed.classList.remove('text-slate-600', 'hover:bg-slate-100');
      this.dashboardFilters.status = 'Completed';
      this.applyDashboardFilters();
    });

    filters.hold.addEventListener('click', () => {
      resetFiltersStyle();
      filters.hold.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      filters.hold.classList.remove('text-slate-600', 'hover:bg-slate-100');
      this.dashboardFilters.status = 'On Hold';
      this.applyDashboardFilters();
    });

    if (filters.overdue) {
      filters.overdue.addEventListener('click', () => {
        resetFiltersStyle();
        filters.overdue.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        filters.overdue.classList.remove('text-slate-600', 'hover:bg-slate-100');
        this.dashboardFilters.status = 'Overdue';
        this.applyDashboardFilters();
      });
    }

    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.dashboardFilters.type = e.target.value;
        this.applyDashboardFilters();
      });
    }

    if (stageSelect) {
      stageSelect.addEventListener('change', (e) => {
        this.dashboardFilters.stage = e.target.value;
        this.applyDashboardFilters();
      });
    }

    if (phaseSelect) {
      phaseSelect.addEventListener('change', (e) => {
        this.dashboardFilters.phase = e.target.value;
        this.applyDashboardFilters();
      });
    }
  },

  calculateDashboardSummary(filteredProjects) {
    const now = new Date();
    const total = filteredProjects.length;
    const inProgress = filteredProjects.filter(p => p.status === 'In Progress').length;
    const completed = filteredProjects.filter(p => p.status === 'Completed').length;
    const onHold = filteredProjects.filter(p => p.status === 'On Hold').length;
    
    const overdue = filteredProjects.filter(p => {
      if (p.status === 'Completed') return false;
      const start = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
      const diffDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 30;
    }).length;

    const byType = {
      Innovation: filteredProjects.filter(p => p.type === 'Innovation').length,
      Renovation: filteredProjects.filter(p => p.type === 'Renovation').length,
      '5S': filteredProjects.filter(p => p.type === '5S').length,
      Others: filteredProjects.filter(p => p.type === 'Others').length,
    };

    return {
      stats: { total, inProgress, completed, onHold, overdue },
      byType
    };
  },

  applyDashboardFilters() {
    const { status, type, stage, phase } = this.dashboardFilters;
    const filtered = AppState.projects.filter(p => {
      let matchesStatus = false;
      if (status === 'All') {
        matchesStatus = true;
      } else if (status === 'Overdue') {
        if (p.status !== 'Completed') {
          const start = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
          const now = new Date();
          const diffDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          matchesStatus = diffDays > 30;
        } else {
          matchesStatus = false;
        }
      } else {
        matchesStatus = p.status === status;
      }
      const matchesType = type === 'All' || p.type === type;
      const matchesStage = stage === 'All' || String(p.currentStage) === String(stage);
      const matchesPhase = phase === 'All' || getProjectPhase(p.currentStage) === phase;
      return matchesStatus && matchesType && matchesStage && matchesPhase;
    });

    const summary = this.calculateDashboardSummary(filtered);

    // Update stat cards
    const elements = {
      total: document.getElementById('stat-total'),
      progress: document.getElementById('stat-progress'),
      completed: document.getElementById('stat-completed'),
      hold: document.getElementById('stat-hold'),
      overdue: document.getElementById('stat-overdue'),
      innovation: document.getElementById('label-count-innovation'),
      renovation: document.getElementById('label-count-renovation'),
      '5s': document.getElementById('label-count-5s'),
      others: document.getElementById('label-count-others'),
      barInnovation: document.getElementById('bar-width-innovation'),
      barRenovation: document.getElementById('bar-width-renovation'),
      bar5s: document.getElementById('bar-width-5s'),
      barOthers: document.getElementById('bar-width-others'),
      badge: document.getElementById('dash-projects-count-badge'),
    };

    if (elements.total) elements.total.innerText = summary.stats.total;
    if (elements.progress) elements.progress.innerText = summary.stats.inProgress;
    if (elements.completed) elements.completed.innerText = summary.stats.completed;
    if (elements.hold) elements.hold.innerText = summary.stats.onHold;
    if (elements.overdue) elements.overdue.innerText = summary.stats.overdue;

    if (elements.innovation) elements.innovation.innerText = `${summary.byType.Innovation} Projects`;
    if (elements.renovation) elements.renovation.innerText = `${summary.byType.Renovation} Projects`;
    if (elements['5s']) elements['5s'].innerText = `${summary.byType['5S']} Projects`;
    if (elements.others) elements.others.innerText = `${summary.byType.Others || 0} Projects`;

    const totalType = (summary.byType.Innovation + summary.byType.Renovation + summary.byType['5S'] + summary.byType.Others) || 1;
    if (elements.barInnovation) elements.barInnovation.style.width = `${(summary.byType.Innovation / totalType) * 100}%`;
    if (elements.barRenovation) elements.barRenovation.style.width = `${(summary.byType.Renovation / totalType) * 100}%`;
    if (elements.bar5s) elements.bar5s.style.width = `${(summary.byType['5S'] / totalType) * 100}%`;
    if (elements.barOthers) elements.barOthers.style.width = `${((summary.byType.Others || 0) / totalType) * 100}%`;

    if (elements.badge) {
      elements.badge.innerText = `Showing ${filtered.length} of ${AppState.projects.length} projects`;
    }

    // Render Donut Chart SVG
    this.renderDonutChart(summary.stats);

    // Render Phases Bar Graph
    this.renderPhasesBarGraph(filtered);

    // Render Workflow Linear Matrix
    this.renderWorkflowMatrix(filtered);
  },

  async loadDashboard(searchQuery = '') {
    try {
      const projects = await ApiService.getProjects(searchQuery);
      AppState.projects = projects;

      // Reset dashboard filter state and UI values
      this.dashboardFilters = { status: 'All', type: 'All', stage: 'All', phase: 'All' };
      const typeSelect = document.getElementById('dash-filter-type-select');
      const stageSelect = document.getElementById('dash-filter-stage-select');
      const phaseSelect = document.getElementById('dash-filter-phase-select');
      if (typeSelect) typeSelect.value = 'All';
      if (stageSelect) stageSelect.value = 'All';
      if (phaseSelect) phaseSelect.value = 'All';

      const allBtn = document.getElementById('dash-filter-all');
      if (allBtn) {
        const filters = {
          all: document.getElementById('dash-filter-all'),
          progress: document.getElementById('dash-filter-progress'),
          completed: document.getElementById('dash-filter-completed'),
          hold: document.getElementById('dash-filter-hold'),
          overdue: document.getElementById('dash-filter-overdue'),
        };
        Object.values(filters).forEach(btn => {
          if (btn) {
            btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
            btn.classList.add('text-slate-600', 'hover:bg-slate-100');
          }
        });
        allBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        allBtn.classList.remove('text-slate-600', 'hover:bg-slate-100');
      }

      this.applyDashboardFilters();
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    }
  },

  async loadProjectsList(searchQuery = '') {
    try {
      const projects = await ApiService.getProjects(searchQuery);
      AppState.projects = projects;
      this.renderProjectsList(projects);

      // Reset dropdown values and filters state
      this.activeFilters = { status: 'All', type: 'All', stage: 'All', phase: 'All' };
      const typeSelect = document.getElementById('filter-type-select');
      const stageSelect = document.getElementById('filter-stage-select');
      const phaseSelect = document.getElementById('filter-phase-select');
      if (typeSelect) typeSelect.value = 'All';
      if (stageSelect) stageSelect.value = 'All';
      if (phaseSelect) phaseSelect.value = 'All';

      // Reset filter tabs to "All"
      const allBtn = document.getElementById('project-filter-all');
      if (allBtn) {
        allBtn.click();
      }
    } catch (e) {
      console.error('Failed to load projects list:', e);
    }
  },

  renderDonutChart(stats) {
    const wrapper = document.getElementById('dashboard-donut-wrapper');
    if (!wrapper) return;

    const total = stats.total;
    if (total === 0) {
      wrapper.innerHTML = `
        <svg viewBox="0 0 176 176" class="h-[140px] w-[140px]">
          <circle cx="88" cy="88" r="60" fill="none" stroke="#f1f5f9" stroke-width="16" />
          <text x="88" y="86" text-anchor="middle" font-size="24" font-weight="800" class="fill-slate-400 font-sans">0</text>
          <text x="88" y="106" text-anchor="middle" font-size="9" font-weight="700" letter-spacing="1" class="uppercase fill-slate-400 font-sans">Projects</text>
        </svg>
      `;

      const legendContainer = document.getElementById('dashboard-donut-legend');
      if (legendContainer) {
        legendContainer.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-[#10b981] flex-shrink-0"></span>
            <span class="text-xs text-slate-500">Completed: <b class="text-slate-800 font-bold">0</b></span>
          </div>
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-[#4f46e5] flex-shrink-0"></span>
            <span class="text-xs text-slate-500">In Progress: <b class="text-slate-800 font-bold">0</b></span>
          </div>
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-[#f59e0b] flex-shrink-0"></span>
            <span class="text-xs text-slate-500">On Hold: <b class="text-slate-800 font-bold">0</b></span>
          </div>
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-[#f43f5e] flex-shrink-0"></span>
            <span class="text-xs text-slate-500">Overdue: <b class="text-slate-800 font-bold">0</b></span>
          </div>
        `;
      }
      return;
    }

    const completedPct = stats.completed / total;
    const progressPct = stats.inProgress / total;
    const holdPct = stats.onHold / total;

    const r = 60;
    const strokeWidth = 16;
    const circumference = 2 * Math.PI * r; // ~376.99

    let offset = 0;

    // Helper to generate SVG circle segment
    const makeSegment = (pct, color, title) => {
      if (pct === 0) return '';
      const dashArray = `${pct * circumference} ${circumference}`;
      const dashOffset = -offset;
      offset += pct * circumference;

      return `
        <circle 
          cx="88" cy="88" r="${r}" 
          fill="none" 
          stroke="${color}" 
          stroke-width="${strokeWidth}" 
          stroke-dasharray="${dashArray}" 
          stroke-dashoffset="${dashOffset}"
          transform="rotate(-90 88 88)"
          class="transition-all duration-500"
        >
          <title>${title}: ${Math.round(pct * 100)}%</title>
        </circle>
      `;
    };

    // Draw slices
    const segments = [
      makeSegment(completedPct, '#10b981', 'Completed'),
      makeSegment(progressPct, '#4f46e5', 'In Progress'),
      makeSegment(holdPct, '#f59e0b', 'On Hold'),
    ].filter(Boolean).join('');

    wrapper.innerHTML = `
      <svg viewBox="0 0 176 176" class="h-[140px] w-[140px]">
        <!-- Background track -->
        <circle cx="88" cy="88" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="${strokeWidth}" />
        <!-- Data Segments -->
        ${segments}
        <!-- Centered Texts -->
        <text x="88" y="86" text-anchor="middle" font-size="28" font-weight="800" class="fill-slate-800 font-sans">${total}</text>
        <text x="88" y="106" text-anchor="middle" font-size="9" font-weight="700" letter-spacing="1" class="uppercase fill-slate-400 font-sans">Active Hub</text>
      </svg>
    `;

    const legendContainer = document.getElementById('dashboard-donut-legend');
    if (legendContainer) {
      legendContainer.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-[#10b981] flex-shrink-0"></span>
          <span class="text-xs text-slate-500">Completed: <b class="text-slate-800 font-bold">${stats.completed}</b></span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-[#4f46e5] flex-shrink-0"></span>
          <span class="text-xs text-slate-500">In Progress: <b class="text-slate-800 font-bold">${stats.inProgress}</b></span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-[#f59e0b] flex-shrink-0"></span>
          <span class="text-xs text-slate-500">On Hold: <b class="text-slate-800 font-bold">${stats.onHold}</b></span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-[#f43f5e] flex-shrink-0"></span>
          <span class="text-xs text-slate-500">Overdue: <b class="text-slate-800 font-bold">${stats.overdue}</b></span>
        </div>
      `;
    }
  },

  renderPhasesBarGraph(projects) {
    const container = document.getElementById('dashboard-phases-bar-chart');
    if (!container) return;

    const prestartCount = projects.filter(p => {
      const ph = getProjectPhase(p.currentStage);
      return ph === 'Pre-start';
    }).length;

    const exploreCount = projects.filter(p => {
      const ph = getProjectPhase(p.currentStage);
      return ph === 'Explore';
    }).length;

    const validateCount = projects.filter(p => {
      const ph = getProjectPhase(p.currentStage);
      return ph === 'Validate';
    }).length;

    const executeCount = projects.filter(p => {
      const ph = getProjectPhase(p.currentStage);
      return ph === 'Execute';
    }).length;

    const totalCount = prestartCount + exploreCount + validateCount + executeCount;

    if (totalCount === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
          <i data-lucide="bar-chart-2" class="h-8 w-8 text-slate-300"></i>
          <span>No active projects in this selection.</span>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const maxCount = Math.max(prestartCount, exploreCount, validateCount, executeCount, 1);
    const getPct = (cnt) => Math.round((cnt / maxCount) * 100);

    const prestartHeight = getPct(prestartCount);
    const exploreHeight = getPct(exploreCount);
    const validateHeight = getPct(validateCount);
    const executeHeight = getPct(executeCount);

    container.innerHTML = `
      <div class="flex items-end justify-around h-44 pt-6 pb-2 px-1 gap-3">
        <!-- Pre-start Bar -->
        <div class="flex flex-col items-center flex-1">
          <span class="text-xs font-bold text-slate-700 mb-1.5">${prestartCount}</span>
          <div class="w-full max-w-[40px] bg-slate-50 hover:bg-slate-100 rounded-t-lg transition-all duration-300 flex items-end h-28 relative shadow-inner animate-fade-in" title="Pre-start Phase: ${prestartCount} projects">
            <div class="w-full bg-blue-500 rounded-t-lg transition-all duration-1000" style="height: ${prestartHeight}%"></div>
          </div>
          <span class="text-[10px] font-bold text-slate-500 mt-2 truncate w-full text-center">Pre-start</span>
          <span class="text-[9px] text-slate-400 font-medium">S1-S3</span>
        </div>

        <!-- Explore Bar -->
        <div class="flex flex-col items-center flex-1">
          <span class="text-xs font-bold text-slate-700 mb-1.5">${exploreCount}</span>
          <div class="w-full max-w-[40px] bg-slate-50 hover:bg-slate-100 rounded-t-lg transition-all duration-300 flex items-end h-28 relative shadow-inner animate-fade-in" title="Explore Phase: ${exploreCount} projects">
            <div class="w-full bg-amber-500 rounded-t-lg transition-all duration-1000" style="height: ${exploreHeight}%"></div>
          </div>
          <span class="text-[10px] font-bold text-slate-500 mt-2 truncate w-full text-center">Explore</span>
          <span class="text-[9px] text-slate-400 font-medium">S4-S6</span>
        </div>

        <!-- Validate Bar -->
        <div class="flex flex-col items-center flex-1">
          <span class="text-xs font-bold text-slate-700 mb-1.5">${validateCount}</span>
          <div class="w-full max-w-[40px] bg-slate-50 hover:bg-slate-100 rounded-t-lg transition-all duration-300 flex items-end h-28 relative shadow-inner animate-fade-in" title="Validate Phase: ${validateCount} projects">
            <div class="w-full bg-purple-500 rounded-t-lg transition-all duration-1000" style="height: ${validateHeight}%"></div>
          </div>
          <span class="text-[10px] font-bold text-slate-500 mt-2 truncate w-full text-center">Validate</span>
          <span class="text-[9px] text-slate-400 font-medium">S7-S12</span>
        </div>

        <!-- Execute Bar -->
        <div class="flex flex-col items-center flex-1">
          <span class="text-xs font-bold text-slate-700 mb-1.5">${executeCount}</span>
          <div class="w-full max-w-[40px] bg-slate-50 hover:bg-slate-100 rounded-t-lg transition-all duration-300 flex items-end h-28 relative shadow-inner animate-fade-in" title="Execute Phase: ${executeCount} projects">
            <div class="w-full bg-emerald-500 rounded-t-lg transition-all duration-1000" style="height: ${executeHeight}%"></div>
          </div>
          <span class="text-[10px] font-bold text-slate-500 mt-2 truncate w-full text-center">Execute</span>
          <span class="text-[9px] text-slate-400 font-medium">S13-S15</span>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  renderWorkflowMatrix(projects) {
    const tbody = document.getElementById('dashboard-matrix-body');
    if (!tbody) return;

    if (projects.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="18" class="text-center py-12 text-slate-400 text-sm">
            No active projects available. Create a project to start.
          </td>
        </tr>
      `;
      return;
    }

    const rowsHTML = projects
      .map(p => {
        // Construct stage status circles
        const stageCircles = [];
        for (let s = 1; s <= 15; s++) {
          const stage = p.stages[s];
          const status = stage ? stage.status : 'White';

          // Determine Tailwind color
          let colorClass = 'border border-slate-300 bg-white';
          let tooltip = `Stage ${s}: Not Started`;

          if (status === 'Green') {
            colorClass = 'bg-green-500';
            tooltip = `Stage ${s}: Completed`;
          } else if (status === 'Amber') {
            colorClass = 'bg-amber-500';
            tooltip = `Stage ${s}: WIP / On Hold`;
          } else if (status === 'Gray') {
            colorClass = 'bg-slate-400';
            tooltip = `Stage ${s}: Not Applicable`;
          }

          // Render border-left for phase grouping
          const isPhaseStart = [4, 7, 13].includes(s);
          const borderLeft = isPhaseStart ? 'border-l border-slate-200' : '';

          stageCircles.push(`
          <td class="py-3 px-1 text-center ${borderLeft}">
            <div 
              title="${tooltip}"
              class="h-3 w-3 mx-auto rounded-full ${colorClass} shadow-sm cursor-help transition-all transform hover:scale-125"
            ></div>
          </td>
        `);
        }

        let typeColor = 'bg-indigo-50 text-indigo-700';
        if (p.type === 'Renovation') typeColor = 'bg-emerald-50 text-emerald-700';
        if (p.type === '5S') typeColor = 'bg-amber-50 text-amber-700';
        if (p.type === 'Others') typeColor = 'bg-purple-50 text-purple-700';

        return `
        <tr 
          data-project-row="${p.id}"
          class="hover:bg-slate-50/50 cursor-pointer transition-all border-b border-slate-100"
        >
          <td class="py-4 px-4 font-bold text-slate-800 text-sm max-w-[180px] truncate">
            <div>${p.name}</div>
            <div class="flex gap-1.5 mt-1">
              <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold ${typeColor} uppercase">${p.type}</span>
              <span class="text-[10px] text-slate-400 font-medium">Owner: ${p.ownerName}</span>
            </div>
          </td>
          ${stageCircles.join('')}
          <td class="py-4 px-4 text-center text-xs font-semibold text-slate-600">
            <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium ring-1 ring-inset ring-slate-600/20">
              Stage ${p.currentStage}/15
            </span>
          </td>
        </tr>
      `;
      })
      .join('');

    tbody.innerHTML = rowsHTML;

    // Row clicks open project workflow
    tbody.querySelectorAll('[data-project-row]').forEach(row => {
      row.addEventListener('click', e => {
        const projectId = e.currentTarget.getAttribute('data-project-row');
        const proj = AppState.projects.find(p => p.id === projectId);
        if (proj) {
          AppState.currentProject = proj;
          AppController.switchScreen('workflow');
        }
      });
    });
  },

  renderProjectsList(projects) {
    const tbody = document.getElementById('projects-table-body');
    const badge = document.getElementById('projects-count-badge');
    if (!tbody) return;

    if (badge) {
      badge.innerText = `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} found`;
    }

    if (projects.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-12 text-slate-400 text-sm">
            No projects found matching the criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = projects
      .map(p => {
        let typeColor = 'bg-indigo-50 text-indigo-700 ring-indigo-700/10';
        if (p.type === 'Renovation') typeColor = 'bg-emerald-50 text-emerald-700 ring-emerald-600/10';
        if (p.type === '5S') typeColor = 'bg-amber-50 text-amber-700 ring-amber-600/10';
        if (p.type === 'Others') typeColor = 'bg-purple-50 text-purple-700 ring-purple-600/10';

        let statusBadge = 'bg-blue-50 text-blue-700 ring-blue-600/10';
        if (p.status === 'Completed') statusBadge = 'bg-green-50 text-green-700 ring-green-600/20';
        if (p.status === 'On Hold') statusBadge = 'bg-amber-50 text-amber-700 ring-amber-600/20';

        const stageProgress = Math.round((p.currentStage / 15) * 100);

        const start = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
        const startDateStr = start.toLocaleDateString();
        const endDateStr = p.endDate ? new Date(p.endDate).toLocaleDateString() : '—';

        return `
        <tr class="hover:bg-slate-50/50 transition-all">
          <td class="py-4 px-6 font-bold text-slate-900 text-sm">
            <div class="hover:text-indigo-600 cursor-pointer" data-project-link="${p.id}">${p.name}</div>
            <span class="text-xs text-slate-400 font-normal">Created on ${new Date(p.createdAt).toLocaleDateString()}</span>
          </td>
          <td class="py-4 px-4 text-sm font-semibold text-slate-600 font-mono text-xs">${startDateStr}</td>
          <td class="py-4 px-4 text-sm font-semibold text-slate-600 font-mono text-xs">${endDateStr}</td>
          <td class="py-4 px-4 text-xs font-semibold">
            <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${typeColor} uppercase">
              ${p.type}
            </span>
          </td>
          <td class="py-4 px-4 text-sm font-semibold text-slate-600">${p.category}</td>
          <td class="py-4 px-4 text-sm font-semibold text-slate-600">${p.country}</td>
          <td class="py-4 px-4 text-xs font-semibold">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-800">Stage ${p.currentStage}/15</span>
              <div class="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                <div class="bg-indigo-600 h-full rounded-full" style="width: ${stageProgress}%"></div>
              </div>
            </div>
          </td>
          <td class="py-4 px-4 text-xs font-semibold">
            <span class="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadge}">
              ${p.status}
            </span>
          </td>
          <td class="py-4 px-4 text-xs text-slate-500">
            <div class="font-bold text-slate-700 truncate max-w-[120px]" title="Owner: ${p.ownerName}">Owner: ${p.ownerName}</div>
            <div class="truncate max-w-[120px]" title="${p.contributors.join(', ')}">Contributors: ${p.contributors.join(', ') || 'None'}</div>
          </td>
          <td class="py-4 px-6 text-right text-xs">
            <button 
              data-project-btn="${p.id}"
              class="inline-flex items-center gap-1 bg-indigo-600 text-white font-semibold px-3.5 py-1.5 rounded-lg shadow-sm hover:bg-indigo-500 cursor-pointer transition-all"
            >
              <span>Manage</span>
              <i data-lucide="arrow-right" class="h-3.5 w-3.5"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join('');

    // Attach row links click listeners
    tbody.querySelectorAll('[data-project-link], [data-project-btn]').forEach(el => {
      el.addEventListener('click', e => {
        const projectId = e.currentTarget.getAttribute('data-project-link') || e.currentTarget.getAttribute('data-project-btn');
        const proj = AppState.projects.find(p => p.id === projectId);
        if (proj) {
          AppState.currentProject = proj;
          AppController.switchScreen('workflow');
        }
      });
    });

    lucide.createIcons();
  },
};
