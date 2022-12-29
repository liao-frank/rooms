import { addons } from '@storybook/addons'

import roomsTheme from './RoomTheme'
import favicon from './assets/favicon.ico'

addons.setConfig({
  theme: roomsTheme,
})

// Override favicon.
const faviconEl = document.createElement('link')
faviconEl.setAttribute('rel', 'shortcut icon')
faviconEl.setAttribute('href', favicon)
document.head.appendChild(faviconEl)
