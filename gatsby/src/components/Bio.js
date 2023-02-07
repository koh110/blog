import React from 'react'
import { useStaticQuery, graphql } from 'gatsby'
import { GatsbyImage } from 'gatsby-plugin-image'

import { rhythm } from '../utils/typography'

const bioQuery = graphql`
  query BioQuery {
    file(absolutePath: { regex: "/profile-pic.jpg/" }) {
      childImageSharp {
        gatsbyImageData(layout: FIXED)
      }
    }
    site {
      siteMetadata {
        author
        social {
          homepage
        }
      }
    }
  }
`

function Bio() {
  const data = useStaticQuery(bioQuery)
  const { author, social } = data.site.siteMetadata

  return (
    <div
      style={{
        display: `flex`,
        alignItems: 'center',
        marginBottom: rhythm(2.5)
      }}
    >
      <GatsbyImage
        fixed={data.file.childImageSharp.gatsbyImageData}
        alt={author}
        style={{
          marginRight: rhythm(1 / 2),
          marginBottom: 0,
          minWidth: 50,
          borderRadius: `100%`
        }}
      />
      <div>
        <strong>{author}</strong>
        <p style={{ margin: 0 }}>
          JavaScript エンジニア。 詳しくは
          <a href={`${social.homepage}`}>こちら</a>
        </p>
      </div>
    </div>
  )
}

export default Bio
