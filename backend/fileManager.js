const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve("./backend/workspace");

function createWorkspace(id) {
  const dir = path.join(ROOT_DIR, id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(id, filename, content) {
  const dir = createWorkspace(id);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function readFile(id, filename) {
  const filePath = path.join(ROOT_DIR, id, filename);
  if (!fs.existsSync(filePath)) throw new Error("Fichier introuvable");
  return fs.readFileSync(filePath, "utf8");
}

module.exports = { createWorkspace, writeFile, readFile };