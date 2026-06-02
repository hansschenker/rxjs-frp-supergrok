// Custom theme entry: extend the VitePress default theme and layer on the
// RxJS magenta color scheme defined in custom.css. Registering a theme/index
// here makes VitePress use this instead of the bare default theme.
import DefaultTheme from 'vitepress/theme'
import './custom.css'

export default DefaultTheme
