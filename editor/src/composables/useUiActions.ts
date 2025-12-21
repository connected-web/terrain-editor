import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { UIAction } from '../types/uiActions'

export function useUiActions(options: {
  hasActiveArchive: ComputedRef<boolean>
  setActivePanel: (panel: 'workspace' | 'layers' | 'locations' | 'theme' | 'settings' | 'assets') => void
  setDockExpanded: () => void
  loadSample: () => void
  triggerFileSelect: () => void
  startNewMap: () => void
  exportArchive: () => void
  promptCloseArchive: () => void
}) {
  const actions = computed<UIAction[]>(() => {
    const setPanel = (panel: 'workspace' | 'layers' | 'locations' | 'theme' | 'settings' | 'assets') => {
      options.setActivePanel(panel)
      options.setDockExpanded()
    }
    if (!options.hasActiveArchive.value) {
      return [
        {
          id: 'load-sample',
          icon: 'mountain-sun',
          label: 'Load sample map',
          description: 'Preview the bundled Wynnal terrain archive.',
          callback: () => void options.loadSample()
        },
        {
          id: 'load-file',
          icon: 'folder-open',
          label: 'Load map',
          description: 'Select a local .wyn archive from disk.',
          callback: () => options.triggerFileSelect()
        },
        {
          id: 'new-project',
          icon: 'file-circle-plus',
          label: 'New project',
          description: 'Start from an empty workspace.',
          callback: () => options.startNewMap()
        }
      ]
    }
    return [
      {
        id: 'workspace',
        icon: 'compass-drafting',
        label: 'Workspace',
        description: 'Jump to the workspace controls.',
        callback: () => setPanel('workspace')
      },
      {
        id: 'layers',
        icon: 'layer-group',
        label: 'Layers',
        description: 'Jump to the layer controls.',
        callback: () => setPanel('layers')
      },
      {
        id: 'locations',
        icon: 'location-dot',
        label: 'Locations',
        description: 'Edit location names + icons.',
        callback: () => setPanel('locations')
      },
      {
        id: 'theme',
        icon: 'palette',
        label: 'Theme',
        description: 'Edit label + marker styling.',
        callback: () => setPanel('theme')
      },
      {
        id: 'settings',
        icon: 'gear',
        label: 'Settings',
        description: 'Adjust editor preferences + viewer behavior.',
        callback: () => setPanel('settings')
      },
      {
        id: 'assets',
        icon: 'image',
        label: 'Assets',
        description: 'Browse imported assets.',
        callback: () => setPanel('assets')
      },
      {
        id: 'export',
        icon: 'file-export',
        label: 'Export WYN',
        description: 'Download the current project as a Wyn archive.',
        callback: () => void options.exportArchive()
      },
      {
        id: 'close',
        icon: 'circle-xmark',
        label: 'Close map',
        description: 'Unload the active archive without auto-restoring on refresh.',
        callback: () => options.promptCloseArchive()
      }
    ]
  })

  return {
    uiActions: actions
  }
}
