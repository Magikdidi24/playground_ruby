const { createWorkspace, writeFile, readFile } = require("./fileManager");
const path = require("path");
const fs = require("fs");
const express = require('express');
const cors = require('cors');
const { json, urlencoded } = require('body-parser');
const Docker = require('dockerode');

const app = express();
const docker = new Docker();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));

const RUBY_VERSIONS = {}
const filePath = path.join(__dirname, '../version_langage/ruby_versions.txt');
const versions = fs.readFileSync(filePath, 'utf-8').split('\n');
// console.log(versions)
versions.forEach(v => {
    const key = v.split(':')[1]; 
    RUBY_VERSIONS[key] = v;
});
console.log(RUBY_VERSIONS);

app.post('/api/execute', async (req, res) => {
  const { code, version } = req.body;
  
  if (!code) {
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
  const startTime = Date.now();

  try {
    const container = await docker.createContainer({
      Image: image,
      Cmd: ['ruby', '-e', code],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        Memory: 256 * 1024 * 1024,
        NanoCpus: 500000000,
        NetworkMode: 'none',
        AutoRemove: true 
      }
    });

    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true
    });

    await container.start();

    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        container.stop().catch(() => {});
        reject(new Error('Timeout: Exécution trop longue (max 15s)'));
      }, 15000);
      
      container.wait((err, data) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(data);
      });
    });

    let output = Buffer.concat(chunks).filter(byte => byte !== 0x00).slice(2).toString('utf-8');
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(4);

    res.json({
      success: true,
      output: output || 'Code exécuté avec succès (aucune sortie)',
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
  }
});

app.get('/api/versions', async (_req, res) => {
  const images = await docker.listImages();
  const availableVersions = [];
  
  for (const [version, image] of Object.entries(RUBY_VERSIONS)) {
    const imageExists = images.some(img => img.RepoTags && img.RepoTags.includes(image));
    if (imageExists) {
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
    const workspaceDir = path.join('./backend/workspace', id);
    
    if (!fs.existsSync(workspaceDir)) {
      createWorkspace(id);
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
    res.status(500).json({ 
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
    res.status(404).json({ 
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
    
    const filePath = writeFile(workspaceId, filename, content);
    
    res.json({ 
      success: true, 
      message: 'Fichier sauvegardé avec succès',
      filePath,
      filename 
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    res.status(500).json({ 
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
    
    const filePath = path.join('./backend/workspace', id, filename);
    
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
    res.status(500).json({ 
      success: false, 
      error: `Erreur lors de la suppression: ${error.message}` 
    });
  }
});

app.get("/api/file", (req, res) => {
  try {
    const content = readFile("default", "main.rb");
    res.json({ filename: "main.rb", content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/save", (req, res) => {
  const { filename, content } = req.body;
  if (!filename || content === undefined) {
    return res.status(400).json({ 
      error: "Nom de fichier ou contenu manquant" 
    });
  }

  try {
    writeFile("default", filename, content);
    res.json({ message: "Fichier sauvegardé avec succès" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

app.listen(PORT, async () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Serveur Ruby Online IDE démarré`);
  console.log(`${'='.repeat(50)}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`\nStatistiques:`);
  console.log(`• Versions Ruby configurées: ${Object.keys(RUBY_VERSIONS).length}`);
  
  const images = await docker.listImages();
  const availableCount = Object.values(RUBY_VERSIONS).filter(image => 
    images.some(img => img.RepoTags && img.RepoTags.includes(image))
  ).length;
  
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