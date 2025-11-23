import JSZip from 'jszip'

import type { TerrainProjectSnapshot } from './projectStore'

export type BuildWynArchiveOptions = {
  pretty?: boolean
}

function ensureLegend(project: TerrainProjectSnapshot) {
  if (!project.legend) {
    throw new Error('Cannot build WYN archive without a legend.json payload.')
  }
}

function stringify(payload: unknown, options: BuildWynArchiveOptions) {
  const indent = options.pretty ? 2 : undefined
  return JSON.stringify(payload, null, indent)
}

export async function buildWynArchive(
  project: TerrainProjectSnapshot,
  options: BuildWynArchiveOptions = {}
): Promise<Blob> {
  ensureLegend(project)
  const zip = new JSZip()
  zip.file('legend.json', stringify(project.legend, options))
  if (project.locations?.length) {
    zip.file('locations.json', stringify(project.locations, options))
  }
  if (project.theme) {
    zip.file('theme.json', stringify(project.theme, options))
  }
  for (const file of project.files) {
    zip.file(file.path, file.data, {
      binary: true,
      comment: file.sourceFileName ?? ''
    })
  }
  return zip.generateAsync({ type: 'blob' })
}
