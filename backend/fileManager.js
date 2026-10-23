const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "workspace");

// Resolve a workspace (and optionally a file in it) under ROOT_DIR. Ids are
// plain names (letters, digits, "_", "-"); filenames must stay in the
// workspace: "..", "/etc", "a/b" or "../x.rb" are rejected.
function resolveInWorkspace(id, filename) {
  if (!/^[\w-]{1,64}$/.test(String(id))) throw invalidPath();
  const dir = path.join(ROOT_DIR, String(id));
  if (filename === undefined) return dir;
  const filePath = path.resolve(dir, String(filename));
  if (path.dirname(filePath) !== dir) throw invalidPath();
  return filePath;
}

function invalidPath() {
  return Object.assign(new Error("Chemin invalide"), { status: 400 });
}

function createWorkspace(id) {
  const dir = resolveInWorkspace(id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(id, filename, content) {
  createWorkspace(id);
  const filePath = resolveInWorkspace(id, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function readFile(id, filename) {
  const filePath = resolveInWorkspace(id, filename);
  if (!fs.existsSync(filePath)) throw new Error("Fichier introuvable");
  return fs.readFileSync(filePath, "utf8");
}

module.exports = { createWorkspace, writeFile, readFile, resolveInWorkspace };
