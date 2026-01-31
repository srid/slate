import { createContext, useContext } from 'solid-js';
import { createStore, SetStoreFunction } from 'solid-js/store';
import type { FileEntry } from '../services/fileService';

// ============================================================================
// Type Definitions
// ============================================================================

export interface AppState {
    // File management
    vault: {
        files: FileEntry[];
        currentFile: FileEntry | null;
        isScanning: boolean;
    };

    // Editor state
    editor: {
        content: string;
        isLoaded: boolean;
        isDirty: boolean;
        saveStatus: 'saved' | 'saving' | 'idle';
        key: number; // Increment to force editor re-render
    };

    // Navigation history
    history: {
        entries: FileEntry[];
        index: number;
    };

    // UI state
    ui: {
        finderOpen: boolean;
        isDark: boolean;
        error: string | null;
    };
}

// ============================================================================
// Initial State
// ============================================================================

export const createInitialState = (): AppState => ({
    vault: {
        files: [],
        currentFile: null,
        isScanning: true,
    },
    editor: {
        content: '',
        isLoaded: false,
        isDirty: false,
        saveStatus: 'idle',
        key: 0,
    },
    history: {
        entries: [],
        index: -1,
    },
    ui: {
        finderOpen: false,
        isDark: false,
        error: null,
    },
});

// ============================================================================
// Store Type & Context
// ============================================================================

export type AppStore = [AppState, SetStoreFunction<AppState>];

const AppStoreContext = createContext<AppStore>();

export const AppStoreProvider = AppStoreContext.Provider;

export function useAppStore(): AppStore {
    const store = useContext(AppStoreContext);
    if (!store) {
        throw new Error('useAppStore must be used within an AppStoreProvider');
    }
    return store;
}

// ============================================================================
// Store Factory
// ============================================================================

export function createAppStore(): AppStore {
    return createStore<AppState>(createInitialState());
}
