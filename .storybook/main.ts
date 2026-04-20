import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@storybook/addon-essentials",
    "@chromatic-com/storybook",
    "@storybook/addon-a11y",
    "@storybook/addon-interactions"
  ],
  "framework": "@storybook/react-vite",
  viteFinal: async (config) => {
    return {
      ...config,
      optimizeDeps: {
        ...config.optimizeDeps,
        exclude: [
          ...(config.optimizeDeps?.exclude || []),
          '@storybook/addon-toolbars',
          '@storybook/components'
        ],
      },
    };
  }
};
export default config;