import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';

import { readTextFile, writeTextFile, exists, watch, type UnwatchFn, type WatchEvent } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import WysiwygEditor from './components/WysiwygEditor';

// File path relative to home directory
const SLATE_FILE_RELATIVE = 'Dropbox/Vault/slate-demo.md';

function App() {
  const [content, setContent] = createSignal('');
  const [filePath, setFilePath] = createSignal('');
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [isDirty, setIsDirty] = createSignal(false);
  const [isDark, setIsDark] = createSignal(false);
  const [saveStatus, setSaveStatus] = createSignal<'saved' | 'saving' | 'idle' | 'reloaded'>('idle');
  const [error, setError] = createSignal<string | null>(null);
  const [editorKey, setEditorKey] = createSignal(0); // Key to force editor remount
  let saveTimeout: number | undefined;
  let unwatchFn: UnwatchFn | null = null;
  let isWriting = false; // Flag to skip our own writes

  // Check if the event is a modify or create event
  const isModifyOrCreateEvent = (event: WatchEvent): boolean => {
    const type = event.type;
    if (typeof type === 'object') {
      return 'modify' in type || 'create' in type;
    }
    return false;
  };

  // Initialize theme and load file on mount
  onMount(async () => {
    // Theme
    const stored = localStorage.getItem('slate-theme');
    const prefersDark = stored === 'dark';
    setIsDark(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);

    // Build file path from home directory
    try {
      const home = await homeDir();
      const fullPath = home.endsWith('/') ? `${home}${SLATE_FILE_RELATIVE}` : `${home}/${SLATE_FILE_RELATIVE}`;
      setFilePath(fullPath);
      
      const fileExists = await exists(fullPath);
      if (fileExists) {
        const text = await readTextFile(fullPath);
        setContent(text);
      } else {
        // Create the file if it doesn't exist
        await writeTextFile(fullPath, '# New Document\n\nStart writing here...\n');
        setContent('# New Document\n\nStart writing here...\n');
      }
      setIsLoaded(true);

      // Start watching for external changes
      unwatchFn = await watch(fullPath, async (event) => {
        // Skip if we're currently writing (our own change)
        if (isWriting) return;
        
        // Reload file on external modification
        if (isModifyOrCreateEvent(event)) {
          try {
            const newContent = await readTextFile(fullPath);
            // Only update if content actually changed
            if (newContent !== content()) {
              setContent(newContent);
              setEditorKey(k => k + 1); // Force editor remount
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
    setError(null); // Clear error on edit
    
    const path = filePath();
    if (!path) return; // Not yet initialized
    
    // Debounced auto-save
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(async () => {
      try {
        setSaveStatus('saving');
        isWriting = true; // Set flag before writing
        await writeTextFile(path, newContent);
        isWriting = false; // Clear flag after writing
        setIsDirty(false);
        setSaveStatus('saved');
        // Clear "saved" status after a moment
        setTimeout(() => setSaveStatus('idle'), 1500);
      } catch (err) {
        isWriting = false;
        setError(`Auto-save failed: ${err}`);
        console.error('Auto-save failed:', err);
      }
    }, 500);
  };

  const getFileName = () => {
    return SLATE_FILE_RELATIVE.split('/').pop() || 'slate-demo.md';
  };

  return (
    <div class="flex flex-col h-screen bg-[var(--color-bg-primary)]">
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
          <span class="text-sm text-[var(--color-text-secondary)]">
            {getFileName()}
            {saveStatus() === 'saving' && <span class="text-[var(--color-text-muted)] ml-2">Saving...</span>}
            {saveStatus() === 'saved' && <span class="text-green-500 ml-2">Saved</span>}
            {saveStatus() === 'reloaded' && <span class="text-blue-500 ml-2">Reloaded</span>}
            {isDirty() && saveStatus() === 'idle' && <span class="text-[var(--color-accent)] ml-1">•</span>}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button class="toolbar-button" onClick={toggleTheme} title={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark() ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* WYSIWYG Editor - For with key forces remount on external file change */}
      <main class="flex-1 overflow-hidden">
        <Show when={isLoaded()} fallback={<div class="p-4 text-[var(--color-text-muted)]">Loading...</div>}>
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
