import assert from 'assert'
import React from 'react'
import ReactDOM from 'react-dom/client'

import { App } from './App'

const rootEl = document.getElementById('root')
assert(rootEl)

const root = ReactDOM.createRoot(rootEl)
root.render(<App />)

// @ts-ignore: Replace HMR with full reloading.
const hot = module.hot
if (hot) {
  hot.accept(() => void location.reload())
}
