interface EditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
}

function Editor(props: EditorProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      props.onSave();
    }
  };

  return (
    <textarea
      class="editor-textarea"
      value={props.content}
      onInput={(e) => props.onContentChange(e.currentTarget.value)}
      onKeyDown={handleKeyDown}
      placeholder="Start writing your markdown here..."
      spellcheck={false}
    />
  );
}

export default Editor;
