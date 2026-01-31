import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import type { FileEntry } from '../services/fileService';

// Context for autocomplete
let autocompleteContext: {
    files: FileEntry[];
} | null = null;

export function setAutocompleteContext(files: FileEntry[]) {
    autocompleteContext = { files };
}

const autocompletePluginKey = new PluginKey('wikilink-autocomplete');

interface AutocompleteState {
    active: boolean;
    query: string;
    from: number;
    selectedIndex: number;
}

export const wikilinkAutocomplete = $prose(() => {
    let dropdown: HTMLDivElement | null = null;
    let state: AutocompleteState = {
        active: false,
        query: '',
        from: 0,
        selectedIndex: 0,
    };

    const getMatches = (query: string): FileEntry[] => {
        if (!autocompleteContext) return [];
        const q = query.toLowerCase();
        return autocompleteContext.files
            .filter(f => f.name.toLowerCase().includes(q) || f.relativePath.toLowerCase().includes(q))
            .slice(0, 8); // Limit to 8 results
    };

    const createDropdown = (view: EditorView) => {
        if (dropdown) return dropdown;

        dropdown = document.createElement('div');
        dropdown.className = 'wikilink-autocomplete';
        dropdown.style.cssText = `
      position: absolute;
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      min-width: 200px;
    `;
        view.dom.parentElement?.appendChild(dropdown);
        return dropdown;
    };

    const hideDropdown = () => {
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
        }
        state = { active: false, query: '', from: 0, selectedIndex: 0 };
    };

    const updateDropdown = (view: EditorView, matches: FileEntry[]) => {
        const dd = createDropdown(view);
        dd.innerHTML = '';

        if (matches.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No matches';
            empty.style.cssText = 'padding: 8px 12px; color: var(--color-text-muted); font-style: italic;';
            dd.appendChild(empty);
            return;
        }

        matches.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'wikilink-autocomplete-item';
            item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 2px;
        ${index === state.selectedIndex ? 'background: var(--color-bg-tertiary);' : ''}
      `;

            const name = document.createElement('span');
            name.textContent = file.name.replace(/\.md$/, '');
            name.style.cssText = 'font-weight: 500; color: var(--color-text-primary);';

            const path = document.createElement('span');
            path.textContent = file.relativePath;
            path.style.cssText = 'font-size: 0.85em; color: var(--color-text-muted);';

            item.appendChild(name);
            item.appendChild(path);

            item.addEventListener('mouseenter', () => {
                state.selectedIndex = index;
                updateDropdown(view, matches);
            });

            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectItem(view, file);
            });

            dd.appendChild(item);
        });

        // Position dropdown near cursor
        const coords = view.coordsAtPos(state.from);
        dd.style.left = `${coords.left}px`;
        dd.style.top = `${coords.bottom + 4}px`;
    };

    const selectItem = (view: EditorView, file: FileEntry) => {
        const target = file.name.replace(/\.md$/, '');

        // Get the wikilink node type from schema
        const wikilinkType = view.state.schema.nodes.wikilink;
        if (!wikilinkType) {
            console.error('[autocomplete] wikilink node type not found in schema');
            hideDropdown();
            return;
        }

        // Create and insert the wikilink node
        const node = wikilinkType.create({ target, alias: '' });
        const tr = view.state.tr.replaceWith(
            state.from,
            view.state.selection.to,
            node
        );
        view.dispatch(tr);
        hideDropdown();
    };

    return new Plugin({
        key: autocompletePluginKey,

        props: {
            handleKeyDown(view, event) {
                if (!state.active) return false;

                const matches = getMatches(state.query);

                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    state.selectedIndex = Math.min(state.selectedIndex + 1, matches.length - 1);
                    updateDropdown(view, matches);
                    return true;
                }

                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
                    updateDropdown(view, matches);
                    return true;
                }

                if (event.key === 'Enter' || event.key === 'Tab') {
                    if (matches.length > 0) {
                        event.preventDefault();
                        selectItem(view, matches[state.selectedIndex]);
                        return true;
                    }
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    hideDropdown();
                    return true;
                }

                return false;
            },
        },

        view() {
            return {
                update(view) {
                    const { state: editorState } = view;
                    const { selection } = editorState;
                    const { $from } = selection;

                    // Get text before cursor in current text block
                    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

                    // Check if we're in a wikilink (after [[)
                    const match = textBefore.match(/\[\[([^\]|]*)$/);

                    if (match) {
                        const query = match[1];
                        const from = $from.pos - query.length - 2; // Position of [[

                        state = {
                            active: true,
                            query,
                            from,
                            selectedIndex: 0,
                        };

                        const matches = getMatches(query);
                        updateDropdown(view, matches);
                    } else {
                        if (state.active) {
                            hideDropdown();
                        }
                    }
                },

                destroy() {
                    hideDropdown();
                },
            };
        },
    });
});
