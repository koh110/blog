import React from 'react'
import { Link, graphql } from 'gatsby'
import styled from 'styled-components'

import Bio from '../components/Bio'
import Layout from '../components/Layout'
import SEO from '../components/seo'
import HatenaButton from '../components/HatenaButton'
import TweetButton from '../components/TweetButton'
import { rhythm, scale } from '../utils/typography'

const TableOfContentsWrapper = styled.nav`
  background-color: var(--color-on-background);
  padding: 32px;
  color: #24292e;
  margin-bottom: 40px;
  h4 {
    font-size: 14px;
    margin: 0;
    margin-bottom: 20px;
  }
  li {
    > p {
      margin-bottom: 0;
    }
    > ul {
      margin-left: 1.5em;
    }
  }
`

const TableOfContents = styled.div`
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    li {
      margin: 0;
      padding: 8px 0;
      font-size: 14px;
      list-style-type: none;
      border-top: 1px solid #d1d5da;
    }
  }
`

const Date = styled.time`
  display: block;
  margin-top: 16px;
`

const ButtonsWrap = styled.div`
  display: flex;
  justify-content: space-between;
  max-width: 200px;
  margin-top: 10px;
`

function Buttons() {
  return (
    <ButtonsWrap>
      <TweetButton />
      <HatenaButton />
    </ButtonsWrap>
  )
}

const Post = styled.div`
  line-height: 36px;
  h1 {
    font-weight: 800;
    background-color: var(--color-background-head);
    padding: 8px 0 0 0;
  }
  h2,
  h3 {
    font-weight: 700;
    background-color: var(--color-background-head);
    padding: 8px 0 0 0;
  }
  blockquote: {
    border-left: 0.32813rem solid var(--color-blockquote-border-left);
    color: var(--color-blockquote);
  }
`

function BlogPostTemplate(props) {
  const post = props.data.markdownRemark
  const siteTitle = props.data.site.siteMetadata.title
  const { previous, next } = props.pageContext

  return (
    <Layout location={props.location} title={siteTitle}>
      <SEO title={post.frontmatter.title} description={post.excerpt} />
      <h1>{post.frontmatter.title}</h1>
      <Date style={{ ...scale(-1 / 5) }}>{post.frontmatter.date}</Date>
      <Buttons />
      {post.tableOfContents && (
        <TableOfContentsWrapper>
          <h4>目次</h4>
          <TableOfContents dangerouslySetInnerHTML={{ __html: post.tableOfContents }} />
        </TableOfContentsWrapper>
      )}
      <Post dangerouslySetInnerHTML={{ __html: post.html }} />
      <hr
        style={{
          marginTop: rhythm(1),
          marginBottom: rhythm(1)
        }}
      />
      <Bio />

      <ul
        style={{
          display: `flex`,
          flexWrap: `wrap`,
          justifyContent: `space-between`,
          listStyle: `none`,
          padding: 0
        }}
      >
        <li>
          {previous && (
            <Link to={previous.fields.slug} rel="prev">
              ← {previous.frontmatter.title}
            </Link>
          )}
        </li>
        <li>
          {next && (
            <Link to={next.fields.slug} rel="next">
              {next.frontmatter.title} →
            </Link>
          )}
        </li>
      </ul>
    </Layout>
  )
}

export default BlogPostTemplate

export const pageQuery = graphql`
  query BlogPostBySlug($slug: String!) {
    site {
      siteMetadata {
        title
        author
      }
    }
    markdownRemark(fields: { slug: { eq: $slug } }) {
      id
      excerpt(pruneLength: 160)
      html
      tableOfContents
      frontmatter {
        title
        date(formatString: "YYYY-MM-DD")
      }
    }
  }
`
