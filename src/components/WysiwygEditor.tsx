import { onCleanup, onMount } from 'solid-js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import { Markdown } from '@tiptap/markdown';

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
        StarterKit,
        Typography,
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
