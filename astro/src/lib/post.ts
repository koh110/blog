import type { MarkdownHeading } from 'astro'
import { getCollection, type CollectionEntry } from 'astro:content'
import { remark } from 'remark'
import remarkHtml from 'remark-html'

export async function createDescription(post: CollectionEntry<'blog'>) {
  const file = await remark()
    .use(remarkHtml)
    .process(post.body)
  const clean = String(file).replace(/<[^>]*>?/gm, '');
  const desc = clean.slice(0, 120)
  return `${desc}${desc.length >= 120 ? '...' : ''}`
}

export type Toc = MarkdownHeading & { children?: MarkdownHeading[] }

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
    depthMap[heading.depth - 1].children?.push(heading)
  }
  return toc
}

export async function getAllPosts() {
  const allPosts = await getCollection('blog')
  const posts = allPosts
    .sort((a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime())

  return posts
}
