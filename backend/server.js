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

const RUBY_VERSIONS = {
  // Ruby 3.4.x
  '3.4.7': 'ruby:3.4.7',
  '3.4.6': 'ruby:3.4.6',
  '3.4.5': 'ruby:3.4.5',
  '3.4.4': 'ruby:3.4.4',
  '3.4.3': 'ruby:3.4.3',
  '3.4.2': 'ruby:3.4.2',
  '3.4.1': 'ruby:3.4.1',
  '3.4.0': 'ruby:3.4.0-rc1',
  
  // Ruby 3.3.x
  '3.3.9': 'ruby:3.3.9-alpine',
  '3.3.8': 'ruby:3.3.8-alpine',
  '3.3.7': 'ruby:3.3.7-alpine',
  '3.3.6': 'ruby:3.3.6-alpine',
  '3.3.5': 'ruby:3.3.5-alpine',
  '3.3.4': 'ruby:3.3.4-alpine',
  '3.3.3': 'ruby:3.3.3-alpine',
  '3.3.2': 'ruby:3.3.2-alpine',
  '3.3.1': 'ruby:3.3.1-alpine',
  '3.3.0': 'ruby:3.3.0-alpine',
  
  // Ruby 3.2.x
  '3.2.9': 'ruby:3.2.9-alpine',
  '3.2.8': 'ruby:3.2.8-alpine',
  '3.2.7': 'ruby:3.2.7-alpine',
  '3.2.6': 'ruby:3.2.6-alpine',
  '3.2.5': 'ruby:3.2.5-alpine',
  '3.2.4': 'ruby:3.2.4-alpine',
  '3.2.3': 'ruby:3.2.3-alpine',
  '3.2.2': 'ruby:3.2.2-alpine',
  '3.2.1': 'ruby:3.2.1-alpine',
  '3.2.0': 'ruby:3.2.0-alpine',
  
  // Ruby 3.1.x
  '3.1.7': 'ruby:3.1.7-alpine',
  '3.1.6': 'ruby:3.1.6-alpine',
  '3.1.5': 'ruby:3.1.5-alpine',
  '3.1.4': 'ruby:3.1.4-alpine',
  '3.1.3': 'ruby:3.1.3-alpine',
  '3.1.2': 'ruby:3.1.2-alpine',
  '3.1.1': 'ruby:3.1.1-alpine',
  '3.1.0': 'ruby:3.1.0-alpine',
  
  // Ruby 3.0.x
  '3.0.7': 'ruby:3.0.7-alpine',
  '3.0.6': 'ruby:3.0.6-alpine',
  '3.0.5': 'ruby:3.0.5-alpine',
  '3.0.4': 'ruby:3.0.4-alpine',
  '3.0.3': 'ruby:3.0.3-alpine',
  '3.0.2': 'ruby:3.0.2-alpine',
  '3.0.1': 'ruby:3.0.1-alpine',
  '3.0.0': 'ruby:3.0.0-alpine',
  
  // Ruby 2.7.x
  '2.7.8': 'ruby:2.7.8-alpine',
  '2.7.7': 'ruby:2.7.7-alpine',
  '2.7.6': 'ruby:2.7.6-alpine',
  '2.7.5': 'ruby:2.7.5-alpine',
  '2.7.4': 'ruby:2.7.4-alpine',
  '2.7.3': 'ruby:2.7.3-alpine',
  '2.7.2': 'ruby:2.7.2-alpine',
  '2.7.1': 'ruby:2.7.1-alpine',
  '2.7.0': 'ruby:2.7.0-alpine',
  
  // Ruby 2.6.x
  '2.6.10': 'ruby:2.6.10-alpine',
  '2.6.9': 'ruby:2.6.9-alpine',
  '2.6.8': 'ruby:2.6.8-alpine',
  '2.6.7': 'ruby:2.6.7-alpine',
  '2.6.6': 'ruby:2.6.6-alpine',
  '2.6.5': 'ruby:2.6.5-alpine',
  '2.6.4': 'ruby:2.6.4-alpine',
  '2.6.3': 'ruby:2.6.3-alpine',
  '2.6.2': 'ruby:2.6.2-alpine',
  '2.6.1': 'ruby:2.6.1-alpine',
  '2.6.0': 'ruby:2.6.0-alpine',
  
  // Ruby 2.5.x
  '2.5.9': 'ruby:2.5.9-alpine',
  '2.5.8': 'ruby:2.5.8-alpine',
  '2.5.7': 'ruby:2.5.7-alpine',
  '2.5.6': 'ruby:2.5.6-alpine',
  '2.5.5': 'ruby:2.5.5-alpine',
  '2.5.4': 'ruby:2.5.4-alpine',
  '2.5.3': 'ruby:2.5.3-alpine',
  '2.5.1': 'ruby:2.5.1-alpine',
  '2.5.0': 'ruby:2.5.0-alpine',
  
  // Ruby 2.4.x
  '2.4.10': 'ruby:2.4.10-alpine',
  '2.4.9': 'ruby:2.4.9-alpine',
  '2.4.8': 'ruby:2.4.8-alpine',
  '2.4.7': 'ruby:2.4.7-alpine',
  '2.4.6': 'ruby:2.4.6-alpine',
  '2.4.5': 'ruby:2.4.5-alpine',
  '2.4.4': 'ruby:2.4.4-alpine',
  '2.4.3': 'ruby:2.4.3-alpine',
  '2.4.2': 'ruby:2.4.2-alpine',
  '2.4.1': 'ruby:2.4.1-alpine',
  '2.4.0': 'ruby:2.4.0-alpine',
  
  // Ruby 2.3.x
  '2.3.8': 'ruby:2.3.8-alpine',
  '2.3.7': 'ruby:2.3.7-alpine',
  '2.3.6': 'ruby:2.3.6-alpine',
  '2.3.5': 'ruby:2.3.5-alpine',
  '2.3.4': 'ruby:2.3.4-alpine',
  '2.3.3': 'ruby:2.3.3-alpine',
  '2.3.2': 'ruby:2.3.2-alpine',
  
  // Ruby 2.2.x
  '2.2.10': 'ruby:2.2.10-alpine',
  '2.2.9': 'ruby:2.2.9-alpine',
  '2.2.8': 'ruby:2.2.8-alpine',
  '2.2.7': 'ruby:2.2.7-alpine',
  '2.2.6': 'ruby:2.2.6-alpine',
  '2.2.5': 'ruby:2.2.5-alpine'
};

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

app.listen(PORT, async () => {
  console.log(`\nServeur Ruby Online IDE démarré sur http://localhost:${PORT}`);
  console.log(`Versions Ruby configurées: ${Object.keys(RUBY_VERSIONS).length}`);
  
  const images = await docker.listImages();
  const availableCount = Object.values(RUBY_VERSIONS).filter(image => 
    images.some(img => img.RepoTags && img.RepoTags.includes(image))
  ).length;
  
  console.log(` Images Docker disponibles: ${availableCount}/${Object.keys(RUBY_VERSIONS).length}`);
  
  if (availableCount === 0) {
    console.log(`\nATTENTION: Aucune image Ruby trouvée!`);
  }
  
  console.log(`\nAPI prête à recevoir des requêtes!`);
  console.log(`   GET  /api/versions     - Liste des versions disponibles`);
  console.log(`   POST /api/execute      - Exécuter du code Ruby`);
});