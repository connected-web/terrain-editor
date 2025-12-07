export type SolidImageData = {
  url: string
  buffer: ArrayBuffer
}

export function createSolidImageData(width: number, height: number, value: number): SolidImageData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Unable to create canvas context')
  }
  const channel = Math.max(0, Math.min(255, Math.round(value)))
  ctx.fillStyle = `rgb(${channel}, ${channel}, ${channel})`
  ctx.fillRect(0, 0, width, height)
  const url = canvas.toDataURL('image/png')
  return {
    url,
    buffer: dataUrlToArrayBuffer(url)
  }
}

export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const commaIndex = dataUrl.indexOf(',')
  const payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
  const binary = atob(payload)
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i += 1) {
    view[i] = binary.charCodeAt(i)
  }
  return buffer
}
