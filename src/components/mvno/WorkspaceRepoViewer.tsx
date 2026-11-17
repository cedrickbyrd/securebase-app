import React, { useEffect, useState, useMemo } from 'react';
import {
  FileCode2,
  Download,
  Copy,
  Check,
  Search,
  AlertCircle,
  FolderArchive
} from 'lucide-react';
import {
  fetchWorkspaceRepoTree,
  downloadWorkspaceRepoZip,
  WorkspaceRepoFile
} from '../../services/mvnoApiService';

type CategoryFilter =
  | 'all'
  | 'terraform'
  | 'rego'
  | 'core'
  | 'service'
  | 'schema'
  | 'workflow'
  | 'script'
  | 'docs';

export const WorkspaceRepoViewer: React.FC = () => {
  const [files, setFiles] = useState<WorkspaceRepoFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRepo = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchWorkspaceRepoTree();
      setFiles(data.files);
      if (data.files.length > 0) {
        const preferred =
          data.files.find((f) => f.path.endsWith('corelink-mcp-server/main.go')) || data.files[0];
        setSelectedPath(preferred.path);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to inspect workspace repository');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRepo();
  }, []);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return files.filter((f) => {
      const matchesCat = category === 'all' || f.category === category;
      const matchesSearch =
        !q || f.path.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [files, category, searchQuery]);

  const selectedFile = useMemo(() => {
    return (
      filteredFiles.find((f) => f.path === selectedPath) ||
      filteredFiles[0] ||
      files.find((f) => f.path === selectedPath) ||
      files[0] ||
      null
    );
  }, [filteredFiles, files, selectedPath]);

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    setErrorMsg(null);
    try {
      await downloadWorkspaceRepoZip();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ZIP bundle export failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyCode = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="space-y-5">
      {/* Top Action Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FolderArchive className="w-4 h-4 text-cyan-400" />
            <span>Workspace Repository: securebase-mvno/ ({files.length} files on disk)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Live files read directly from the workspace scaffold (Terraform, OPA Rego, free5GC Helm/K8s, Go CoreLink MCP, JSON Schemas) with binary ZIP packaging.
          </p>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={isDownloading || files.length === 0}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{isDownloading ? 'Packaging ZIP...' : 'Download Repo (.zip)'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-xs font-mono text-rose-300 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </span>
          <button
            onClick={loadRepo}
            className="px-3 py-1 bg-rose-900/50 border border-rose-700 rounded text-white cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search & Category Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'terraform', label: 'Terraform' },
              { id: 'rego', label: 'Rego' },
              { id: 'core', label: '5G Core' },
              { id: 'service', label: 'Services (Go/TS)' },
              { id: 'schema', label: 'Schemas' },
              { id: 'workflow', label: 'CI/CD' },
              { id: 'script', label: 'Scripts' },
              { id: 'docs', label: 'Docs' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                category === tab.id
                  ? 'bg-slate-800 border-cyan-500/60 text-cyan-300 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter file path..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
          />
        </div>
      </div>

      {/* File Tree + Code Viewer Split */}
      {isLoading ? (
        <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs font-mono text-slate-400">
          Loading workspace repository files from disk...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1 max-h-[520px] overflow-y-auto">
            {filteredFiles.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-400">
                No files match &quot;{searchQuery}&quot; in this category.
              </div>
            ) : (
              filteredFiles.map((node) => {
                const isSelected = selectedFile?.path === node.path;
                return (
                  <button
                    key={node.path}
                    onClick={() => setSelectedPath(node.path)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-slate-800 text-cyan-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <FileCode2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="truncate">{node.path}</div>
                        <div className="text-[11px] font-sans text-slate-400 font-normal mt-0.5 line-clamp-1">
                          {node.summary}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 tabular-nums shrink-0 mt-0.5">
                      {node.sizeBytes} B
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl flex flex-col overflow-hidden max-h-[520px]">
            {selectedFile ? (
              <>
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-white font-semibold truncate">
                      securebase-mvno/{selectedFile.path}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {selectedFile.language} · {selectedFile.sizeBytes.toLocaleString()} bytes · {selectedFile.summary}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="px-3 py-1.5 text-xs font-mono text-slate-200 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 text-xs font-mono text-slate-200 overflow-auto leading-relaxed flex-1">
                  <code>{selectedFile.code}</code>
                </pre>
              </>
            ) : (
              <div className="p-8 text-center text-xs font-mono text-slate-400">
                Select a file from the repository tree to inspect its contents.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
