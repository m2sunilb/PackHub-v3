import { ApiService } from './api.js';
import { AuthModule } from './auth.js';
import { DashboardModule } from './dashboard.js';
import { NewProjectModule } from './new-project.js';
import { WorkflowModule } from './workflow.js';

// Global state
export const AppState = {
  currentUser: null,
  projects: [],
  currentProject: null,
  currentScreen: 'login', // login, dashboard, projects, new-project, workflow, history
};

export const AppController = {
  init() {
    // Check local session
    const token = ApiService.getSessionToken();
    const user = ApiService.getCurrentUser();

    // Setup global navigation and screen events
    this.bindEvents();

    if (token && user) {
      AppState.currentUser = user;
      this.loginSuccess(user);
    } else {
      this.switchScreen('login');
    }

    // Initialize individual modules
    AuthModule.init();
    DashboardModule.init();
    NewProjectModule.init();
    WorkflowModule.init();

    // Trigger lucide icon replacement
    lucide.createIcons();
  },

  bindEvents() {
    // Sidebar nav clicks
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', e => {
        const screen = e.currentTarget.getAttribute('data-nav');
        this.switchScreen(screen);
      });
    });

    // Global Search Bar
    const searchInput = document.getElementById('global-search');
    searchInput.addEventListener('input', e => {
      const query = e.target.value;
      if (AppState.currentScreen === 'projects') {
        DashboardModule.loadProjectsList(query);
      } else if (AppState.currentScreen === 'dashboard') {
        DashboardModule.loadDashboard(query);
      }
    });

    // Logout Button
    document.getElementById('btn-logout').addEventListener('click', () => {
      ApiService.clearSession();
      AppState.currentUser = null;
      AppState.projects = [];
      AppState.currentProject = null;
      this.switchScreen('login');
    });

    // Handle unauthorized sessions / API token expirations
    window.addEventListener('unauthorized', () => {
      AppState.currentUser = null;
      AppState.projects = [];
      AppState.currentProject = null;
      this.switchScreen('login');
    });

    // Help Button
    const helpBtn = document.querySelector('[title="Packaging Hub Documentation"]');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        alert(
          'Desire Lab Support:\n\nFor questions about Unilever AWS specifications, MPT setup, or digital prototyping training documentation links (Convotrack, Vurvey, Boltchat, PactInsta AI, MCA, 3DX Simulator), please reach out to the Pack Excellence Digital Lead.'
        );
      });
    }
  },

  switchScreen(screenId) {
    AppState.currentScreen = screenId;

    // Manage screen element visibility
    const screens = {
      login: document.getElementById('screen-login'),
      dashboard: document.getElementById('screen-dashboard'),
      projects: document.getElementById('screen-projects'),
      'new-project': document.getElementById('screen-new-project'),
      workflow: document.getElementById('screen-workflow-wizard'),
      history: document.getElementById('screen-project-history'),
    };

    // Hide all
    Object.values(screens).forEach(el => {
      if (el) el.classList.add('hidden');
    });

    const appWrapper = document.getElementById('app-wrapper');

    // Show app wrapper or login screen
    if (screenId === 'login') {
      appWrapper.classList.add('hidden');
      screens.login.classList.remove('hidden');
    } else {
      screens.login.classList.add('hidden');
      appWrapper.classList.remove('hidden');

      // Highlight active nav item
      document.querySelectorAll('[data-nav]').forEach(btn => {
        const btnNav = btn.getAttribute('data-nav');
        if (btnNav === screenId) {
          btn.classList.add('bg-slate-800', 'text-white');
          btn.classList.remove('text-slate-300');
        } else {
          btn.classList.remove('bg-slate-800', 'text-white');
          btn.classList.add('text-slate-300');
        }
      });

      // Show specific screen container
      if (screens[screenId]) {
        screens[screenId].classList.remove('hidden');
      }

      // Refresh screens when loaded
      this.onScreenLoad(screenId);
    }

    lucide.createIcons();
  },

  async onScreenLoad(screenId) {
    const searchInput = document.getElementById('global-search');
    try {
      if (screenId === 'dashboard') {
        searchInput.value = '';
        await DashboardModule.loadDashboard();
      } else if (screenId === 'projects') {
        searchInput.value = '';
        await DashboardModule.loadProjectsList();
      } else if (screenId === 'new-project') {
        NewProjectModule.resetForm();
      } else if (screenId === 'workflow' && AppState.currentProject) {
        await WorkflowModule.loadProjectWorkflow(AppState.currentProject.id);
      } else if (screenId === 'history' && AppState.currentProject) {
        await WorkflowModule.loadProjectHistory(AppState.currentProject.id);
      }
    } catch (error) {
      console.error(`Error loading screen ${screenId}:`, error);
    }
  },

  loginSuccess(user) {
    AppState.currentUser = user;

    // Set header profile avatars
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar) {
      const initials = user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2);
      userAvatar.innerText = initials || user.id.substring(0, 2);
    }

    const userNameDisplay = document.getElementById('user-name-display');
    if (userNameDisplay) userNameDisplay.innerText = user.name;

    const userIdDisplay = document.getElementById('user-id-display');
    if (userIdDisplay) userIdDisplay.innerText = `@${user.id}`;

    // Go to dashboard by default
    this.switchScreen('dashboard');
  },
};

// Start app on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  AppController.init();
});
