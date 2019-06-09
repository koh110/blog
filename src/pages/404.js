import React from 'react'

import Layout from '../components/Layout'
import SEO from '../components/seo'

function NotFoundPage(props) {
  return (
    <Layout location={props.location}>
      <SEO title="404: Not Found" />
      <h1>Not Found</h1>
      <p>そんなページないでーす</p>
    </Layout>
  )
}

export default NotFoundPage
