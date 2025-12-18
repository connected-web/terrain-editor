// video-utils.ts
import { TestInfo, Page, expect, Locator } from '@playwright/test'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// Extend window interface for terrain viewer handle (matching editor's declaration)
declare global {
  interface Window {
    __terrainViewer?: {
      enableFrameCaptureMode: (fps?: number) => { fps: number }
      disableFrameCaptureMode: () => void
      captureFrame: (frameNumber: number, fps?: number) => { frameNumber: number; time: number }
    } | null
  }
}

export function videoNameFromTest(testInfo: any) {
  return testInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function addDebugParam(url: string, debugValue = 'PLAYWRIGHT'): string {
  const urlObj = new URL(url, 'http://localhost')
  urlObj.searchParams.set('debug', debugValue)
  return urlObj.pathname + urlObj.search
}

export async function waitForMapReady(page: Page, timeout = 60_000) {
  await expect(page.getByText('Map ready.', { exact: true })).toBeVisible({ timeout })
}

export async function rescaleUI(page: Page, scale = 0.7, dockHeight?: string) {
  const heightValue =
    dockHeight ?? `${Math.round((1 / Math.max(scale, 0.01)) * 100)}vh`

  await page.evaluate(
    ({ scaleValue, heightValue }) => {
      const editorLayout = document.querySelector<HTMLElement>('.editor-layout')
      if (editorLayout) editorLayout.style.zoom = String(scaleValue)
      const panelDock = document.querySelector<HTMLElement>('.panel-dock')
      if (panelDock) panelDock.style.height = heightValue
    },
    { scaleValue: scale, heightValue }
  )
  await page.waitForTimeout(50)
}

export function duplicateFrames(frame: Buffer, seconds: number, fps: number): Buffer[] {
  const count = Math.max(1, Math.ceil(seconds * fps))
  return Array.from({ length: count }, () => frame)
}

function cssAttrEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

export function locationDialog(page: Page): Locator {
  const heading = page.getByRole('heading', { name: 'Select a location' })
  return page.locator('.location-dialog').filter({ has: heading }).first()
}

export async function openLocationDialog(page: Page, selectorButton: Locator) {
  const dialog = locationDialog(page)

  const isVisible = await dialog.isVisible().catch(() => false)
  if (!isVisible) {
    await selectorButton.click()
  }

  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await expect(dialog.locator('button.location-dialog__item').first()).toBeVisible({
    timeout: 30_000
  })

  return dialog
}

export async function logLocationDialogContents(dialog: Locator) {
  const buttons = dialog.locator('button.location-dialog__item')
  const count = await buttons.count()

  const labels = (await buttons.locator('strong').allTextContents()).map((s) => s.trim())
  const fullTexts = (await buttons.allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim())

  console.log(`🧾 Location dialog: ${count} items`)
  console.log('🧾 Labels:', labels)
  console.log('🧾 Full button texts:', fullTexts)
}

export function locationItem(dialog: Locator, name: string): Locator {
  const attr = cssAttrEscape(name)
  return dialog
    .locator(`button.location-dialog__item[data-test-location="${attr}"]`)
    .first()
}

/**
 * Keyframe for video composition
 */
export interface Keyframe {
  screenshot: Buffer
  durationSeconds: number
}

/**
 * Capture a single keyframe (screenshot held for a duration)
 */
export async function captureKeyframe(
  page: Page,
  durationSeconds: number
): Promise<Keyframe> {
  const screenshot = await page.screenshot({ type: 'png' })
  return { screenshot, durationSeconds }
}

/**
 * Compose keyframes and animation frames into a single video
 */
export async function composeVideo(options: {
  keyframes: Keyframe[]
  animationFrames?: Buffer[]
  outputName: string
  fps?: number
}) {
  const fps = options.fps ?? 30
  const outputDir = path.join(process.cwd(), 'documentation', 'renders')
  const framesDir = path.join(outputDir, `${options.outputName}-frames`)

  // Clean and create frames directory
  if (fs.existsSync(framesDir)) {
    fs.rmSync(framesDir, { recursive: true })
  }
  fs.mkdirSync(framesDir, { recursive: true })

  console.log(`🎬 Composing video from ${options.keyframes.length} keyframes and ${options.animationFrames?.length ?? 0} animation frames...`)

  const allFrames: Buffer[] = []

  // Add keyframes (duplicate each frame for the duration)
  for (const keyframe of options.keyframes) {
    const framesToDuplicate = Math.ceil(keyframe.durationSeconds * fps)
    console.log(`  ├─ Adding keyframe for ${keyframe.durationSeconds}s (${framesToDuplicate} frames)`)
    for (let i = 0; i < framesToDuplicate; i++) {
      allFrames.push(keyframe.screenshot)
    }
  }

  // Add animation frames
  if (options.animationFrames) {
    console.log(`  ├─ Adding ${options.animationFrames.length} animation frames`)
    allFrames.push(...options.animationFrames)
  }

  console.log(`📝 Writing ${allFrames.length} total frames to disk...`)

  // Write all frames to disk in parallel
  await Promise.all(
    allFrames.map((buffer, index) => {
      const framePath = path.join(framesDir, `frame-${index.toString().padStart(5, '0')}.png`)
      return fs.promises.writeFile(framePath, buffer)
    })
  )

  console.log(`✓ Wrote all ${allFrames.length} frames to disk`)

  return { framesDir, totalFrames: allFrames.length, fps }
}

/**
 * Capture animation frames deterministically by manually advancing the scene time
 * and taking screenshots. Returns frames without writing to disk.
 */
export async function captureAnimationFrames(
  page: Page,
  options: {
    fps?: number
    durationSeconds: number
  }
): Promise<Buffer[]> {
  const fps = options.fps ?? 30
  const totalFrames = Math.ceil(options.durationSeconds * fps)

  console.log(`📹 Capturing ${totalFrames} animation frames at ${fps}fps...`)

  const frameBuffers: Buffer[] = []

  // Enable frame capture mode once at the start
  await page.evaluate((fps) => {
    if (!window.__terrainViewer) {
      throw new Error('Terrain viewer not found on window.__terrainViewer')
    }
    window.__terrainViewer.enableFrameCaptureMode(fps)
  }, fps)

  // Capture frames one at a time using Playwright screenshots
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    console.log(`  ├─ Capturing frame ${frameIndex + 1}/${totalFrames}...`)

    // Advance to next frame
    await page.evaluate(({ frameNumber, fps }) => {
      window.__terrainViewer!.captureFrame(frameNumber, fps)
    }, { frameNumber: frameIndex, fps })

    // Take screenshot using Playwright (includes all UI elements)
    const screenshot = await page.screenshot({ type: 'png' })
    frameBuffers.push(screenshot)
  }

  // Disable frame capture mode
  await page.evaluate(() => {
    window.__terrainViewer?.disableFrameCaptureMode()
  })

  console.log(`✓ Captured all ${totalFrames} animation frames`)

  return frameBuffers
}

