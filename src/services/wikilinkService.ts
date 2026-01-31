import type { FileEntry } from './fileService';

export interface ResolvedWikilink {
    target: string;
    file: FileEntry | null;
    exists: boolean;
}

/**
 * Resolves a wikilink target to a file in the vault.
 * 
 * Resolution order:
 * 1. Exact match on filename (without .md extension)
 * 2. Case-insensitive match on filename
 * 3. Match on basename if target includes path separator
 */
export function resolveWikilink(
    target: string,
    files: FileEntry[]
): ResolvedWikilink {
    if (!target || files.length === 0) {
        return { target, file: null, exists: false };
    }

    const normalizedTarget = target.trim();

    // Try exact match on filename (without extension)
    let match = files.find((f) => {
        const nameWithoutExt = f.name.replace(/\.md$/, '');
        return nameWithoutExt === normalizedTarget;
    });

    if (match) {
        return { target, file: match, exists: true };
    }

    // Try case-insensitive match
    const lowerTarget = normalizedTarget.toLowerCase();
    match = files.find((f) => {
        const nameWithoutExt = f.name.replace(/\.md$/, '').toLowerCase();
        return nameWithoutExt === lowerTarget;
    });

    if (match) {
        return { target, file: match, exists: true };
    }

    // Try matching on relative path (for targets like "folder/Page")
    if (normalizedTarget.includes('/')) {
        const targetWithExt = normalizedTarget.endsWith('.md')
            ? normalizedTarget
            : `${normalizedTarget}.md`;

        match = files.find((f) => f.relativePath === targetWithExt);

        if (!match) {
            // Case-insensitive path match
            const lowerPath = targetWithExt.toLowerCase();
            match = files.find((f) => f.relativePath.toLowerCase() === lowerPath);
        }

        if (match) {
            return { target, file: match, exists: true };
        }
    }

    return { target, file: null, exists: false };
}

/**
 * Gets display text for a wikilink (the target without path prefix).
 */
export function getWikilinkDisplayText(target: string): string {
    const parts = target.split('/');
    return parts[parts.length - 1];
}
