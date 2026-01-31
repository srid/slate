import { $remark, $node, $inputRule, $nodeAttr } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/prose/inputrules';
import type { Node } from '@milkdown/prose/model';

// ============================================
// Remark Plugin for parsing [[wikilinks]]
// Supports: [[target]] and [[target|display]]
// ============================================

interface WikilinkNode {
    type: 'wikilink';
    data: {
        hName: 'wikilink';
        hProperties: { target: string; alias?: string };
    };
    value: string;
}

interface ParsedWikilink {
    start: number;
    end: number;
    target: string;
    alias?: string;
}

function findWikilinks(value: string): ParsedWikilink[] {
    const results: ParsedWikilink[] = [];
    // Match [[target]] or [[target|alias]]
    const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
        results.push({
            start: match.index,
            end: match.index + match[0].length,
            target: match[1].trim(),
            alias: match[2]?.trim(),
        });
    }
    return results;
}

function remarkWikilink() {
    return (tree: any) => {
        const visit = (node: any, parent?: any, index?: number) => {
            if (node.type === 'text' && parent) {
                const links = findWikilinks(node.value);
                if (links.length > 0) {
                    const newNodes: any[] = [];
                    let lastEnd = 0;

                    for (const link of links) {
                        // Text before the wikilink
                        if (link.start > lastEnd) {
                            newNodes.push({
                                type: 'text',
                                value: node.value.slice(lastEnd, link.start),
                            });
                        }
                        // The wikilink node - store both target and alias
                        const wikilinkValue = link.alias
                            ? `${link.target}|${link.alias}`
                            : link.target;
                        newNodes.push({
                            type: 'wikilink',
                            data: {
                                hName: 'wikilink',
                                hProperties: { target: link.target, alias: link.alias },
                            },
                            value: wikilinkValue,
                        } as WikilinkNode);
                        lastEnd = link.end;
                    }

                    // Text after the last wikilink
                    if (lastEnd < node.value.length) {
                        newNodes.push({
                            type: 'text',
                            value: node.value.slice(lastEnd),
                        });
                    }

                    // Replace the text node with our new nodes
                    if (parent.children && typeof index === 'number') {
                        parent.children.splice(index, 1, ...newNodes);
                    }
                }
            }

            // Recursively visit children
            if (node.children) {
                // Iterate in reverse to handle splice mutations correctly
                for (let i = node.children.length - 1; i >= 0; i--) {
                    visit(node.children[i], node, i);
                }
            }
        };

        visit(tree);
        return tree;
    };
}

// Milkdown remark plugin wrapper
export const wikilinkRemarkPlugin = $remark('wikilink', () => remarkWikilink);

// ============================================
// ProseMirror Node Schema
// ============================================

export const wikilinkAttr = $nodeAttr('wikilink', () => ({
    target: { default: '' },
    alias: { default: '' },
}));

export const wikilinkNode = $node('wikilink', () => ({
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
        target: { default: '' },
        alias: { default: '' },
    },
    parseDOM: [
        {
            tag: 'wikilink',
            getAttrs: (dom) => {
                if (!(dom instanceof HTMLElement)) return false;
                return {
                    target: dom.getAttribute('target') || '',
                    alias: dom.getAttribute('alias') || '',
                };
            },
        },
        {
            tag: 'span.wikilink',
            getAttrs: (dom) => {
                if (!(dom instanceof HTMLElement)) return false;
                return {
                    target: dom.getAttribute('data-target') || '',
                    alias: dom.getAttribute('data-alias') || '',
                };
            },
        },
    ],
    toDOM: (node: Node) => {
        const display = node.attrs.alias || node.attrs.target;
        return [
            'span',
            {
                class: 'wikilink',
                'data-target': node.attrs.target,
                'data-alias': node.attrs.alias || '',
            },
            display,
        ];
    },
    parseMarkdown: {
        match: (node: any) => node.type === 'wikilink',
        runner: (state: any, node: any, type: any) => {
            const value = node.value || '';
            const props = node.data?.hProperties || {};

            // Parse target|alias from value if not in props
            let target = props.target || '';
            let alias = props.alias || '';

            if (!target && value) {
                const parts = value.split('|');
                target = parts[0].trim();
                alias = parts[1]?.trim() || '';
            }

            state.addNode(type, { target, alias });
        },
    },
    toMarkdown: {
        match: (node: Node) => node.type.name === 'wikilink',
        runner: (state: any, node: Node) => {
            const target = node.attrs.target;
            const alias = node.attrs.alias;
            const text = alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
            state.addNode('text', undefined, text);
        },
    },
}));

// ============================================
// Input Rule: Convert typed [[text]] or [[target|alias]] to wikilink
// ============================================

export const wikilinkInputRule = $inputRule((ctx) => {
    return new InputRule(
        /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/,
        (state, match, start, end) => {
            const wikilinkType = wikilinkNode.type(ctx);
            const target = match[1]?.trim();
            const alias = match[2]?.trim() || '';

            if (!target || !wikilinkType) return null;

            const node = wikilinkType.create({ target, alias });
            return state.tr.replaceWith(start, end, node);
        }
    );
});

// ============================================
// Combined Plugin Export
// ============================================

export const wikilinkPlugin = [
    wikilinkRemarkPlugin,
    wikilinkAttr,
    wikilinkNode,
    wikilinkInputRule,
].flat();
