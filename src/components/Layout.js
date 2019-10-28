import React from 'react'
import { Link } from 'gatsby'

import { rhythm, scale } from '../utils/typography'

function Layout({ location, title, children, description }) {
  const rootPath = `${__PATH_PREFIX__}/`
  let header

  if (location.pathname === rootPath) {
    header = (
      <>
        <h1
          style={{
            ...scale(1.5),
            marginBottom: rhythm(1.5),
            marginTop: 0
          }}
        >
          <Link
            style={{
              boxShadow: `none`,
              textDecoration: `none`,
              color: `inherit`
            }}
            to={`/`}
          >
            {title}
          </Link>
        </h1>
        <h4 style={{ fontWeight: 500, marginBottom: rhythm(1.5) }}>{description}</h4>
      </>
    )
  } else {
    header = (
      <h3
        style={{
          marginTop: 0
        }}
      >
        <Link
          style={{
            boxShadow: `none`,
            textDecoration: `none`,
            color: `inherit`
          }}
          to={`/`}
        >
          {title}
        </Link>
      </h3>
    )
  }
  return (
    <div
      style={{
        marginLeft: `auto`,
        marginRight: `auto`,
        maxWidth: location.pathname === rootPath ? rhythm(24) : rhythm(36),
        padding: `${rhythm(1.5)} ${rhythm(3 / 4)}`
      }}
    >
      {header}
      {children}
      <footer>
        © {new Date().getFullYear()},{' '}
        <a href="https://koh.dev" target="_blank">
          kohsweb
        </a>
      </footer>
    </div>
  )
}

export default Layout
