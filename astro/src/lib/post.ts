import type { CollectionEntry } from 'astro:content'
import type { MarkdownHeading } from 'astro'
import { marked } from 'marked'
import { JSDOM } from 'jsdom'
const { window: { document } } = new JSDOM('')

export const createDescription = (post: CollectionEntry<'blog'>) => {
  const div = document.createElement('div')
  div.innerHTML = marked.parse(post.body)
  const clean = div.textContent ?? div.innerText ?? ''
  const desc = clean.slice(0, 120)
  return `${desc}${desc.length >= 120 ? '...' : ''}`
}

export type Toc = MarkdownHeading & { children: MarkdownHeading[] }

export function buildToc(headings: MarkdownHeading[]) {
  const minDepath = Math.min(...headings.map(h => h.depth))
  const toc = []
  const depthMap: { [key: number]: Toc } = {}
  for (const h of headings) {
    const heading = { ...h, children: [] }
    depthMap[h.depth] = heading
    if (heading.depth === minDepath) {
      toc.push(heading)
      continue
    }
    depthMap[heading.depth - 1].children.push(heading)
  }
  return toc
}
