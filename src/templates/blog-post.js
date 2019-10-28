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
  padding: 16px;
  color: #787c7b;
  margin-bottom: 40px;
  h4 {
    font-size: 14px;
    margin: 0;
    margin-bottom: 20px;
  }
`

const TableOfContents = styled.div`
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    li:first-child {
      border-top: none;
    }
    li {
      margin: 0;
      padding: 8px 0;
      font-size: 14px;
      list-style-type: none;
      border-top: 1px solid #e6e6e6;
    }
  }
`

const Date = styled.time`
  display: block;
  margin-bottom: ${rhythm(1)};
  margin-top: ${rhythm(1)};
`

const ButtonsWrap = styled.div`
  display: flex;
  justify-content: space-between;
  max-width: 200px;
`

function Buttons() {
  return (
    <ButtonsWrap>
      <TweetButton />
      <HatenaButton />
    </ButtonsWrap>
  )
}

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
      <div style={{ lineHeight: '36px' }} dangerouslySetInnerHTML={{ __html: post.html }} />
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
