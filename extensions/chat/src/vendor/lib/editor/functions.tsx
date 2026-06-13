"use client";

import type { Node } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { defaultMarkdownSerializer } from "prosemirror-markdown";
import { DOMParser } from "prosemirror-model";
import { Decoration, DecorationSet } from "prosemirror-view";
import { renderToString } from "react-dom/server";

import type { UISuggestion } from "./suggestions";
import { MessageResponse } from "../../components/ai-elements/message";
import { documentSchema } from "./config";

export const buildDocumentFromContent = (content: string) => {
  const parser = DOMParser.fromSchema(documentSchema);
  const stringFromMarkdown = renderToString(
    <MessageResponse>{content}</MessageResponse>,
  );
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = stringFromMarkdown;
  return parser.parse(tempContainer);
};

export const buildContentFromDocument = (document: Node) => {
  return defaultMarkdownSerializer.serialize(document);
};

export const createDecorations = (
  suggestions: UISuggestion[],
  _view: EditorView,
) => {
  const decorations: Decoration[] = [];

  for (const suggestion of suggestions) {
    decorations.push(
      Decoration.inline(
        suggestion.selectionStart,
        suggestion.selectionEnd,
        {
          class: "suggestion-highlight",
          "data-suggestion-id": suggestion.id,
        },
        {
          suggestionId: suggestion.id,
          type: "highlight",
        },
      ),
    );
  }

  return DecorationSet.create(_view.state.doc, decorations);
};
