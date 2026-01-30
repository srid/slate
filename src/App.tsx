import { createSignal, onMount, Show } from 'solid-js';

import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import Editor from './components/Editor';
import Preview from './components/Preview';

// File path relative to home directory
const SLATE_FILE_RELATIVE = 'Dropbox/Vault/slate-demo.md';

function App() {
  const [content, setContent] = createSignal('');
  const [filePath, setFilePath] = createSignal('');
  const [isDirty, setIsDirty] = createSignal(false);
  const [isDark, setIsDark] = createSignal(false);
  const [saveStatus, setSaveStatus] = createSignal<'saved' | 'saving' | 'idle'>('idle');
  const [error, setError] = createSignal<string | null>(null);
  let saveTimeout: number | undefined;

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
    } catch (err) {
      setError(`Failed to load file: ${err}`);
      console.error('Failed to load file:', err);
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
        await writeTextFile(path, newContent);
        setIsDirty(false);
        setSaveStatus('saved');
        // Clear "saved" status after a moment
        setTimeout(() => setSaveStatus('idle'), 1500);
      } catch (err) {
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
            {isDirty() && saveStatus() === 'idle' && <span class="text-[var(--color-accent)] ml-1">•</span>}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button class="toolbar-button" onClick={toggleTheme} title={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark() ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* Editor + Preview Split */}
      <main class="flex flex-1 overflow-hidden">
        <div class="w-1/2 border-r border-[var(--color-border)]">
          <Editor content={content()} onContentChange={handleContentChange} />
        </div>
        <div class="w-1/2 bg-[var(--color-bg-secondary)]">
          <Preview content={content()} />
        </div>
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
