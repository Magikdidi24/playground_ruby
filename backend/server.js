const { createWorkspace, writeFile, readFile, resolveInWorkspace } = require("./fileManager");
const path = require("path");
const fs = require("fs");
const express = require('express');
const { json } = require('body-parser');
const Docker = require('dockerode');
const { parseVersions, hasImage, decodeOutput, isLocalHost } = require('./sandbox');

const app = express();
const docker = new Docker();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
  if (isLocalHost(req.headers.host)) return next();
  res.status(403).json({ success: false, error: 'Hôte non autorisé' });
});

// JSON only, no CORS: other sites can neither submit a form here nor read replies (the frontend uses the dev proxy).
app.use(json());

const filePath = path.join(__dirname, '../version_langage/ruby_versions.txt');
const RUBY_VERSIONS = parseVersions(fs.readFileSync(filePath, 'utf-8'));
console.log(RUBY_VERSIONS);

const MAX_OUTPUT = 64 * 1024; // bytes kept from the program's output
const MAX_RUNNING = 2; // containers running at once
let running = 0;
const SANDBOX_LABEL = 'playground-ruby.sandbox'; // marks our containers for cleanup at startup

// SIGKILL first: Podman's force remove sends SIGTERM and waits 10s.
async function destroy(container) {
  await container.kill().catch(() => {});
  await container.remove({ force: true }).catch(() => {});
}

app.post('/api/execute', async (req, res) => {
  const { code, version } = req.body;
  
  if (typeof code !== 'string' || !code) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le code est requis' 
    });
  }
  
  if (!version) {
    return res.status(400).json({ 
      success: false, 
      error: 'La version Ruby est requise',
      hint: 'Utilisez /api/versions pour voir les versions disponibles'
    });
  }

  const image = RUBY_VERSIONS[version];
  if (!image) {
    return res.status(400).json({ 
      success: false, 
      error: `Version Ruby inconnue: ${version}`,
      hint: 'Utilisez /api/versions pour voir les versions disponibles'
    });
  }

  if (running >= MAX_RUNNING) {
    return res.status(429).json({ 
      success: false, 
      error: 'Trop d\'exécutions en cours, réessayez dans un instant' 
    });
  }

  const startTime = Date.now();
  let container;
  running++;

  try {
    container = await docker.createContainer({
      Image: image,
      Cmd: ['ruby', '-e', code],
      Labels: { [SANDBOX_LABEL]: '1' },
      User: '65534:65534', // nobody
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        Memory: 256 * 1024 * 1024,
        MemorySwap: 256 * 1024 * 1024, // no swap on top of the memory limit
        NanoCpus: 500000000,
        PidsLimit: 64,
        NetworkMode: 'none',
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        ReadonlyRootfs: true,
        Tmpfs: { '/tmp': 'rw,noexec,nosuid,nodev,size=16m' }
      }
    });

    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true
    });

    const chunks = [];
    let size = 0;
    stream.on('data', chunk => {
      if (size > MAX_OUTPUT) return;
      chunks.push(chunk);
      size += chunk.length;
      if (size > MAX_OUTPUT) container.kill().catch(() => {});
    });
    // Listen to 'error' too: an unhandled error (attach socket reset) would crash Node.
    const streamEnded = new Promise(resolve => stream.on('end', resolve).on('error', resolve));

    await container.start();

    // Wait for the exit code and for the last bytes of output.
    let timeout;
    const [{ StatusCode }] = await Promise.race([
      Promise.all([container.wait(), streamEnded]),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Timeout: Exécution trop longue (max 15s)')), 15000);
      })
    ]).finally(() => clearTimeout(timeout));

    let output = decodeOutput(Buffer.concat(chunks).subarray(0, MAX_OUTPUT));
    if (size > MAX_OUTPUT) output += `\n[Sortie tronquée à ${MAX_OUTPUT / 1024} Ko]`;
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(4);

    res.json({
      success: true,
      output: output || (StatusCode === 0 ? 'Code exécuté avec succès (aucune sortie)' : `Aucune sortie (code de sortie ${StatusCode})`),
      exitCode: StatusCode,
      executionTime: `${executionTime}s`,
      version: version
    });

  } catch (error) {
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(3);
    res.json({
      success: false,
      error: error.message,
      executionTime: `${executionTime}s`,
      version: version
    });
  } finally {
    if (container) await destroy(container);
    running--;
  }
});

