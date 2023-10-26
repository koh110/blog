import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

// https://astro.build/config
/** @type {import('astro').AstroUserConfig} */
export default defineConfig({
  output: 'static',
  integrations: [react()],
  // https://docs.astro.build/en/reference/configuration-reference/#markdown-options
  markdown: {
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          content: {
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['material-symbols-outlined'],
            },
            children: [{ type: 'text', value: 'link'}],
          }
        }
      ]
    ]
  }
})
