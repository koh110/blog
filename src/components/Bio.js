import React from 'react'
import { StaticQuery, graphql } from 'gatsby'
import { GatsbyImage } from 'gatsby-plugin-image'

import { rhythm } from '../utils/typography'

function Bio() {
  return (
    <StaticQuery
      query={bioQuery}
      render={data => {
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
      }}
    />
  )
}

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

export default Bio