app.get('/api/versions', async (_req, res) => {
  let images;
  try {
    images = await docker.listImages();
  } catch (error) {
    return res.json({ success: false, error: `Docker injoignable: ${error.message}` });
  }
  const availableVersions = [];
  
  for (const [version, image] of Object.entries(RUBY_VERSIONS)) {
    if (hasImage(images, image)) {
      availableVersions.push(version);
    }
  }
  
  availableVersions.sort((a, b) => {
    return b.localeCompare(a, undefined, { numeric: true });
  });
  
  const allVersions = Object.keys(RUBY_VERSIONS).sort((a, b) => {
    return b.localeCompare(a, undefined, { numeric: true });
  });
  
  const groupedVersions = availableVersions.reduce((acc, version) => {
    const [major, minor] = version.split('.');
    const key = `${major}.${minor}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(version);
    return acc;
  }, {});

  res.json({ 
    success: true, 
    availableVersions,
    totalAvailable: availableVersions.length,
    totalConfigured: allVersions.length,
    groupedByMinorVersion: groupedVersions,
    latestVersion: availableVersions[0] || null,
  });
});

app.get('/api/workspace/:id/files', (req, res) => {
  try {
    const { id } = req.params;
    const workspaceDir = resolveInWorkspace(id);
    
    if (!fs.existsSync(workspaceDir)) {
      return res.json({ success: true, files: [] });
    }
    
    const files = fs.readdirSync(workspaceDir)
      .filter(file => file.endsWith('.rb'))
      .sort();
    
    res.json({ 
      success: true, 
      files,
      count: files.length 
    });
  } catch (error) {
    console.error('Erreur lors de la liste des fichiers:', error);
    res.status(error.status || 500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/workspace/:id/file/:filename', (req, res) => {
  try {
    const { id, filename } = req.params;
    
    if (!filename.endsWith('.rb')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Le fichier doit avoir l\'extension .rb' 
      });
    }
    
    const content = readFile(id, filename);
    res.json({ 
      success: true, 
      content, 
      filename 
    });
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier:', error);
    res.status(error.status || 404).json({ 
      success: false, 
      error: `Fichier introuvable: ${error.message}` 
    });
  }
});

app.post('/api/workspace/save', (req, res) => {
  try {
    const { workspaceId, filename, content } = req.body;
    
    if (!workspaceId || !filename || content === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'workspaceId, filename et content sont requis' 
      });
    }
    
    if (!filename.endsWith('.rb')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Le fichier doit avoir l\'extension .rb' 
      });
    }
    
    writeFile(workspaceId, filename, content);
    
    res.json({ 
      success: true, 
      message: 'Fichier sauvegardé avec succès',
      filename 
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    res.status(error.status || 500).json({ 
      success: false, 
      error: `Erreur lors de la sauvegarde: ${error.message}` 
    });
  }
});

app.delete('/api/workspace/:id/file/:filename', (req, res) => {
  try {
    const { id, filename } = req.params;
    
    if (!filename.endsWith('.rb')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Le fichier doit avoir l\'extension .rb' 
      });
    }
    
    const filePath = resolveInWorkspace(id, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Fichier introuvable' 
      });
    }
    
    fs.unlinkSync(filePath);
    
    res.json({ 
      success: true, 
      message: `Fichier "${filename}" supprimé avec succès` 
    });
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(error.status || 500).json({ 
      success: false, 
      error: `Erreur lors de la suppression: ${error.message}` 
    });
  }
});

// Malformed JSON, body too large...: JSON instead of Express's HTML stack trace (it shows host paths).
app.use((error, _req, res, _next) => {
  console.error('Requête invalide:', error.message);
  res.status(error.status || 500).json({ success: false, error: 'Requête invalide' });
});

const workspaceId = "default";
const workspacePath = createWorkspace(workspaceId);
const baseFile = path.join(workspacePath, "main.rb");

if (!fs.existsSync(baseFile)) {
  writeFile(
    workspaceId,
    "main.rb",
    `# Bienvenue dans ton éditeur Ruby en ligne !
puts "Hello, world!"
puts "Version Ruby: #{RUBY_VERSION}"
puts "Plateforme: #{RUBY_PLATFORM}"`
  );
  console.log("✓ Fichier de base main.rb créé !");
}

app.listen(PORT, '127.0.0.1', async () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Serveur Ruby Online IDE démarré`);
  console.log(`${'='.repeat(50)}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`\nStatistiques:`);
  console.log(`• Versions Ruby configurées: ${Object.keys(RUBY_VERSIONS).length}`);
  
  const images = await docker.listImages().catch(error => {
    console.log(`\nATTENTION: Docker injoignable (${error.message})`);
    return [];
  });
  const availableCount = Object.values(RUBY_VERSIONS).filter(image => hasImage(images, image)).length;

  // Containers left running if a previous server died mid-run.
  const leftovers = await docker.listContainers({ all: true, filters: { label: [SANDBOX_LABEL] } }).catch(() => []);
  await Promise.all(leftovers.map(c => destroy(docker.getContainer(c.Id))));
  if (leftovers.length) console.log(`• Conteneurs orphelins supprimés: ${leftovers.length}`);
  
  console.log(`• Images Docker disponibles: ${availableCount}/${Object.keys(RUBY_VERSIONS).length}`);
  
  if (availableCount === 0) {
    console.log(`\nATTENTION: Aucune image Ruby trouvée!`);
  }
  
  console.log(`\nAPI Endpoints:`);
  console.log(`   GET    /api/versions                    - Liste des versions disponibles`);
  console.log(`   POST   /api/execute                     - Exécuter du code Ruby`);
  console.log(`   GET    /api/workspace/:id/files         - Liste des fichiers`);
  console.log(`   GET    /api/workspace/:id/file/:name    - Charger un fichier`);
  console.log(`   POST   /api/workspace/save              - Sauvegarder un fichier`);
  console.log(`   DELETE /api/workspace/:id/file/:name    - Supprimer un fichier`);
  console.log(`\nServeur prêt à recevoir des requêtes!`);
  console.log(`${'='.repeat(50)}\n`);
});