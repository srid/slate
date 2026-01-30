import { onCleanup, onMount } from 'solid-js';
import { Editor, defaultValueCtx, rootCtx, editorViewOptionsCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { history } from '@milkdown/kit/plugin/history';
import { prism, prismConfig } from '@milkdown/plugin-prism';
import { nord } from '@milkdown/theme-nord';
import { $view } from '@milkdown/kit/utils';
import { listItemSchema } from '@milkdown/kit/preset/commonmark';
import '@milkdown/theme-nord/style.css';

// Syntax highlighting CSS
import 'prismjs/themes/prism-tomorrow.css';

// Import refractor and languages for Milkdown prism plugin
import { refractor } from 'refractor';
import haskell from 'refractor/haskell';
import nix from 'refractor/nix';
import rust from 'refractor/rust';
import python from 'refractor/python';
import typescript from 'refractor/typescript';
import javascript from 'refractor/javascript';
import jsx from 'refractor/jsx';
import tsx from 'refractor/tsx';
import css from 'refractor/css';
import bash from 'refractor/bash';
import json from 'refractor/json';
import yaml from 'refractor/yaml';
import markdown from 'refractor/markdown';
import toml from 'refractor/toml';

// Register all languages with refractor
refractor.register(haskell);
refractor.register(nix);
refractor.register(rust);
refractor.register(python);
refractor.register(typescript);
refractor.register(javascript);
refractor.register(jsx);
refractor.register(tsx);
refractor.register(css);
refractor.register(bash);
refractor.register(json);
refractor.register(yaml);
refractor.register(markdown);
refractor.register(toml);

interface WysiwygEditorProps {
  content: string;
  onContentChange: (markdown: string) => void;
}

// Custom nodeView for task list items - renders actual checkbox
const taskListItemView = $view(listItemSchema.node, () => {
  return (node, view, getPos) => {
    const isTask = node.attrs.checked !== undefined && node.attrs.checked !== null;
    
    const li = document.createElement('li');
    li.dataset.itemType = isTask ? 'task' : 'normal';
    
    if (isTask) {
      li.dataset.checked = String(node.attrs.checked);
      li.classList.add('task-list-item');
      
      // Create actual checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = node.attrs.checked === true;
      checkbox.classList.add('task-checkbox');
      checkbox.contentEditable = 'false';
      
      // Handle checkbox click
      checkbox.addEventListener('change', (e) => {
        e.preventDefault();
        const pos = getPos();
        if (pos === undefined) return;
        
        const tr = view.state.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          checked: checkbox.checked,
        });
        view.dispatch(tr);
      });
      
      li.appendChild(checkbox);
    }
    
    // Content container
    const content = document.createElement('div');
    content.classList.add('task-content');
    li.appendChild(content);
    
    return {
      dom: li,
      contentDOM: content,
      update: (updatedNode) => {
        if (updatedNode.type.name !== 'list_item') return false;
        
        const isUpdatedTask = updatedNode.attrs.checked !== undefined && updatedNode.attrs.checked !== null;
        if (isTask !== isUpdatedTask) return false;
        
        if (isTask) {
          const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (checkbox) {
            checkbox.checked = updatedNode.attrs.checked === true;
          }
          li.dataset.checked = String(updatedNode.attrs.checked);
        }
        
        return true;
      },
    };
  };
});

function WysiwygEditor(props: WysiwygEditorProps) {
  let ref!: HTMLDivElement;
  let editor: Editor | null = null;

  onMount(async () => {
    try {
      // Create Milkdown editor
      editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, ref);
          ctx.set(defaultValueCtx, props.content);
          ctx.set(editorViewOptionsCtx, {
            attributes: { class: 'milkdown-editor' },
          });
          
          // Configure prism with our registered refractor
          ctx.set(prismConfig.key, {
            configureRefractor: () => refractor,
          });
        })
        .config(nord)
        .use(commonmark)
        .use(gfm) // Includes task lists
        .use(history) // Undo/Redo support
        .use(prism) // Syntax highlighting
        .use(listener)
        .use(taskListItemView) // Custom task list view with real checkboxes
        .create();

      // Set up listener after editor is created
      editor.action((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          props.onContentChange(markdown);
        });
      });
    } catch (error) {
      console.error('Milkdown initialization error:', error);
    }
  });

  onCleanup(() => {
    editor?.destroy();
  });

  return (
    <div class="wysiwyg-editor h-full overflow-auto">
      <div ref={ref} class="h-full milkdown" />
    </div>
  );
}

export default WysiwygEditor;
