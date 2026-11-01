import React from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { createTestQueryClient } from "./client";

/** Builds a provider wrapper around an isolated test cache. */
export function createQueryWrapper(
  client: QueryClient = createTestQueryClient(),
): React.ComponentType<{ children: React.ReactNode }> {
  return function QueryWrapper({
    children,
  }: {
    children: React.ReactNode;
  }): React.ReactElement {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

export interface RenderWithQueryClientOptions
  extends Omit<RenderOptions, "wrapper"> {
  client?: QueryClient;
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

export interface RenderWithQueryClientResult extends RenderResult {
  client: QueryClient;
}

/** Renders UI with a fresh query cache and an optional user wrapper. */
export function renderWithQueryClient(
  ui: React.ReactElement,
  options: RenderWithQueryClientOptions = {},
): RenderWithQueryClientResult {
  const { client = createTestQueryClient(), wrapper: UserWrapper, ...rest } =
    options;

  const Wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.ReactElement => (
    <QueryClientProvider client={client}>
      {UserWrapper ? <UserWrapper>{children}</UserWrapper> : children}
    </QueryClientProvider>
  );

  return {
    ...render(ui, { ...rest, wrapper: Wrapper }),
    client,
  };
}
