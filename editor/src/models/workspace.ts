import { reactive } from 'vue'

export type WorkspaceForm = {
  label: string
  author: string
  width: number
  height: number
  seaLevel: number
}

export type WorkspaceActions = {
  resetWorkspaceForm: () => void
  updateProjectLabel: (value: string) => void
  updateProjectAuthor: (value: string) => void
  applyMapSize: () => void
  applySeaLevel: () => void
}

const workspaceForm = reactive<WorkspaceForm>({
  label: '',
  author: '',
  width: 1024,
  height: 1536,
  seaLevel: 0
})

const workspaceActions: WorkspaceActions = {
  resetWorkspaceForm: () => {},
  updateProjectLabel: () => {},
  updateProjectAuthor: () => {},
  applyMapSize: () => {},
  applySeaLevel: () => {}
}

export function useWorkspaceModel() {
  return {
    workspaceForm,
    actions: workspaceActions
  }
}

export function registerWorkspaceActions(actions: Partial<WorkspaceActions>) {
  Object.assign(workspaceActions, actions)
}
