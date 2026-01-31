import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';

export interface FileEntry {
    name: string;
    path: string;         // Full absolute path
    relativePath: string; // Path relative to vault root (for display)
}

/**
 * Scans the vault directory for all markdown files using Rust backend.
 * @param vaultRelativePath Path to vault relative to home directory (e.g., 'Dropbox/Vault')
 * @returns Array of FileEntry objects sorted by relative path
 */
export async function scanVault(vaultRelativePath: string): Promise<FileEntry[]> {
    console.log(`[scan] Starting vault scan: ${vaultRelativePath}`);
    const startTime = performance.now();

    const results = await invoke<FileEntry[]>('scan_vault', {
        vaultRelativePath,
    });

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
