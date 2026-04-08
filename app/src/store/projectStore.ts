import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ProjectState {
  currentProjectId: string | null;
  currentScenarioId: string | null;
  projectName: string;
  scenarioName: string;
  isLoading: boolean;
  isDirty: boolean;

  // Actions
  setCurrentProject: (id: string, name: string) => void;
  setCurrentScenario: (id: string, name: string) => void;
  clearCurrentProject: () => void;
  clearCurrentScenario: () => void;
  setDirty: (dirty: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set) => ({
      currentProjectId: null,
      currentScenarioId: null,
      projectName: '',
      scenarioName: '',
      isLoading: false,
      isDirty: false,
      setCurrentProject: (id, name) => set({ currentProjectId: id, projectName: name, currentScenarioId: null, scenarioName: '', isDirty: false }),
      setCurrentScenario: (id, name) => set({ currentScenarioId: id, scenarioName: name }),
      clearCurrentProject: () => set({ currentProjectId: null, currentScenarioId: null, projectName: '', scenarioName: '', isDirty: false }),
      clearCurrentScenario: () => set({ currentScenarioId: null, scenarioName: '' }),
      setDirty: (dirty) => set({ isDirty: dirty }),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    { name: 'project-store' }
  )
);
