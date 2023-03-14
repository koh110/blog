import type { CollectionEntry } from 'astro:content'
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
