'use client';

import { useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  ListNode,
  ListItemNode,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from '@lexical/list';
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { FORMAT_TEXT_COMMAND, type EditorState } from 'lexical';

interface Props {
  value: string;
  onChange: (json: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const baseConfig = {
  namespace: 'PflegeAtlasSubmissionEditor',
  onError: (err: Error) => {
    // eslint-disable-next-line no-console
    console.error('Lexical error', err);
  },
  nodes: [ListNode, ListItemNode, LinkNode],
  theme: {
    paragraph: 'mb-2',
    list: {
      ul: 'list-disc pl-6',
      ol: 'list-decimal pl-6',
    },
    text: {
      bold: 'font-bold',
      italic: 'italic',
    },
    link: 'text-brand underline',
  },
};

function Toolbar() {
  const [editor] = useLexicalComposerContext();
  return (
    <div className="flex gap-2 border-b border-rule pb-2 mb-2">
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        className="px-2 py-1 rounded hover:bg-surface font-bold"
        aria-label="Fett"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        className="px-2 py-1 rounded hover:bg-surface italic"
        aria-label="Kursiv"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        className="px-2 py-1 rounded hover:bg-surface"
        aria-label="Aufzählung"
      >
        •
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        className="px-2 py-1 rounded hover:bg-surface"
        aria-label="Nummerierte Liste"
      >
        1.
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('Link-URL (https://, mailto: oder #fragment)');
          if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
        }}
        className="px-2 py-1 rounded hover:bg-surface"
        aria-label="Link einfügen"
      >
        🔗
      </button>
    </div>
  );
}

function ValueSyncPlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    try {
      const parsed = JSON.parse(value);
      const current = editor.getEditorState().toJSON();
      if (JSON.stringify(current) === JSON.stringify(parsed)) return;
      const newState = editor.parseEditorState(value);
      editor.setEditorState(newState);
    } catch {
      // ignore invalid JSON; editor stays in current state
    }
  }, [value, editor]);
  return null;
}

export function LexicalEditor({ value, onChange, placeholder, ariaLabel }: Props) {
  let editorStateOpt: string | undefined;
  try {
    const parsed = JSON.parse(value);
    if (parsed && parsed.root && parsed.root.type === 'root') {
      editorStateOpt = value;
    } else if (parsed && parsed.type === 'root') {
      // Some callers pass the inner root object; wrap for Lexical's expected shape
      editorStateOpt = JSON.stringify({ root: parsed });
    }
  } catch {
    editorStateOpt = undefined;
  }

  const config = {
    ...baseConfig,
    editorState: editorStateOpt,
  };

  const handleChange = (editorState: EditorState) => {
    const json = JSON.stringify(editorState.toJSON());
    onChange(json);
  };

  return (
    <div className="border border-rule rounded-md p-3 bg-white">
      <LexicalComposer initialConfig={config}>
        <Toolbar />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                role="textbox"
                aria-label={ariaLabel ?? 'Rich-Text-Editor'}
                className="min-h-[120px] outline-none"
              />
            }
            placeholder={
              placeholder ? (
                <div className="pointer-events-none absolute top-0 text-ink-muted">
                  {placeholder}
                </div>
              ) : null
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <OnChangePlugin onChange={handleChange} />
          <ValueSyncPlugin value={value} />
        </div>
      </LexicalComposer>
    </div>
  );
}

export function emptyLexicalJson(): string {
  return JSON.stringify({
    root: {
      children: [
        {
          children: [],
          direction: null,
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });
}
