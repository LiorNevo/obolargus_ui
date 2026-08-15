module.exports = {
  stories: ["../js/stories/**/*.stories.@(tsx|ts)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-actions",
  ],
  framework: "@storybook/react-webpack5",
  staticDirs: [],
};