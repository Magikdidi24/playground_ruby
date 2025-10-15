import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import './App.css';

function App() {
  const [code, setCode] = useState(`puts "Bonjour depuis Ruby!"
puts "Version: #{RUBY_VERSION}"
puts "Plateforme: #{RUBY_PLATFORM}"`);
  const [output, setOutput] = useState('Cliquez sur "Exécuter"');
  const [version, setVersion] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [outputType, setOutputType] = useState('info');
  const [rubyVersions, setRubyVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [groupedVersions, setGroupedVersions] = useState({});
  const [executionTime, setExecutionTime] = useState(null);
  
  // File management states
  const [currentFilename, setCurrentFilename] = useState("main.rb");
  const [workspaceId, setWorkspaceId] = useState("default");
  const [files, setFiles] = useState([]);
  const [newFilename, setNewFilename] = useState("");
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Load workspace files
  const loadWorkspaceFiles = async () => {
    try {
      const res = await axios.get(`/api/workspace/${workspaceId}/files`);
      if (res.data.success) {
        setFiles(res.data.files);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des fichiers:', error);
    }
  };

  // Load a specific file
  const loadFile = async (filename) => {
    try {
      const res = await axios.get(`/api/workspace/${workspaceId}/file/${filename}`);
      if (res.data.success) {
        setCode(res.data.content);
        setCurrentFilename(filename);
        setOutput(`Fichier "${filename}" chargé`);
        setOutputType('info');
      }
    } catch (error) {
      setOutput(`Erreur lors du chargement du fichier: ${error.response?.data?.error || error.message}`);
      setOutputType('error');
    }
  };

  // Upload de fichiers
  const handleFileUpload = async (event) => {
    const uploadedFiles = Array.from(event.target.files);
    
    if (uploadedFiles.length === 0) return;
    
    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of uploadedFiles) {
      if (!file.name.endsWith('.rb')) {
        alert(`"${file.name}" ignoré : seuls les fichiers .rb sont acceptés`);
        errorCount++;
        continue;
      }
      
      try {
        const content = await file.text();
        const res = await axios.post('/api/workspace/save', {
          workspaceId,
          filename: file.name,
          content
        });
        
        if (res.data.success) {
          successCount++;
        }
      } catch (error) {
        console.error(`Erreur upload ${file.name}:`, error);
        errorCount++;
      }
    }
    
    setIsUploading(false);
    loadWorkspaceFiles();
    
    if (successCount > 0) {
      setOutput(`✓ ${successCount} fichier(s) importé(s)`);
      setOutputType('info');
    }
    
    if (errorCount > 0) {
      alert(`${errorCount} fichier(s) n'ont pas pu être importés`);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Save current file
  const saveFile = async () => {
    setIsSaving(true);
    setSaveMessage("");
    try {
      const res = await axios.post('/api/workspace/save', {
        workspaceId,
        filename: currentFilename,
        content: code
      });
      
      if (res.data.success) {
        setSaveMessage(`✓ ${currentFilename} sauvegardé`);
        setTimeout(() => setSaveMessage(""), 3000);
        loadWorkspaceFiles(); // Refresh file list
      }
    } catch (error) {
      setSaveMessage(`✗ Erreur: ${error.response?.data?.error || error.message}`);
      setOutputType('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Create new file
  const createNewFile = async () => {
    if (!newFilename.trim()) {
      alert("Veuillez entrer un nom de fichier");
      return;
    }
    
    const filename = newFilename.endsWith('.rb') ? newFilename : `${newFilename}.rb`;
    
    try {
      const res = await axios.post('/api/workspace/save', {
        workspaceId,
        filename,
        content: "# Nouveau fichier Ruby\n"
      });
      
      if (res.data.success) {
        setCurrentFilename(filename);
        setCode("# Nouveau fichier Ruby\n");
        setNewFilename("");
        setShowNewFileInput(false);
        loadWorkspaceFiles();
        setOutput(`Fichier "${filename}" créé`);
        setOutputType('info');
      }
    } catch (error) {
      alert(`Erreur: ${error.response?.data?.error || error.message}`);
    }
  };

  // Delete file
  const deleteFile = async (filename) => {
    if (!confirm(`Voulez-vous vraiment supprimer "${filename}" ?`)) {
      return;
    }
    
    try {
      const res = await axios.delete(`/api/workspace/${workspaceId}/file/${filename}`);
      if (res.data.success) {
        loadWorkspaceFiles();
        if (currentFilename === filename) {
          setCurrentFilename("main.rb");
          setCode(`puts "Bonjour depuis Ruby!"`);
        }
        setOutput(`Fichier "${filename}" supprimé`);
        setOutputType('info');
      }
    } catch (error) {
      alert(`Erreur: ${error.response?.data?.error || error.message}`);
    }
  };

  useEffect(() => {
    loadWorkspaceFiles();
  }, [workspaceId]);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const res = await axios.get('/api/versions');
        if (res.data.success) {
          setRubyVersions(res.data.availableVersions);
          setGroupedVersions(res.data.groupedByMinorVersion);
          
          const defaultVersion = res.data.recommendedVersions?.latest || res.data.availableVersions[0];
          if (defaultVersion) {
            setVersion(defaultVersion);
          }
        } else {
          console.error('Erreur lors de la récupération des versions:', res.data.error);
          setOutput('Erreur: Impossible de récupérer les versions Ruby disponibles.');
          setOutputType('error');
        }
      } catch (err) {
        console.error('Erreur de connexion au backend:', err.message);
        setOutput(`Erreur de connexion au serveur backend.\n\nAssurez-vous que le serveur Node.js est démarré sur le port 5000.\n\nDétails: ${err.message}`);
        setOutputType('error');
      } finally {
        setVersionsLoading(false);
      }
    };
    fetchVersions();
  }, []);

  const handleRunCode = async () => {
    if (!code.trim()) {
      setOutput('Veuillez entrer du code à exécuter.');
      setOutputType('error');
      return;
    }

    setIsRunning(true);
    setOutputType('loading');
    setExecutionTime(null);

    try {
      const response = await axios.post('/api/execute', { code, version }, { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });
      
      if (response.data.success) {
        setOutput(response.data.output);
        setOutputType('success');
        setExecutionTime(response.data.executionTime);
      } else {
        setOutput(response.data.error);
        setOutputType('error');
      }
    } catch (error) {
      let errorMessage = 'Erreur de connexion au serveur';
      if (error.response) {
        errorMessage = error.response.data?.error || error.response.statusText || errorMessage;
      } else if (error.request) {
        errorMessage = 'Le serveur ne répond pas. Vérifiez que le backend est démarré sur le port 5000.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Timeout: L\'exécution a pris trop de temps (max 15s)';
      } else {
        errorMessage = error.message;
      }
      setOutput(`Erreur: ${errorMessage}\n\nDétails: ${error.message}`);
      setOutputType('error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleClear = () => {
    setCode('');
    setOutput('Cliquez sur "Exécuter"');
    setOutputType('info');
    setExecutionTime(null);
  };

  // Exemples de code
  const examples = {
    hello: `puts "Bonjour depuis Ruby!"
puts "Version: #{RUBY_VERSION}"`,
    
    fibonacci: `def fibonacci(n)
  return n if n <= 1
  fibonacci(n - 1) + fibonacci(n - 2)
end

puts "Fibonacci(10) = #{fibonacci(10)}"`,
    
    array: `# Manipulation de tableaux
nombres = [1, 2, 3, 4, 5]
puts "Original: #{nombres.inspect}"
puts "Doublés: #{nombres.map { |n| n * 2 }.inspect}"
puts "Somme: #{nombres.sum}"`,
    
    hash: `# Travail avec des hash
personne = {
  nom: "Alice",
  age: 30,
  ville: "Paris"
}

personne.each do |key, value|
  puts "#{key}: #{value}"
end`,

    class: `# Définition d'une classe
class Voiture
  attr_accessor :marque, :modele, :annee
  
  def initialize(marque, modele, annee)
    @marque = marque
    @modele = modele
    @annee = annee
  end
  
  def afficher
    puts "#{@marque} #{@modele} (#{@annee})"
  end
end

voiture = Voiture.new("Toyota", "Corolla", 2023)
voiture.afficher`
  };

  const loadExample = (exampleKey) => {
    setCode(examples[exampleKey]);
    setOutput('Exemple chargé. Cliquez sur "Exécuter"');
    setOutputType('info');
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1><div className="logo">Rb</div>Ruby Online IDE</h1>
          <div className="subtitle">
            Exécutez votre code Ruby en ligne • {rubyVersions.length} versions disponibles
          </div>
        </header>

        <div className="controls">
          <div className="control-group">
            <label htmlFor="version">
              Version Ruby 
            </label>
            <select 
              id="version" 
              value={version} 
              onChange={(e) => setVersion(e.target.value)}
              disabled={isRunning || versionsLoading || rubyVersions.length === 0}
              className="version-select"
            >
              {versionsLoading ? (
                <option value="">Chargement des versions...</option>
              ) : rubyVersions.length > 0 ? (
                <>
                  {Object.entries(groupedVersions).map(([minorVersion, versions]) => (
                    <optgroup key={minorVersion} label={`Ruby ${minorVersion}.x`}>
                      {versions.map(v => (
                        <option key={v} value={v}>
                          {v} {v === version ? '(actuelle)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </>
              ) : (
                <option value="">Aucune version disponible</option>
              )}
            </select>
          </div>

          <div className="examples-group">
            <label>Exemples</label>
            <div className="examples-buttons">
              <button className="btn-example" onClick={() => loadExample('hello')} disabled={isRunning}>
                Hello
              </button>
              <button className="btn-example" onClick={() => loadExample('fibonacci')} disabled={isRunning}>
                Fibonacci
              </button>
              <button className="btn-example" onClick={() => loadExample('array')} disabled={isRunning}>
                Array
              </button>
              <button className="btn-example" onClick={() => loadExample('hash')} disabled={isRunning}>
                Hash
              </button>
              <button className="btn-example" onClick={() => loadExample('class')} disabled={isRunning}>
                Class
              </button>
            </div>
          </div>

          <div className="button-group">
            <button 
              className="btn btn-run" 
              onClick={handleRunCode} 
              disabled={isRunning || rubyVersions.length === 0}
            >
              {isRunning ? 'Exécution...' : 'Exécuter'}
            </button>
            <button className="btn btn-clear" onClick={handleClear} disabled={isRunning}>
              Effacer
            </button>
          </div>
        </div>

        <div className="main-layout">
          {/* File Explorer Sidebar */}
          <div className="file-explorer">
            <div className="file-explorer-header">
              <h3>📁 Fichiers</h3>
              <div className="header-buttons">
                <button 
                  className="btn-new-file"
                  onClick={() => setShowNewFileInput(!showNewFileInput)}
                  title="Nouveau fichier"
                >
                  +
                </button>
                <button 
                  className="btn-upload-file"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Importer des fichiers .rb"
                >
                  {isUploading ? '⏳' : '📤'}
                </button>
              </div>
            </div>

            {/* Input caché pour l'upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".rb"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />

            {showNewFileInput && (
              <div className="new-file-input">
                <input
                  type="text"
                  placeholder="nom_fichier.rb"
                  value={newFilename}
                  onChange={(e) => setNewFilename(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createNewFile()}
                />
                <button onClick={createNewFile} className="btn-confirm">✓</button>
                <button onClick={() => {
                  setShowNewFileInput(false);
                  setNewFilename("");
                }} className="btn-cancel">✗</button>
              </div>
            )}

            <div className="file-list">
              {files.length === 0 ? (
                <div className="no-files">Aucun fichier</div>
              ) : (
                files.map(file => (
                  <div 
                    key={file}
                    className={`file-item ${currentFilename === file ? 'active' : ''}`}
                  >
                    <span 
                      className="file-name"
                      onClick={() => loadFile(file)}
                    >
                      📄 {file}
                    </span>
                    <button
                      className="btn-delete-file"
                      onClick={() => deleteFile(file)}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Editor and Output */}
          <div className="editor-output-container">
            <div className="file-actions">
              <div className="current-file-info">
                <span className="current-file-label">Fichier actuel:</span>
                <span className="current-file-name">{currentFilename}</span>
              </div>
              
              <div className="file-buttons">
                {saveMessage && (
                  <span className={`save-message ${saveMessage.startsWith('✓') ? 'success' : 'error'}`}>
                    {saveMessage}
                  </span>
                )}
                <button 
                  className="btn btn-save" 
                  onClick={saveFile}
                  disabled={isSaving}
                >
                  {isSaving ? '💾 Sauvegarde...' : '💾 Sauvegarder'}
                </button>
              </div>
            </div>

            <div className="editor-container">
              <div className="editor-panel">
                <div className="panel-header">
                  Source File
                </div>
                
                <Editor
                  height="100%"
                  defaultLanguage="ruby"
                  theme="vs-dark"
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    cursorBlinking: 'smooth',
                    smoothScrolling: true,
                  }}
                />
              </div>

              <div className="output-panel">
                <div className="panel-header">
                  stdout
                  {executionTime && (
                    <span className="execution-badge">{executionTime}</span>
                  )}
                </div>
                <pre className={`output output-${outputType}`}>
                  {output}
                </pre>
              </div>
            </div>
          </div>
        </div>

        <footer className="footer">
          <div className="footer-content">
            Workspace: <strong>{workspaceId}</strong>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;