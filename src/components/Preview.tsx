import { createMemo } from 'solid-js';
import { marked } from 'marked';

// Configure marked for GitHub-flavored markdown
marked.setOptions({
  gfm: true,
  breaks: true,
});

interface PreviewProps {
  content: string;
}

function Preview(props: PreviewProps) {
  const html = createMemo(() => {
    try {
      return marked.parse(props.content) as string;
    } catch {
      return '<p>Error parsing markdown</p>';
    }
  });

  return (
    <div class="preview-content" innerHTML={html()} />
  );
}

export default Preview;
