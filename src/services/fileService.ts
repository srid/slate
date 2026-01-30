import { readDir, type DirEntry } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';

export interface FileEntry {
    name: string;
    path: string;         // Full absolute path
    relativePath: string; // Path relative to vault root (for display)
}

/**
 * Recursively scans a directory for markdown files.
 * Skips hidden directories (starting with .) and handles permission errors gracefully.
 */
async function scanDirectoryRecursive(
    dirPath: string,
    vaultRoot: string,
    results: FileEntry[]
): Promise<void> {
    let entries: DirEntry[];

    try {
        entries = await readDir(dirPath);
        console.log(`[scan] ${dirPath} (${entries.length} entries)`);
    } catch (err) {
        // Skip directories we can't read (permission issues, etc.)
        console.warn(`[scan] Skipping ${dirPath}:`, err);
        return;
    }

    for (const entry of entries) {
        // Skip hidden files and directories
        if (entry.name.startsWith('.')) {
            continue;
        }

        const fullPath = await join(dirPath, entry.name);

        if (entry.isDirectory) {
            // Recurse into subdirectories
            await scanDirectoryRecursive(fullPath, vaultRoot, results);
        } else if (entry.name.endsWith('.md')) {
            // Calculate relative path from vault root
            const relativePath = fullPath.startsWith(vaultRoot)
                ? fullPath.slice(vaultRoot.length + 1) // +1 for trailing slash
                : entry.name;

            results.push({
                name: entry.name,
                path: fullPath,
                relativePath,
            });
        }
    }
}

/**
 * Scans the vault directory for all markdown files.
 * @param vaultRelativePath Path to vault relative to home directory (e.g., 'Dropbox/Vault')
 * @returns Array of FileEntry objects sorted by relative path
 */
export async function scanVault(vaultRelativePath: string): Promise<FileEntry[]> {
    console.log(`[scan] Starting vault scan: ${vaultRelativePath}`);
    const startTime = performance.now();

    const home = await homeDir();
    const vaultRoot = await join(home, vaultRelativePath);

    const results: FileEntry[] = [];
    await scanDirectoryRecursive(vaultRoot, vaultRoot, results);

    // Sort by relative path for consistent ordering
    results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const elapsed = (performance.now() - startTime).toFixed(0);
    console.log(`[scan] Done: ${results.length} files in ${elapsed}ms`);

    return results;
}

/**
 * Gets the full path for a vault-relative path.
 */
export async function getVaultPath(vaultRelativePath: string): Promise<string> {
    const home = await homeDir();
    return await join(home, vaultRelativePath);
}
