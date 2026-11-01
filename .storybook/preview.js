import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "../js/query/client";

function withQueryClient(Story) {
  const [client] = React.useState(() => createQueryClient());
  return React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(Story),
  );
}

export const decorators = [withQueryClient];

export const parameters = {
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/i,
    },
  },
};
