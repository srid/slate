import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';

import { readTextFile, writeTextFile, exists, watch, type UnwatchFn, type WatchEvent } from '@tauri-apps/plugin-fs';
import WysiwygEditor from './components/WysiwygEditor';
import FileFinder from './components/FileFinder';
import { scanVault, type FileEntry } from './services/fileService';

// Vault directory relative to home
const VAULT_ROOT_RELATIVE = 'Dropbox/Vault';

function App() {
  console.log('[App] Rendering...');
  // Multi-file state
  const [files, setFiles] = createSignal<FileEntry[]>([]);
  const [currentFile, setCurrentFile] = createSignal<FileEntry | null>(null);
  const [finderOpen, setFinderOpen] = createSignal(false);

  // Editor state
  const [content, setContent] = createSignal('');
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [isScanning, setIsScanning] = createSignal(true); // Vault scan in progress
  const [isDirty, setIsDirty] = createSignal(false);
  const [isDark, setIsDark] = createSignal(false);
  const [saveStatus, setSaveStatus] = createSignal<'saved' | 'saving' | 'idle' | 'reloaded'>('idle');
  const [error, setError] = createSignal<string | null>(null);
  const [editorKey, setEditorKey] = createSignal(0);

  let saveTimeout: number | undefined;
  let unwatchFn: UnwatchFn | null = null;
  let isWriting = false;

  const isModifyOrCreateEvent = (event: WatchEvent): boolean => {
    const type = event.type;
    if (typeof type === 'object') {
      return 'modify' in type || 'create' in type;
    }
    return false;
  };

  // Save current file immediately (used before switching)
  const saveCurrentFile = async (): Promise<void> => {
    const file = currentFile();
    if (!file || !isDirty()) return;

    if (saveTimeout) clearTimeout(saveTimeout);

    try {
      isWriting = true;
      await writeTextFile(file.path, content());
      isWriting = false;
      setIsDirty(false);
    } catch (err) {
      isWriting = false;
      console.error('Failed to save file:', err);
    }
  };

  // Load a file into the editor
  const loadFile = async (file: FileEntry): Promise<void> => {
    // Save current file first if dirty
    await saveCurrentFile();

    // Cleanup previous watcher
    if (unwatchFn) {
      await unwatchFn();
      unwatchFn = null;
    }

    setIsLoaded(false);
    setError(null);

    try {
      const fileExists = await exists(file.path);
      if (fileExists) {
        const text = await readTextFile(file.path);
        setContent(text);
      } else {
        setError(`File not found: ${file.relativePath}`);
        return;
      }

      setCurrentFile(file);
      setIsDirty(false);
      setEditorKey(k => k + 1);
      setIsLoaded(true);

      // Watch for external changes
      unwatchFn = await watch(file.path, async (event) => {
        if (isWriting) return;

        if (isModifyOrCreateEvent(event)) {
          try {
            const newContent = await readTextFile(file.path);
            if (newContent !== content()) {
              setContent(newContent);
              setEditorKey(k => k + 1);
              setIsDirty(false);
              setSaveStatus('reloaded');
              setTimeout(() => setSaveStatus('idle'), 1500);
            }
          } catch (err) {
            console.error('Failed to reload file:', err);
          }
        }
      });
    } catch (err) {
      setError(`Failed to load file: ${err}`);
      console.error('Failed to load file:', err);
    }
  };

  // Handle file selection from finder
  const handleFileSelect = (file: FileEntry) => {
    setFinderOpen(false);
    loadFile(file);
  };

  // Initialize on mount
  onMount(async () => {
    // Theme
    const stored = localStorage.getItem('slate-theme');
    const prefersDark = stored === 'dark';
    setIsDark(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);

    // Scan vault for markdown files
    setIsScanning(true);
    try {
      const vaultFiles = await scanVault(VAULT_ROOT_RELATIVE);
      setFiles(vaultFiles);
      setIsScanning(false);

      // Load first file if available
      if (vaultFiles.length > 0) {
        await loadFile(vaultFiles[0]);
      } else {
        setError('No markdown files found in vault');
        setIsLoaded(true);
      }
    } catch (err) {
      setIsScanning(false);
      setError(`Failed to scan vault: ${err}`);
      console.error('Failed to scan vault:', err);
      setIsLoaded(true);
    }

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setFinderOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  // Cleanup watcher on unmount
  onCleanup(async () => {
    if (unwatchFn) {
      await unwatchFn();
    }
  });

  const toggleTheme = () => {
    const newDark = !isDark();
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('slate-theme', newDark ? 'dark' : 'light');
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
    setError(null);

    const file = currentFile();
    if (!file) return;

    // Debounced auto-save
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(async () => {
      try {
        setSaveStatus('saving');
        isWriting = true;
        await writeTextFile(file.path, newContent);
        isWriting = false;
        setIsDirty(false);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      } catch (err) {
        isWriting = false;
        setError(`Auto-save failed: ${err}`);
        console.error('Auto-save failed:', err);
      }
    }, 500);
  };

  const getDisplayPath = () => {
    const file = currentFile();
    return file ? file.relativePath : 'No file';
  };

  return (
    <div class="flex flex-col h-screen bg-[var(--color-bg-primary)]">
      {/* File Finder Modal */}
      <FileFinder
        files={files()}
        isOpen={finderOpen()}
        onClose={() => setFinderOpen(false)}
        onSelect={handleFileSelect}
      />

      {/* Error Banner */}
      <Show when={error()}>
        <div class="px-4 py-2 bg-red-500/20 border-b border-red-500/50 text-red-400 text-sm">
          ⚠️ {error()}
        </div>
      </Show>

      {/* Toolbar */}
      <header class="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-semibold text-[var(--color-text-primary)]">Slate</h1>
          <button
            class="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
            onClick={() => setFinderOpen(true)}
            title="Open file (Ctrl+P)"
          >
            {isScanning() ? 'Scanning vault...' : getDisplayPath()}
            {saveStatus() === 'saving' && <span class="text-[var(--color-text-muted)] ml-2">Saving...</span>}
            {saveStatus() === 'saved' && <span class="text-green-500 ml-2">Saved</span>}
            {saveStatus() === 'reloaded' && <span class="text-blue-500 ml-2">Reloaded</span>}
            {isDirty() && saveStatus() === 'idle' && <span class="text-[var(--color-accent)] ml-1">•</span>}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button class="toolbar-button" onClick={toggleTheme} title={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark() ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* WYSIWYG Editor */}
      <main class="flex-1 overflow-hidden">
        <Show when={isLoaded() && currentFile()} fallback={<div class="p-4 text-[var(--color-text-muted)]">Loading...</div>}>
          <For each={[editorKey()]}>
            {(_key) => <WysiwygEditor content={content()} onContentChange={handleContentChange} />}
          </For>
        </Show>
      </main>
    </div>
  );
}



function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default App;
