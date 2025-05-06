import type { APIContext, GetStaticPaths } from 'astro'
import { getCollection } from 'astro:content'
import sharp from 'sharp'
import { createSVG } from '../../components/OgImage'

async function fetchFont(
  options: {
    text: string
    font: string
  }
): Promise<ArrayBuffer | null> {
  const API = `https://fonts.googleapis.com/css2?family=${options.font}&text=${encodeURIComponent(
    options.text
  )}`

  const css = await (
    await fetch(API)
  ).text()

  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)

  if (!resource) return null

  const res = await fetch(resource[1])

  return res.arrayBuffer()
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog')

  const result = posts.map((post) => {
    return {
      params: { id: post.id },
      props: {
        post
      }
    }
  })
  return result
}


export const GET = async (context: APIContext) => {
  if (!context.params.id) {
    return new Response('No id', { status: 400, statusText: 'No Slug' })
  }
  const post = context.props.post;
  if (!post) {
    return new Response('No Post', { status: 404, statusText: 'No Post' })
  }

  const title = post?.data.title ?? "No title";
  const fontName = 'Noto+Sans+JP:wght@700'
  const font = await fetchFont({ font: fontName, text: `${title}kohwsweblog@koh110` })

  if (!font) {
    return new Response('No Fonts', { status: 400, statusText: 'No Fonts' })
  }

  const svg = await createSVG(
    { title },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: fontName,
          data: font,
          weight: 400,
          style: 'normal',
        },
      ],
    },
  )
  const body = await sharp(Buffer.from(svg)).png().toBuffer()

  return new Response(body)
}
