import sharp from "sharp"
import { readFileSync } from "fs"

const svg = readFileSync("frontend/public/favicon.svg", "utf8")

// Replace white strokes with blue to be visible on transparent background
const adjusted = svg
  .replace(/stroke="#FFFFFF"/g, 'stroke="#3B82F6"')
  .replace(/fill="#FFFFFF"/g, 'fill="#3B82F6"')

sharp(Buffer.from(adjusted))
  .resize(32, 32)
  .png()
  .toFile("frontend/public/favicon.png")
  .then(() => console.log("favicon.png generated"))
  .catch(err => console.error(err))
