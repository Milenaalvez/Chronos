import sharp from "sharp"
import { readFileSync } from "fs"

const svg = readFileSync("frontend/public/favicon.svg", "utf8")

sharp(Buffer.from(svg))
  .resize(32, 32)
  .png()
  .toFile("frontend/public/favicon.png")
  .then(() => console.log("favicon.png generated"))
  .catch(err => console.error(err))
