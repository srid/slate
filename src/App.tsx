import { createSignal, onMount } from 'solid-js';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import Editor from './components/Editor';
import Preview from './components/Preview';

const SAMPLE_MARKDOWN = `# Welcome to Slate

A beautiful markdown editor built with **Tauri** and **SolidJS**.

## Features

- 📝 **Live Preview** - See your changes in real-time
- 💾 **Native File Dialogs** - Open and save files seamlessly
- 🎨 **Light & Dark Themes** - Choose your style
- ⚡ **Fast** - Built with Rust and SolidJS

## Getting Started

Start typing in the editor on the left, and watch the preview update on the right!

### Code Example

\`\`\`typescript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

### A Quote

> "The best way to predict the future is to invent it."
> — Alan Kay

---

*Happy writing!* ✨
`;

function App() {
  const [content, setContent] = createSignal(SAMPLE_MARKDOWN);
  const [currentFile, setCurrentFile] = createSignal<string | null>(null);
  const [isDirty, setIsDirty] = createSignal(false);
  const [isDark, setIsDark] = createSignal(false);

  // Initialize theme from localStorage
  onMount(() => {
    const stored = localStorage.getItem('slate-theme');
    const prefersDark = stored === 'dark';
    setIsDark(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);
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
  };

  const handleOpen = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown'] },
          { name: 'Text', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (path && typeof path === 'string') {
        const text = await readTextFile(path);
        setContent(text);
        setCurrentFile(path);
        setIsDirty(false);
      }
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const handleSave = async () => {
    try {
      let path = currentFile();

      if (!path) {
        const savePath = await save({
          filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          defaultPath: 'untitled.md',
        });

        if (!savePath) return;
        path = savePath;
      }

      await writeTextFile(path, content());
      setCurrentFile(path);
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const handleNew = () => {
    setContent('');
    setCurrentFile(null);
    setIsDirty(false);
  };

  const getFileName = () => {
    const file = currentFile();
    if (!file) return 'Untitled';
    const parts = file.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div class="flex flex-col h-screen bg-[var(--color-bg-primary)]">
      {/* Toolbar */}
      <header class="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-semibold text-[var(--color-text-primary)]">Slate</h1>
          <span class="text-sm text-[var(--color-text-secondary)]">
            {getFileName()}
            {isDirty() && <span class="text-[var(--color-accent)] ml-1">•</span>}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button class="toolbar-button" onClick={handleNew}>
            <NewIcon />
            New
          </button>
          <button class="toolbar-button" onClick={handleOpen}>
            <OpenIcon />
            Open
          </button>
          <button class="toolbar-button" onClick={handleSave}>
            <SaveIcon />
            Save
          </button>
          <button class="toolbar-button" onClick={toggleTheme} title={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark() ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* Editor + Preview Split */}
      <main class="flex flex-1 overflow-hidden">
        <div class="w-1/2 border-r border-[var(--color-border)]">
          <Editor content={content()} onContentChange={handleContentChange} onSave={handleSave} />
        </div>
        <div class="w-1/2 bg-[var(--color-bg-secondary)]">
          <Preview content={content()} />
        </div>
      </main>
    </div>
  );
}

// Simple inline icons
function NewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
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
