interface EditorProps {
  content: string;
  onContentChange: (content: string) => void;
}

function Editor(props: EditorProps) {
  return (
    <textarea
      class="editor-textarea"
      value={props.content}
      onInput={(e) => props.onContentChange(e.currentTarget.value)}
      placeholder="Start writing your markdown here..."
      spellcheck={false}
    />
  );
}

export default Editor;
