
import React, { useState, useCallback } from 'react';
import type { PositiveEntry } from './types';
import { analyzeStatement } from './services/geminiService';
import { FileUpload } from './components/FileUpload';
import { ResultsTable } from './components/ResultsTable';
import { MonthlyAnalysisTable } from './components/MonthlyAnalysisTable';
import { Loader } from './components/Loader';
import { LogoIcon, AlertTriangleIcon, FileTextIcon, EditIcon } from './components/icons';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [positiveEntries, setPositiveEntries] = useState<PositiveEntry[]>([]);
  const [extractedClientName, setExtractedClientName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [editableName, setEditableName] = useState<string>('');

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setPositiveEntries([]);
    setError(null);
    setExtractedClientName('');
    setEditableName('');
    setIsEditingName(false);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleFileClear = () => {
    setFile(null);
    setPreview(null);
    setPositiveEntries([]);
    setExtractedClientName('');
    setError(null);
    setEditableName('');
    setIsEditingName(false);
  }

  const handleAnalyzeClick = useCallback(async () => {
    if (!file) {
      setError("Por favor, selecione um arquivo de extrato primeiro.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPositiveEntries([]);
    setExtractedClientName('');
    setEditableName('');
    setIsEditingName(false);

    try {
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result?.split(',')[1];
          if (base64) {
            resolve(base64);
          } else {
            reject(new Error("Não foi possível ler o conteúdo do arquivo."));
          }
        };
        reader.onerror = () => {
          reject(new Error("Ocorreu um erro ao ler o arquivo."));
        };
      });

      const result = await analyzeStatement(base64String, file.type);
      setPositiveEntries(result.positiveEntries);
      setExtractedClientName(result.clientName);
      setEditableName(result.clientName);

    } catch (err: any) {
      setError(err.message || "Ocorreu um erro desconhecido ao analisar o extrato.");
      setPositiveEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [file]);

  const handleEditName = () => {
    setEditableName(extractedClientName);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
      if(editableName.trim()) {
        setExtractedClientName(editableName);
      }
      setIsEditingName(false);
  };

  const handleCancelName = () => {
      setIsEditingName(false);
  };

  return (
    <div className="min-h-screen bg-slate-100/50 font-sans text-slate-800 antialiased">
      <main className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-3 mb-2">
            <LogoIcon className="h-10 w-10 text-emerald-500" />
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Analisador de Extratos
            </h1>
          </div>
          <p className="text-lg text-slate-600">
            Envie a imagem ou PDF do seu extrato bancário e a IA irá tabular todos os valores positivos para você.
          </p>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white shadow-lg p-6 md:p-8">
          {!file && <FileUpload onFileSelect={handleFileSelect} />}
          
          {file && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {preview && (
                  file.type.startsWith('image/') ? (
                    <img src={preview} alt="Prévia do extrato" className="w-full sm:w-48 h-auto object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="w-full sm:w-48 h-48 flex flex-col items-center justify-center bg-slate-100 rounded-lg border border-slate-200 text-slate-500">
                      <FileTextIcon className="w-16 h-16" />
                      <span className="mt-2 text-sm font-medium">Arquivo PDF</span>
                    </div>
                  )
                )}
                <div className="flex-grow">
                  <h3 className="font-semibold text-slate-800">Arquivo Selecionado:</h3>
                  <p className="text-slate-600 break-all">{file.name}</p>
                  <p className="text-sm text-slate-500">{Math.round(file.size / 1024)} KB</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAnalyzeClick}
                  disabled={isLoading}
                  className="w-full sm:w-auto flex-grow justify-center inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Analisando...' : 'Analisar Extrato'}
                </button>
                 <button
                  onClick={handleFileClear}
                  disabled={isLoading}
                  className="w-full sm:w-auto justify-center inline-flex items-center px-6 py-3 border border-slate-300 text-base font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-colors"
                >
                  Trocar Arquivo
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading && <Loader />}
        
        {error && (
          <div className="mt-8 p-4 bg-red-100 border border-red-200 text-red-800 rounded-lg flex items-start gap-3">
            <AlertTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
                <h4 className="font-bold">Erro na Análise</h4>
                <p className="whitespace-pre-wrap text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {positiveEntries.length > 0 && !isLoading && (
          <>
            <div className="mt-8">
               <div className="mb-4">
                <h2 className="text-2xl font-semibold text-slate-800">Análise Mensal</h2>
                 <div className="mt-1 text-slate-600">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">Análise para:</span>
                        <input
                            type="text"
                            value={editableName}
                            onChange={(e) => setEditableName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                            className="flex-grow rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-1"
                            autoFocus
                        />
                        <button onClick={handleSaveName} className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">Salvar</button>
                        <button onClick={handleCancelName} className="rounded-md bg-white px-3 py-1 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Cancelar</button>
                    </div>
                  ) : (
                    <>
                    {extractedClientName && (
                        <p>
                            Análise para: <span className="font-semibold text-slate-800">{extractedClientName}</span>
                            <button onClick={handleEditName} className="ml-2 inline-flex items-center text-slate-500 hover:text-slate-800" aria-label="Editar nome do cliente">
                                <EditIcon className="h-4 w-4" />
                            </button>
                        </p>
                    )}
                    </>
                  )}
                </div>
              </div>
              <MonthlyAnalysisTable entries={positiveEntries} clientName={extractedClientName} />
            </div>
            <div className="mt-8">
              <ResultsTable entries={positiveEntries} setEntries={setPositiveEntries} />
            </div>
          </>
        )}

      </main>
       <footer className="text-center py-6 text-sm text-slate-500">
          <p>Desenvolvido com React, Tailwind CSS e a API Google Gemini.</p>
      </footer>
    </div>
  );
};

export default App;