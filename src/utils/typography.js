import Typography from 'typography'
import Wordpress2016 from 'typography-theme-wordpress-2016'

Wordpress2016.overrideThemeStyles = () => {
  return {
    'a.gatsby-resp-image-link': {
      boxShadow: `none`
    }
  }
}

delete Wordpress2016.googleFonts

const fontFamily = [
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Helvetica',
  'sans-serif',
  'Apple Color Emoji',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
  'Hiragino Kaku Gothic ProN W3',
  'HiraKakuProN-W3',
  'ヒラギノ角ゴ ProN W3',
  'メイリオ',
  'Arial',
  'Osaka',
  'ＭＳ Ｐゴシック',
  'MS PGothic',
  'Helvetica'
]

Wordpress2016.headerFontFamily = [...fontFamily, ...Wordpress2016.headerFontFamily]

Wordpress2016.bodyFontFamily = [...fontFamily, ...Wordpress2016.bodyFontFamily]

Wordpress2016.overrideThemeStyles = ({ rhythm }, options) => ({
  a: {
    boxShadow: 'none'
  },
  body: {
    fontKerning: 'normal',
    color: 'hsla(0, 0%, 0%, 0.8)'
  },
  'h2,h3': {
    fontWeight: '700'
  }
})

const typography = new Typography({
  ...Wordpress2016,
  baseFontSize: '18px'
})

// Hot reload typography in development.
if (process.env.NODE_ENV !== `production`) {
  typography.injectStyles()
}

export default typography
export const rhythm = typography.rhythm
export const scale = typography.scale
