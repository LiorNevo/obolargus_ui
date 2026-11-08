import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "../query/client";
import type { SemanticLayerViewState } from "../types/semanticLayer";
import { SemanticLayerExplorer } from "../pages/semantic-layer/SemanticLayerExplorer";
import { buildSemanticDictionary } from "../pages/semantic-layer/semanticDictionary";
import {
  semanticDictionaryCanonicalText,
  semanticDictionaryFixture,
} from "../pages/semantic-layer/__fixtures__/semanticDictionary";

const queryClient = createQueryClient();
const dictionary = buildSemanticDictionary(
  semanticDictionaryFixture,
  semanticDictionaryCanonicalText,
);

const OVERVIEW: SemanticLayerViewState = {
  view: "overview",
  definitionKey: null,
  tab: "details",
  query: "",
  kind: "all",
  subject: null,
  aggregate: null,
};

const meta = {
  title: "Semantic Layer/Explorer",
  component: SemanticLayerExplorer,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Read-only explorer over the canonical data dictionary. The story uses a representative fixture; production reads the server export.",
      },
    },
  },
  decorators: [
    (Story: ComponentType) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/semantic-layer"]}>
          <Story />
        </MemoryRouter>
      </QueryClientProvider>
    ),
  ],
  args: {
    dictionary,
    viewState: OVERVIEW,
    refreshing: false,
    refreshError: null,
    onRefresh: () => {},
    onNavigate: () => {},
  },
} satisfies Meta<typeof SemanticLayerExplorer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const EntityDefinition: Story = {
  args: {
    viewState: {
      ...OVERVIEW,
      view: "definition",
      definitionKey: "Portfolio",
    },
  },
};

export const FactTypeDefinition: Story = {
  args: {
    viewState: {
      ...OVERVIEW,
      view: "definition",
      definitionKey: "FactType.market_price",
    },
  },
};

export const SystemSemantics: Story = {
  args: {
    viewState: {
      ...OVERVIEW,
      view: "system",
    },
  },
};

export const SearchResults: Story = {
  args: {
    viewState: {
      ...OVERVIEW,
      query: "quantity",
    },
  },
};
