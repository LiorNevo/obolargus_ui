import { createAppRouter } from "lx_client/js/navigation/routes";
import { BASE_PATH } from "../../config";
import { UI_ACCESS_CONTEXT } from "../access";
import { AppLayout } from "../AppLayout";
import { PAGES } from "../pages";
import { getAppRouter } from "../../router";

jest.mock("lx_client/js/navigation/routes", () => ({
  createAppRouter: jest.fn(),
}));

const mockedCreateAppRouter = jest.mocked(createAppRouter);

describe("getAppRouter", () => {
  it("creates the production router once with the base path and registry", () => {
    const fakeRouter = { navigate: jest.fn() };
    mockedCreateAppRouter.mockReturnValue(
      fakeRouter as unknown as ReturnType<typeof createAppRouter>,
    );

    expect(getAppRouter()).toBe(fakeRouter);
    expect(getAppRouter()).toBe(fakeRouter);

    expect(mockedCreateAppRouter).toHaveBeenCalledTimes(1);
    expect(mockedCreateAppRouter).toHaveBeenCalledWith({
      pages: PAGES,
      Layout: AppLayout,
      access: UI_ACCESS_CONTEXT,
      basename: BASE_PATH,
      notFoundElement: expect.anything(),
      errorElement: expect.anything(),
    });
  });
});
