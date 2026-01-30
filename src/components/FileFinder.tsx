import { createSignal, createMemo, createEffect, For, onMount, onCleanup, Show } from 'solid-js';
import type { FileEntry } from '../services/fileService';

interface FileFinderProps {
    files: FileEntry[];
    isOpen: boolean;
    onClose: () => void;
    onSelect: (file: FileEntry) => void;
}

/**
 * Simple fuzzy match scoring - returns -1 for no match, higher is better.
 */
function fuzzyMatch(query: string, target: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerTarget = target.toLowerCase();

    if (!query) return 1; // Empty query matches everything

    // Exact substring match gets high score
    if (lowerTarget.includes(lowerQuery)) {
        return 100 + (query.length / target.length) * 50;
    }

    // Fuzzy character matching
    let queryIdx = 0;
    let score = 0;
    let consecutive = 0;

    for (let i = 0; i < target.length && queryIdx < query.length; i++) {
        if (lowerTarget[i] === lowerQuery[queryIdx]) {
            queryIdx++;
            consecutive++;
            score += consecutive * 2; // Bonus for consecutive matches
        } else {
            consecutive = 0;
        }
    }

    // All query characters must be found
    return queryIdx === query.length ? score : -1;
}

function FileFinder(props: FileFinderProps) {
    const [query, setQuery] = createSignal('');
    const [selectedIndex, setSelectedIndex] = createSignal(0);
    let inputRef!: HTMLInputElement;

    // Filter and sort files by match score
    const filteredFiles = createMemo(() => {
        const q = query();
        const scored = props.files
            .map(file => ({ file, score: fuzzyMatch(q, file.relativePath) }))
            .filter(item => item.score >= 0)
            .sort((a, b) => b.score - a.score);
        return scored.map(item => item.file);
    });

    // Reset selection when query or files change
    const resetSelection = () => setSelectedIndex(0);

    // Focus input when modal opens
    createEffect(() => {
        if (props.isOpen) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                inputRef?.focus();
            });
        } else {
            // Reset query when closed
            setQuery('');
            setSelectedIndex(0);
        }
    });

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
        const files = filteredFiles();

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, files.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (files[selectedIndex()]) {
                    props.onSelect(files[selectedIndex()]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                props.onClose();
                break;
        }
    };

    // Global keyboard listener for Escape
    onMount(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && props.isOpen) {
                e.preventDefault();
                props.onClose();
            }
        };
        document.addEventListener('keydown', handleGlobalKeyDown);
        onCleanup(() => document.removeEventListener('keydown', handleGlobalKeyDown));
    });

    return (
        <Show when={props.isOpen}>
            <div
                class="fixed inset-0 bg-black/50 flex items-start justify-center pt-[15vh] z-50"
                onClick={(e) => e.target === e.currentTarget && props.onClose()}
            >
                <div class="w-full max-w-xl bg-[var(--color-bg-secondary)] rounded-lg shadow-2xl border border-[var(--color-border)] overflow-hidden">
                    {/* Search input */}
                    <div class="p-3 border-b border-[var(--color-border)]">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search files..."
                            class="w-full px-3 py-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
                            value={query()}
                            onInput={(e) => {
                                setQuery(e.currentTarget.value);
                                resetSelection();
                            }}
                            onKeyDown={handleKeyDown}
                            autofocus
                        />
                    </div>

                    {/* File list */}
                    <div class="max-h-80 overflow-y-auto">
                        <For each={filteredFiles()}>
                            {(file, index) => (
                                <div
                                    class={`px-4 py-2 cursor-pointer flex items-center gap-2 ${index() === selectedIndex()
                                        ? 'bg-[var(--color-accent)]/20 text-[var(--color-text-primary)]'
                                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]'
                                        }`}
                                    onClick={() => props.onSelect(file)}
                                    onMouseEnter={() => setSelectedIndex(index())}
                                >
                                    <span class="text-[var(--color-text-muted)]">📄</span>
                                    <span class="truncate">{file.relativePath}</span>
                                </div>
                            )}
                        </For>
                        <Show when={filteredFiles().length === 0}>
                            <div class="px-4 py-8 text-center text-[var(--color-text-muted)]">
                                No files found
                            </div>
                        </Show>
                    </div>
                </div>
            </div>
        </Show>
    );
}

export default FileFinder;
