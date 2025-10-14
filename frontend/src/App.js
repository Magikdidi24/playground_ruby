import { useState, useEffect } from 'react';
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
      setOutput(`frontend ${errorMessage}\n\nDétails: ${error.message}`);
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

        <footer className="footer">
          <div className="footer-content">
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;