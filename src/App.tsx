import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';

import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
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
  const [saveStatus, setSaveStatus] = createSignal<'saved' | 'saving' | 'idle'>('idle');
  const [error, setError] = createSignal<string | null>(null);
  const [editorKey, setEditorKey] = createSignal(0);

  // Navigation history
  const [history, setHistory] = createSignal<FileEntry[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(-1);

  let saveTimeout: number | undefined;

  // Save current file immediately (used before switching)
  const saveCurrentFile = async (): Promise<void> => {
    const file = currentFile();
    if (!file || !isDirty()) return;

    if (saveTimeout) clearTimeout(saveTimeout);

    try {
      await writeTextFile(file.path, content());
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  // Load a file into the editor
  const loadFile = async (file: FileEntry): Promise<void> => {
    // Save current file first if dirty
    await saveCurrentFile();

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
    } catch (err) {
      setError(`Failed to load file: ${err}`);
      console.error('Failed to load file:', err);
    }
  };

  // Handle file selection from finder or wikilink
  const handleFileSelect = (file: FileEntry, addToHistory = true) => {
    setFinderOpen(false);

    // Add to history if not navigating via back/forward
    if (addToHistory) {
      const current = currentFile();
      if (current) {
        // Truncate forward history and add current file
        const newHistory = [...history().slice(0, historyIndex() + 1), current];
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    }

    loadFile(file);
  };

  // Navigation: Go Back
  const canGoBack = () => historyIndex() >= 0;
  const goBack = () => {
    if (!canGoBack()) return;
    const idx = historyIndex();
    const file = history()[idx];
    setHistoryIndex(idx - 1);
    handleFileSelect(file, false);
  };

  // Navigation: Go Forward
  const canGoForward = () => {
    const idx = historyIndex();
    const h = history();
    // Can go forward if there's a current file and we're not at the end
    return idx < h.length - 1 || (idx === h.length - 1 && currentFile() !== null);
  };
  const goForward = () => {
    if (!canGoForward()) return;
    const idx = historyIndex();
    const h = history();
    if (idx < h.length - 1) {
      const nextFile = h[idx + 1];
      setHistoryIndex(idx + 1);
      handleFileSelect(nextFile, false);
    }
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

      // Load INBOX.md by default, or first file if not found
      if (vaultFiles.length > 0) {
        const inbox = vaultFiles.find(f => f.name.toLowerCase() === 'inbox.md');
        await loadFile(inbox || vaultFiles[0]);
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

    // Mouse back/forward buttons
    const handleMouseNav = (e: MouseEvent) => {
      if (e.button === 3) { // Back button
        e.preventDefault();
        goBack();
      } else if (e.button === 4) { // Forward button
        e.preventDefault();
        goForward();
      }
    };
    document.addEventListener('mouseup', handleMouseNav);
    onCleanup(() => document.removeEventListener('mouseup', handleMouseNav));
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
        await writeTextFile(file.path, newContent);
        setIsDirty(false);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      } catch (err) {
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
            {isDirty() && saveStatus() === 'idle' && <span class="text-[var(--color-accent)] ml-1">•</span>}
          </button>
        </div>
        <div class="flex items-center gap-2">
          {/* Back/Forward navigation */}
          <button
            class="toolbar-button"
            onClick={goBack}
            disabled={!canGoBack()}
            title="Go back (Alt+Left)"
            style={{ opacity: canGoBack() ? 1 : 0.4 }}
          >
            <BackIcon />
          </button>
          <button
            class="toolbar-button"
            onClick={goForward}
            disabled={!canGoForward()}
            title="Go forward (Alt+Right)"
            style={{ opacity: canGoForward() ? 1 : 0.4 }}
          >
            <ForwardIcon />
          </button>
          <button class="toolbar-button" onClick={toggleTheme} title={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark() ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* WYSIWYG Editor */}
      <main class="flex-1 overflow-hidden">
        <Show when={isLoaded() && currentFile()} fallback={<div class="p-4 text-[var(--color-text-muted)]">Loading...</div>}>
          <For each={[editorKey()]}>
            {(_key) => <WysiwygEditor
              content={content()}
              onContentChange={handleContentChange}
              files={files()}
              onNavigate={handleFileSelect}
            />}
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

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default App;
