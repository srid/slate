import { onMount, onCleanup, Show, For } from 'solid-js';

import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import WysiwygEditor from './components/WysiwygEditor';
import FileFinder from './components/FileFinder';
import { scanVault, type FileEntry } from './services/fileService';
import { createAppStore, AppStoreProvider } from './store/appStore';

// Vault directory relative to home
const VAULT_ROOT_RELATIVE = 'Dropbox/Vault';

const APP_START = performance.now();
console.log('[App] Module loaded at:', APP_START.toFixed(0), 'ms');

function App() {
  console.log('[App] Rendering at:', (performance.now() - APP_START).toFixed(0), 'ms since module load');
  const [state, setState] = createAppStore();

  let saveTimeout: number | undefined;

  // Save current file immediately (used before switching)
  const saveCurrentFile = async (): Promise<void> => {
    const file = state.vault.currentFile;
    if (!file || !state.editor.isDirty) return;

    if (saveTimeout) clearTimeout(saveTimeout);

    try {
      await writeTextFile(file.path, state.editor.content);
      setState('editor', 'isDirty', false);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  // Load a file into the editor
  const loadFile = async (file: FileEntry): Promise<void> => {
    // Save current file first if dirty
    await saveCurrentFile();

    setState('editor', 'isLoaded', false);
    setState('ui', 'error', null);

    try {
      const fileExists = await exists(file.path);
      if (fileExists) {
        const text = await readTextFile(file.path);
        setState('editor', 'content', text);
      } else {
        setState('ui', 'error', `File not found: ${file.relativePath}`);
        return;
      }

      setState('vault', 'currentFile', file);
      setState('editor', 'isDirty', false);
      setState('editor', 'key', k => k + 1);
      setState('editor', 'isLoaded', true);
    } catch (err) {
      setState('ui', 'error', `Failed to load file: ${err}`);
      console.error('Failed to load file:', err);
    }
  };

  // Handle file selection from finder or wikilink
  const handleFileSelect = (file: FileEntry, addToHistory = true) => {
    setState('ui', 'finderOpen', false);

    // Add to history if not navigating via back/forward
    if (addToHistory) {
      const current = state.vault.currentFile;
      if (current) {
        // Truncate forward history and add current file
        const newHistory = [...state.history.entries.slice(0, state.history.index + 1), current];
        setState('history', 'entries', newHistory);
        setState('history', 'index', newHistory.length - 1);
      }
    }

    loadFile(file);
  };

  // Navigation: Go Back
  const canGoBack = () => state.history.index >= 0;
  const goBack = () => {
    if (!canGoBack()) return;
    const idx = state.history.index;
    const file = state.history.entries[idx];
    setState('history', 'index', idx - 1);
    handleFileSelect(file, false);
  };

  // Navigation: Go Forward
  const canGoForward = () => {
    const idx = state.history.index;
    const h = state.history.entries;
    // Can go forward if there's a current file and we're not at the end
    return idx < h.length - 1 || (idx === h.length - 1 && state.vault.currentFile !== null);
  };
  const goForward = () => {
    if (!canGoForward()) return;
    const idx = state.history.index;
    const h = state.history.entries;
    if (idx < h.length - 1) {
      const nextFile = h[idx + 1];
      setState('history', 'index', idx + 1);
      handleFileSelect(nextFile, false);
    }
  };

  // Initialize on mount
  onMount(async () => {
    console.log('[App] onMount at:', (performance.now() - APP_START).toFixed(0), 'ms');

    // Theme
    const stored = localStorage.getItem('slate-theme');
    const prefersDark = stored === 'dark';
    setState('ui', 'isDark', prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);

    // Scan vault for markdown files
    console.log('[App] Starting vault scan at:', (performance.now() - APP_START).toFixed(0), 'ms');
    setState('vault', 'isScanning', true);
    try {
      const vaultFiles = await scanVault(VAULT_ROOT_RELATIVE);
      console.log('[App] Vault scan complete at:', (performance.now() - APP_START).toFixed(0), 'ms');
      setState('vault', 'files', vaultFiles);
      setState('vault', 'isScanning', false);

      // Load INBOX.md by default, or first file if not found
      if (vaultFiles.length > 0) {
        const inbox = vaultFiles.find(f => f.name.toLowerCase() === 'inbox.md');
        console.log('[App] Starting loadFile at:', (performance.now() - APP_START).toFixed(0), 'ms');
        await loadFile(inbox || vaultFiles[0]);
        console.log('[App] loadFile complete at:', (performance.now() - APP_START).toFixed(0), 'ms');
      } else {
        setState('ui', 'error', 'No markdown files found in vault');
        setState('editor', 'isLoaded', true);
      }
    } catch (err) {
      setState('vault', 'isScanning', false);
      setState('ui', 'error', `Failed to scan vault: ${err}`);
      console.error('Failed to scan vault:', err);
      setState('editor', 'isLoaded', true);
    }

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setState('ui', 'finderOpen', true);
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
    const newDark = !state.ui.isDark;
    setState('ui', 'isDark', newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('slate-theme', newDark ? 'dark' : 'light');
  };

  const handleContentChange = (newContent: string) => {
    setState('editor', 'content', newContent);
    setState('editor', 'isDirty', true);
    setState('ui', 'error', null);

    const file = state.vault.currentFile;
    if (!file) return;

    // Debounced auto-save
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(async () => {
      try {
        setState('editor', 'saveStatus', 'saving');
        await writeTextFile(file.path, newContent);
        setState('editor', 'isDirty', false);
        setState('editor', 'saveStatus', 'saved');
        setTimeout(() => setState('editor', 'saveStatus', 'idle'), 1500);
      } catch (err) {
        setState('ui', 'error', `Auto-save failed: ${err}`);
        console.error('Auto-save failed:', err);
      }
    }, 500);
  };

  const getDisplayPath = () => {
    const file = state.vault.currentFile;
    return file ? file.relativePath : 'No file';
  };

  return (
    <AppStoreProvider value={[state, setState]}>
      <div class="flex flex-col h-screen bg-[var(--color-bg-primary)]">
        {/* File Finder Modal */}
        <FileFinder
          files={state.vault.files}
          isOpen={state.ui.finderOpen}
          onClose={() => setState('ui', 'finderOpen', false)}
          onSelect={handleFileSelect}
        />

        {/* Error Banner */}
        <Show when={state.ui.error}>
          <div class="px-4 py-2 bg-red-500/20 border-b border-red-500/50 text-red-400 text-sm">
            ⚠️ {state.ui.error}
          </div>
        </Show>

        {/* Toolbar */}
        <header class="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <div class="flex items-center gap-3">
            <h1 class="text-lg font-semibold text-[var(--color-text-primary)]">Slate</h1>
            <button
              class="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
              onClick={() => setState('ui', 'finderOpen', true)}
              title="Open file (Ctrl+P)"
            >
              {state.vault.isScanning ? 'Scanning vault...' : getDisplayPath()}
              {state.editor.saveStatus === 'saving' && <span class="text-[var(--color-text-muted)] ml-2">Saving...</span>}
              {state.editor.saveStatus === 'saved' && <span class="text-green-500 ml-2">Saved</span>}
              {state.editor.isDirty && state.editor.saveStatus === 'idle' && <span class="text-[var(--color-accent)] ml-1">•</span>}
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
            <button class="toolbar-button" onClick={toggleTheme} title={state.ui.isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {state.ui.isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>

        {/* WYSIWYG Editor */}
        <main class="flex-1 overflow-hidden">
          <Show when={state.editor.isLoaded && state.vault.currentFile} fallback={<div class="p-4 text-[var(--color-text-muted)]">Loading...</div>}>
            <For each={[state.editor.key]}>
              {(_key) => <WysiwygEditor
                content={state.editor.content}
                onContentChange={handleContentChange}
                files={state.vault.files}
                onNavigate={handleFileSelect}
              />}
            </For>
          </Show>
        </main>
      </div>
    </AppStoreProvider>
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
