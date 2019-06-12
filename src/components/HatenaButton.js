import React, { useEffect, useRef } from 'react'

function Hatena() {
  const wrapEl = useRef(null)

  const hatena =
    '<a href = "https://b.hatena.ne.jp/entry/" class="hatena-bookmark-button" data-hatena-bookmark-layout="basic-label-counter" data-hatena-bookmark-lang="ja" data-hatena-bookmark-height="28" title="このエントリーをはてなブックマークに追加"><img src="https://b.st-hatena.com/images/v4/public/entry-button/button-only@2x.png" alt="このエントリーをはてなブックマークに追加" width="20" height="20" style="border: none;" /></a>'

  useEffect(() => {
    if (!wrapEl) {
      return
    }
    const script = document.createElement('script')
    script.src = 'https://b.st-hatena.com/js/bookmark_button.js'
    script.async = 'async'
    script.type = 'text/javascript'
    script.charset = 'utf-8'
    wrapEl.current.appendChild(script)
  }, [wrapEl])

  return <div dangerouslySetInnerHTML={{ __html: hatena }} ref={wrapEl} />
}
export default Hatena
