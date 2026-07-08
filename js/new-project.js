import { ApiService } from './api.js';
import { AppState, AppController } from './app.js';
import { ValidationService } from './validation.js';

export const NewProjectModule = {
  init() {
    const form = document.getElementById('new-project-form');
    if (!form) return;

    // Toggle others field
    const typeSelect = document.getElementById('p-type');
    const othersContainer = document.getElementById('p-type-details-container');

    typeSelect.addEventListener('change', e => {
      if (e.target.value === 'Others') {
        othersContainer.classList.remove('hidden');
        document.getElementById('p-type-details').setAttribute('required', 'true');
      } else {
        othersContainer.classList.add('hidden');
        document.getElementById('p-type-details').removeAttribute('required');
      }
    });

    // Form cancel button
    document.getElementById('btn-cancel-project').addEventListener('click', () => {
      AppController.switchScreen('dashboard');
    });

    // Handle form submit
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const name = document.getElementById('p-name').value.trim();
      const type = document.getElementById('p-type').value;
      const typeDetails = document.getElementById('p-type-details').value.trim();
      const category = document.getElementById('p-category').value;
      const country = document.getElementById('p-country').value;
      const contributorsInput = document.getElementById('p-contributors').value.trim();

      const errorBox = document.getElementById('new-project-error');
      const errorText = document.getElementById('new-project-error-text');

      if (errorBox) errorBox.classList.add('hidden');

      // Client-side Validation
      const validation = ValidationService.validateProjectOverview({
        name,
        type,
        typeDetails,
        category,
        country,
      });

      if (!validation.valid) {
        if (errorBox && errorText) {
          errorText.innerText = validation.errors.join(' ');
          errorBox.classList.remove('hidden');
        }
        return;
      }

      // Convert contributors string to array
      const contributors = contributorsInput
        ? contributorsInput.split(',').map(c => c.trim()).filter(c => c.length > 0)
        : [];

      try {
        const createdProject = await ApiService.createProject({
          name,
          type,
          typeDetails: type === 'Others' ? typeDetails : undefined,
          category,
          country,
          contributors,
        });

        // Save to state and navigate to workflow page!
        AppState.currentProject = createdProject;
        AppController.switchScreen('workflow');
      } catch (err) {
        if (errorBox && errorText) {
          errorText.innerText = err.message || 'Failed to create project.';
          errorBox.classList.remove('hidden');
        }
      }
    });
  },

  resetForm() {
    const form = document.getElementById('new-project-form');
    if (form) {
      form.reset();
    }
    const othersContainer = document.getElementById('p-type-details-container');
    if (othersContainer) {
      othersContainer.classList.add('hidden');
      document.getElementById('p-type-details').removeAttribute('required');
    }
    const errorBox = document.getElementById('new-project-error');
    if (errorBox) errorBox.classList.add('hidden');
  },
};
