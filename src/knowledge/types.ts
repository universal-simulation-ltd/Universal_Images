// Structurally identical to @unisim/sdk's KnowledgeArticle (0.163.0+). Kept
// local so the articles compile whatever SDK version is installed.
export interface Article {
  /** Stable kebab-case slug, identical across languages. */
  id: string
  title: string
  /** One line shown under the title in the list. */
  summary?: string
  /** List heading, e.g. "The basics" / "How it works" / "Privacy and security" (translated). */
  group?: string
  /**
   * Blank-line paragraphs, `## ` subheadings, `- ` bullets, `1. ` numbered
   * steps and `**bold**`. Nothing else is interpreted — no HTML, no links.
   */
  body: string
}
