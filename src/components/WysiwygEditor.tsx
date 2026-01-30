import { onCleanup, onMount } from 'solid-js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import { Markdown } from '@tiptap/markdown';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { common, createLowlight } from 'lowlight';

// Create a lowlight instance with common languages
const lowlight = createLowlight(common);

interface WysiwygEditorProps {
  content: string;
  onContentChange: (markdown: string) => void;
}

function WysiwygEditor(props: WysiwygEditorProps) {
  let ref!: HTMLDivElement;
  let editor: Editor | null = null;

  onMount(() => {
    // Create editor with initial markdown content
    editor = new Editor({
      element: ref,
      extensions: [
        StarterKit.configure({
          // Disable the default codeBlock as we're using CodeBlockLowlight
          codeBlock: false,
        }),
        Typography,
        CodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: 'plaintext',
        }),
        TaskList,
        TaskItem.configure({
          nested: true, // Allow nested task lists
        }),
        Markdown,
      ],
      content: props.content,
      contentType: 'markdown',
      editorProps: {
        attributes: {
          class: 'wysiwyg-content',
        },
      },
      onUpdate: ({ editor }) => {
        const markdown = (editor as any).getMarkdown?.() || '';
        props.onContentChange(markdown);
      },
    });
  });

  onCleanup(() => {
    editor?.destroy();
  });

  return (
    <div class="wysiwyg-editor h-full overflow-auto p-4">
      <div ref={ref} class="h-full" />
    </div>
  );
}

export default WysiwygEditor;
