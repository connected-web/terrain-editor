import type { App } from 'vue'

import Icon from './components/Icon.vue'

import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as brandIcons from '@fortawesome/free-brands-svg-icons'

export default function setupIcons(app: App) {
  library.add(solidIcons.fas)
  library.add(brandIcons.fab)
  app.component('FontAwesomeIcon', FontAwesomeIcon)
  app.component('Icon', Icon)
}
