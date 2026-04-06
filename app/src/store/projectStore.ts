import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ProjectState {
  currentProjectId: string | null;
  projectName: string;
  isLoading: boolean;
  isDirty: boolean;
  
  // Actions
  setCurrentProject: (id: string, name: string) => void;
  clearCurrentProject: () => void;
  setDirty: (dirty: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set) => ({
      currentProjectId: null,
      projectName: '',
      isLoading: false,
      isDirty: false,
      setCurrentProject: (id, name) => set({ currentProjectId: id, projectName: name, isDirty: false }),
      clearCurrentProject: () => set({ currentProjectId: null, projectName: '', isDirty: false }),
      setDirty: (dirty) => set({ isDirty: dirty }),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    { name: 'project-store' }
  )
);
