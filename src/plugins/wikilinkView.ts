import { $view } from '@milkdown/kit/utils';
import { wikilinkNode } from './wikilinkPlugin';
import type { FileEntry } from '../services/fileService';
import { resolveWikilink, getWikilinkDisplayText } from '../services/wikilinkService';

// Navigation context - will be set externally
let navigationContext: {
    files: FileEntry[];
    onNavigate: (file: FileEntry) => void;
} | null = null;

// Track all active wikilink elements for updates
const activeWikilinks = new Set<{
    span: HTMLSpanElement;
    target: string;
    updateState: () => void;
}>();

/**
 * Set the navigation context for wikilinks.
 * Must be called after editor is created with current files list.
 */
export function setWikilinkNavigationContext(
    files: FileEntry[],
    onNavigate: (file: FileEntry) => void
) {
    navigationContext = { files, onNavigate };
    // Update all existing wikilinks with new context
    refreshAllWikilinks();
}

/**
 * Update just the files list (without changing the navigation callback).
 */
export function updateWikilinkFiles(files: FileEntry[]) {
    if (navigationContext) {
        navigationContext.files = files;
        refreshAllWikilinks();
    }
}

/**
 * Refresh all active wikilink elements.
 */
function refreshAllWikilinks() {
    activeWikilinks.forEach(({ updateState }) => {
        updateState();
    });
}

/**
 * Custom nodeView for wikilinks.
 * - Renders as styled span
 * - Click to navigate (no modifier required)
 * - Visual indicator for broken links
 */
export const wikilinkView = $view(wikilinkNode, () => {
    return (node, view, getPos) => {
        let target = node.attrs.target as string;
        let alias = node.attrs.alias as string || '';
        // Display: alias if set, otherwise use target basename
        const getDisplayText = () => alias || getWikilinkDisplayText(target);

        // Create the DOM element
        const span = document.createElement('span');
        span.className = 'wikilink';
        span.setAttribute('data-target', target);
        span.setAttribute('data-alias', alias);
        span.textContent = getDisplayText();
        span.style.cursor = 'pointer';

        // Check if target exists and update styling
        const updateExistsState = () => {
            if (navigationContext) {
                const resolved = resolveWikilink(target, navigationContext.files);
                span.classList.toggle('wikilink--broken', !resolved.exists);
                span.title = resolved.exists
                    ? `Click to open: ${resolved.file?.relativePath} (double-click to edit)`
                    : `Not found: ${target} (double-click to edit)`;
            } else {
                // No context yet - show as potentially broken
                span.classList.add('wikilink--broken');
                span.title = `${target} (loading...)`;
            }
        };

        updateExistsState();

        // Register for updates
        const entry = { span, target, updateState: updateExistsState };
        activeWikilinks.add(entry);

        // Click handling: delay single-click to detect double-click
        let clickTimeout: number | null = null;

        const doNavigate = () => {
            if (navigationContext) {
                const resolved = resolveWikilink(target, navigationContext.files);
                if (resolved.exists && resolved.file) {
                    navigationContext.onNavigate(resolved.file);
                } else {
                    console.log(`[wikilink] Target not found: ${target}`);
                }
            } else {
                console.log('[wikilink] Navigation context not set');
            }
        };

        // Handle single click - navigate (with delay to allow double-click)
        span.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Set a short delay - if double-click happens, it will cancel this
            if (clickTimeout) clearTimeout(clickTimeout);
            clickTimeout = window.setTimeout(() => {
                clickTimeout = null;
                doNavigate();
            }, 250); // 250ms delay to detect double-click
        });

        // Handle double-click - edit
        span.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Cancel the pending navigation from single-click
            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
            }

            // Create inline edit input
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'wikilink-edit';
            // Show full wikilink syntax including brackets
            input.value = alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
            input.style.cssText = `
        font: inherit;
        color: inherit;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-accent);
        border-radius: 4px;
        padding: 0.1em 0.3em;
        outline: none;
        min-width: 120px;
      `;

            // Replace span content with input
            span.textContent = '';
            span.appendChild(input);
            input.focus();
            input.select();

            const commitEdit = () => {
                let newValue = input.value.trim();
                // Strip outer brackets if present
                if (newValue.startsWith('[[') && newValue.endsWith(']]')) {
                    newValue = newValue.slice(2, -2);
                }
                if (newValue) {
                    // Parse target|alias
                    const parts = newValue.split('|');
                    const newTarget = parts[0].trim();
                    const newAlias = parts[1]?.trim() || '';

                    // Update the node in ProseMirror
                    const pos = getPos();
                    if (pos !== undefined && view) {
                        const tr = view.state.tr.setNodeMarkup(pos, undefined, {
                            target: newTarget,
                            alias: newAlias,
                        });
                        view.dispatch(tr);
                    }
                }
                // Restore span display
                span.textContent = getDisplayText();
            };

            input.addEventListener('blur', commitEdit);
            input.addEventListener('keydown', (ke) => {
                if (ke.key === 'Enter') {
                    ke.preventDefault();
                    input.blur();
                } else if (ke.key === 'Escape') {
                    ke.preventDefault();
                    // Cancel edit - restore without saving
                    span.textContent = getDisplayText();
                }
            });
        });

        return {
            dom: span,
            update: (updatedNode) => {
                if (updatedNode.type.name !== 'wikilink') return false;

                const newTarget = updatedNode.attrs.target as string;
                const newAlias = updatedNode.attrs.alias as string || '';
                if (newTarget !== target || newAlias !== alias) {
                    target = newTarget;
                    alias = newAlias;
                    entry.target = newTarget;
                    span.setAttribute('data-target', newTarget);
                    span.setAttribute('data-alias', newAlias);
                    span.textContent = getDisplayText();
                }

                updateExistsState();
                return true;
            },
            destroy: () => {
                activeWikilinks.delete(entry);
            },
        };
    };
});