/**
 * Stitch frames into video formats using ffmpeg
 */
export function stitchFramesToVideo(options: {
  framesDir: string
  outputName: string
  fps: number
  gifFps?: number
}) {
  const outputDir = path.join(process.cwd(), 'documentation', 'animations')
  const mp4Output = path.join(outputDir, `${options.outputName}.mp4`)
  const gifOutput = path.join(outputDir, `${options.outputName}.gif`)

  const gifFps = options.gifFps ?? Math.min(options.fps, 12)

  console.log(`🎬 Stitching frames into video...`)

  // Create MP4 from frames
  try {
    execSync(
      `ffmpeg -y -framerate ${options.fps} -i "${options.framesDir}/frame-%05d.png" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4Output}"`,
      { stdio: 'inherit' }
    )
    console.log(`✓ Created MP4: ${mp4Output}`)
  } catch (err) {
    console.warn('⚠️ MP4 creation failed')
    throw err
  }

  // Create GIF from MP4
  try {
    execSync(
      `ffmpeg -y -i "${mp4Output}" -vf "fps=${gifFps},scale=512:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifOutput}"`,
      { stdio: 'inherit' }
    )
    console.log(`✓ Created GIF: ${gifOutput}`)
  } catch (err) {
    console.warn('⚠️ GIF creation failed')
  }

  // Clean up frames directory
  fs.rmSync(options.framesDir, { recursive: true })
  console.log(`✓ Cleaned up frames directory`)

  return { mp4Output, gifOutput }
}

export async function saveVideoAsGif(page: Page, testInfo: TestInfo, outputName: string) {
  if (!process.env.RECORD_VIDEO) {
    console.log('Video recording is disabled; skipping saveVideoAsGif. Set RECORD_VIDEO=1 to enable.')
    return
  }
  
  const video = page.video()
  if (!video) {
    console.warn('Video is not enabled for this test:', outputName)
    return
  }

  const context = page.context()
  await context.close()

  const videoPath = await video.path() // waits until video is written
  if (!videoPath) {
    console.warn('No video path available for', outputName)
    return
  }

  const outputDir = path.join(process.cwd(), 'documentation', 'animations')
  fs.mkdirSync(outputDir, { recursive: true })

  const webmOutput = path.join(outputDir, `${outputName}.webm`)
  const mp4Output = path.join(outputDir, `${outputName}.mp4`)
  const gifOutput = path.join(outputDir, `${outputName}.gif`)

  // Keep original container
  fs.copyFileSync(videoPath, webmOutput)
  console.log(`✓ Saved video: ${webmOutput}`)

  // Convert to mp4 (real conversion, not rename)
  try {
    execSync(
      `ffmpeg -y -i "${webmOutput}" -movflags +faststart "${mp4Output}"`,
      { stdio: 'inherit' }
    )
    console.log(`✓ Converted to MP4: ${mp4Output}`)
  } catch (err) {
    console.warn('⚠️ Video conversion failed for', outputName)
    return
  }

  // Convert to GIF (palette workflow)
  try {
    execSync(
      `ffmpeg -y -i "${mp4Output}" -vf "fps=10,scale=512:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifOutput}"`,
      { stdio: 'inherit' }
    )
  } catch (err) {
    console.warn('⚠️ GIF conversion failed for', outputName)
    return
  }

  console.log(`✓ Converted to GIF: ${gifOutput}`)
}

export function registerVideoRecordingHooks(test: { afterEach: (fn: (args: { page: Page }, testInfo: TestInfo) => Promise<void>) => void }) {
  test.afterEach(async ({ page }, testInfo) => {
    if (!process.env.RECORD_VIDEO) return

    // Don't try to record if the test already blew up before page existed
    if (!page) {
      console.log('🎥 Skipped saving video; no page available for test:', testInfo.title)
      return
    }

    // Only save video for failed tests 
    if (testInfo.status !== testInfo.expectedStatus) {
      console.log('🎥 Skipped saving video for failed test:', testInfo.title, '(' + testInfo.status + ')')
      return
    }

    const outputName = videoNameFromTest(testInfo)

    try {
      await saveVideoAsGif(page, testInfo, outputName)
    } catch (err) {
      console.warn('⚠️ Failed to save video for', testInfo.title)
    }
  })
}
