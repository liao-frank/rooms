const path = require('path')

module.exports = {
  stories: [
    '../stories/Introduction.stories.mdx',
    '../stories/GettingStarted.stories.mdx',
    '../stories/*.stories.mdx',
  ],
  addons: [
    '@storybook/addon-links',
    {
      name: '@storybook/addon-essentials',
      options: {
        backgrounds: false,
        grid: false,
        outline: false,
      },
    },
    '@storybook/addon-interactions',
  ],
  framework: '@storybook/react',
  webpackFinal: async (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@src': path.resolve(__dirname, '../src'),
    }

    // Disable HMR because Storybook does double rendering on HMR which will
    // ghost hosts that never give up the host role.
    config.entry = config.entry.filter(
      (singleEntry) => !singleEntry.includes('/webpack-hot-middleware/')
    )

    return config
  },
}
