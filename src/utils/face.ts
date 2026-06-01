import * as faceapi from "face-api.js"

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/"

let modelsLoaded = false
let loadPromise: Promise<void> | null = null

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    modelsLoaded = true
  })()
  return loadPromise
}

export async function extractDescriptor(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<Float32Array | null> {
  try {
    const detection = await faceapi.detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks().withFaceDescriptor()
    return detection?.descriptor || null
  } catch {
    return null
  }
}

export function compareDescriptors(a: number[] | Float32Array, b: number[] | Float32Array, threshold = 0.6): boolean {
  const arrA = a instanceof Float32Array ? Array.from(a) : a
  const arrB = b instanceof Float32Array ? Array.from(b) : b
  const distance = faceapi.euclideanDistance(arrA, arrB)
  return distance < threshold
}

export function descriptorLoaded(): boolean {
  return modelsLoaded
}
