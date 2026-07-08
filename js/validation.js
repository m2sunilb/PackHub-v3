/**
 * Validation utilities for Packaging Hub.
 * Validates files, sizes, and stage-gate checklists.
 */

export const ValidationService = {
  // Max file size: 10 MB
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  validateFile(file) {
    if (!file) return { valid: false, error: 'No file selected.' };
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File "${file.name}" exceeds the 10 MB limit (Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
      };
    }
    return { valid: true };
  },

  validateProjectOverview({ name, type, typeDetails, category, country }) {
    const errors = [];
    if (!name || !name.trim()) errors.push('Project name is required.');
    if (!type) errors.push('Project type is required.');
    if (type === 'Others' && (!typeDetails || !typeDetails.trim())) {
      errors.push('Please specify details for project type "Others".');
    }
    if (!category) errors.push('Category is required.');
    if (!country) errors.push('Country is required.');

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Dynamic checklists as requested in Section 5 "Mandatory checklists per phase"
  // The following stages require a document upload (or an explicit "No" with a reason) before they can turn Green:
  // - Prestart (Marketing brief, Technical brief)
  // - Explore (Idea generation, Idea screening)
  // - Validate (Design & Prototype development, Concept Design Lock with Technical/Brand approvals, Pilot Tool Creation, Feasibility & Validation)
  // - Execute (Product Design Lock, Launch Lock, Scale-up & Implementation)
  getStageRequirements(stageId, projectType) {
    switch (stageId) {
      case 1: // Marketing Brief
        return {
          type: 'choice_upload_reason',
          question: 'Do you have the packaging brief from the Marketing team?',
          options: ['Yes', 'No'],
          requiresUploadOn: 'Yes',
          requiresReasonOn: 'No',
        };
      case 2: // Technical Brief
        return {
          type: 'choice_upload_reason',
          question: 'Have you prepared the technical brief based on the Marketing brief?',
          options: ['Yes', 'No'],
          requiresUploadOn: 'Yes',
          requiresReasonOn: 'No',
        };
      case 3: // Start Decision Gate
        return {
          type: 'gate',
          question: 'Has the Start Decision Gate completed for this project?',
          options: ['Yes'],
          requiresProceed: true,
        };
      case 4: // Idea Generation
        return {
          type: 'idea_generation',
          question: 'How do you want to generate ideas?',
          options: ['Digital', 'Traditional'],
        };
      case 5: // Idea Screening
        return {
          type: 'idea_screening',
          question: 'How do you want to screen your ideas?',
          options: ['Digital', 'Traditional'],
        };
      case 6: // Develop Decision Gate
        return {
          type: 'gate',
          question: 'Has the Develop Decision Gate completed for this project?',
          options: ['Yes'],
          requiresProceed: true,
        };
      case 7: // Design and Prototype Development
        return {
          type: 'design_prototype',
          question: 'How do you want to proceed?',
          options: ['Explore existing design', 'Create new one'],
        };
      case 8: // Concept Design Lock
        return {
          type: 'choice_upload_reason',
          question: 'Have you locked and finalized the concept?',
          options: ['Yes', 'No'],
          requiresUploadOn: 'Yes',
          requiresReasonOn: 'No',
        };
      case 9: // Pilot Tool Creation
        return {
          type: 'pilot_tool',
          question: 'Have you initiated the pilot tool?',
          options: ['Yes', 'No'],
        };
      case 10: // Pilot and Testing
        return {
          type: 'pilot_testing',
          question: 'Does the selected pack design need testing?',
          options: ['Yes', 'No'],
        };
      case 11: // Feasibility and Validation
        return {
          type: 'feasibility_validation',
          question: 'Does the selected pack design need feasibility and validation?',
          options: ['Yes', 'No'],
        };
      case 12: // Launch Lock Gate
        return {
          type: 'gate',
          question: 'Has the Launch Lock Gate completed for this project?',
          options: ['Yes'],
          requiresProceed: true,
        };
      case 13: // Product Design Lock
        return {
          type: 'gate_upload',
          question: 'Have you completed Product Design Lock?',
          options: ['Yes'],
          requiresUploadOn: 'Yes',
        };
      case 14: // Launch Lock
        return {
          type: 'gate_upload',
          question: 'Has the project completed Launch Lock?',
          options: ['Yes'],
          requiresUploadOn: 'Yes',
        };
      case 15: // Scale-up and Implementation
        return {
          type: 'scale_up',
          question: 'Have you done the MPT?',
          projectType,
        };
      default:
        return null;
    }
  },
};
