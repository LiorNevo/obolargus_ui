module.exports = {
  presets: [
    [
      require.resolve("@babel/preset-env", {
        paths: [require.resolve("lx_client/package.json")],
      }),
      { targets: { node: "current" } },
    ],
  ],
};
