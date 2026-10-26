const path = require("path");
const { realpathSync } = require("fs");

const lxClientSource = realpathSync(
  path.resolve(__dirname, "../node_modules/lx_client/js"),
);

module.exports = {
  stories: [
    "../js/stories/**/*.stories.@(tsx|ts)",
    "../js/**/__stories__/**/*.stories.@(tsx|ts)",
  ],
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
      use: {
        loader: "ts-loader",
        options: { allowTsInNodeModules: true },
      },
      include: [path.resolve(__dirname, "../js"), lxClientSource],
    });
    return config;
  },
};
