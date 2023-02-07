import React from 'react'

function TweetButton() {
  return (
    <a
      className="twitter-share-button"
      href={`https://twitter.com/intent/tweet?via=koh110`}
      data-size="large"
    ></a>
  )
}

export default TweetButton
