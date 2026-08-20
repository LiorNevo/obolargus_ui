module.exports = {
  stories: ["../js/stories/**/*.stories.@(tsx|ts)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-actions",
  ],
  framework: "@storybook/react-webpack5",
  staticDirs: [],
  webpackFinal: async (config) => {
    config.module.rules.push({
      test: /\.tsx$/,
      use: "ts-loader",
      exclude: /node_modules/,
    });
    return config;
  },
};
