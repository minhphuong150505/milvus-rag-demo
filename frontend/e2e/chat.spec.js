import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

async function send(page, text) {
  await page.getByRole("textbox", { name: "Nhập câu hỏi" }).fill(text);
  await page.getByRole("button", { name: "Gửi câu hỏi", exact: true }).click();
}
async function finished(page) {
  await expect(page.getByRole("button", { name: "Dừng trả lời" })).toHaveCount(
    0,
  );
}
async function boot(page) {
  await page.goto("/");
  await expect(page.locator(".health")).toHaveText("Đã kết nối");
}

test("stream, markdown table, history payload, citations, copy and regenerate", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await boot(page);
  await expect(
    page.getByRole("button", { name: "Gửi câu hỏi", exact: true }),
  ).toBeDisabled();
  await send(page, "Doanh thu FPT năm 2024?");
  await finished(page);
  await expect(page.locator("table")).toBeVisible();
  await expect(
    page.getByText("Có căn cứ tài liệu", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xem nguồn 2", exact: true }).click();
  await expect(
    page.locator(".desktop-sources .source-item.highlighted"),
  ).toContainText("Giới thiệu Tập đoàn FPT");
  await page
    .locator(".desktop-sources .source-excerpt summary")
    .first()
    .click();
  await expect(
    page.locator(".desktop-sources .source-excerpt[open]"),
  ).toContainText("62.849");
  await page
    .getByRole("button", { name: "Sao chép câu trả lời", exact: true })
    .click();
  await expect(page.getByText("Đã sao chép", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "FPT",
  );
  const request = page.waitForRequest((r) => r.url().endsWith("/chat/stream"));
  await send(page, "Còn lĩnh vực giáo dục?");
  expect((await request).postDataJSON().history).toHaveLength(2);
  await finished(page);
  await page
    .getByRole("button", { name: "Hỏi lại", exact: true })
    .first()
    .click();
  await finished(page);
  await expect(page.locator(".assistant-row")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("out of scope is ungrounded; selecting old answer restores sources", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await boot(page);
  await send(page, "FPT có những lĩnh vực nào?");
  await finished(page);
  await send(page, "Thời tiết Hà Nội hôm nay?");
  await finished(page);
  await expect(
    page.getByText("Không tìm thấy trong tài liệu", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".desktop-sources .source-item")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Nguồn (2)", exact: true })
    .first()
    .click();
  await expect(page.locator(".desktop-sources .source-item")).toHaveCount(2);
});

test("network error preserves question, retry, partial stream and stop", async ({
  page,
}) => {
  await boot(page);
  await send(page, "lỗi mạng FPT");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".user-bubble")).toHaveText("lỗi mạng FPT");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".user-bubble")).toHaveCount(1);
  await send(page, "FPT chậm");
  await expect(
    page.getByRole("button", { name: "Dừng trả lời" }),
  ).toBeVisible();
  await expect(page.locator(".assistant-bubble").last()).toContainText("FPT");
  await page.getByRole("button", { name: "Dừng trả lời" }).click();
  await expect(
    page.getByText("Đã dừng trả lời. Bạn có thể hỏi lại khi sẵn sàng."),
  ).toBeVisible();
  let fallback = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/chat")) fallback++;
  });
  await send(page, "FPT ngắt");
  await expect(page.getByRole("alert").last()).toBeVisible();
  expect(fallback).toBe(0);
});

test("unsupported streaming falls back to JSON", async ({ page }) => {
  await boot(page);
  const request = page.waitForRequest((r) => r.url().endsWith("/chat"));
  await send(page, "FPT fallback");
  await request;
  await finished(page);
  await expect(page.locator("table")).toBeVisible();
});

test("conversations: draft, rename, switch, reload, delete", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await boot(page);
  await send(page, "FPT năm 2024");
  await finished(page);
  await page
    .getByRole("button", { name: "Đổi tên FPT năm 2024", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Tên hội thoại" })
    .fill("Nghiên cứu FPT");
  await page.getByRole("button", { name: "Lưu tên", exact: true }).click();
  await page
    .getByRole("button", { name: "Tạo hội thoại mới", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nhập câu hỏi" })
    .fill("Bản nháp còn đây");
  await page
    .getByRole("button", { name: "Nghiên cứu FPT", exact: true })
    .click();
  await expect(page.locator(".assistant-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Hội thoại mới", exact: true })
    .last()
    .click();
  await expect(page.getByRole("textbox", { name: "Nhập câu hỏi" })).toHaveValue(
    "Bản nháp còn đây",
  );
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Nhập câu hỏi" })).toHaveValue(
    "Bản nháp còn đây",
  );
  await page.getByRole("button", { name: "Nghiên cứu FPT", exact: true }).focus();
  await page
    .getByRole("button", { name: "Xóa Nghiên cứu FPT", exact: true })
    .click();
  await page.getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Nghiên cứu FPT", exact: true }),
  ).toHaveCount(0);
});

test("theme system preference persists; keyboard composer and drawer focus", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await boot(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Chuyển sáng / tối" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Mở lịch sử hội thoại" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Mở lịch sử hội thoại" }),
  ).toBeFocused();
  const input = page.getByRole("textbox", { name: "Nhập câu hỏi" });
  await input.fill("FPT");
  await input.press("Shift+Enter");
  await input.press("a");
  await expect(input).toHaveValue("FPT\na");
  await input.press("Enter");
  await finished(page);
  await expect(page.locator(".user-bubble")).toHaveText("FPT\na");
});

test("long conversation does not jump while reading older messages", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const messages = Array.from({ length: 60 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 ? "assistant" : "user",
      content: `Tin nhắn ${i}\n\n${"Nội dung trao đổi về doanh nghiệp. ".repeat(12)}`,
      question: "FPT?",
      createdAt: "2026-09-14T10:00:00Z",
      sources: [],
      grounded: true,
    }));
    localStorage.setItem(
      "fpt-conversations-v1",
      JSON.stringify({
        version: 1,
        activeId: "long",
        conversations: [{ id: "long", title: "Hội thoại dài", messages }],
      }),
    );
  });
  await boot(page);
  await send(page, "FPT chậm");
  await page.locator(".message-list").evaluate((el) => {
    el.scrollTop = 100;
    el.dispatchEvent(new Event("scroll"));
  });
  await expect(
    page.getByRole("button", { name: "Cuộn xuống cuối" }),
  ).toBeVisible();
  await page.waitForTimeout(600);
  expect(
    await page.locator(".message-list").evaluate((el) => el.scrollTop),
  ).toBeLessThan(150);
  await page.getByRole("button", { name: "Dừng trả lời" }).click();
  await page.getByRole("button", { name: "Cuộn xuống cuối" }).click();
  await expect(
    page.getByRole("button", { name: "Cuộn xuống cuối" }),
  ).toHaveCount(0);
});

test("health offline and corrupted storage are handled", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("fpt-conversations-v1", "{broken"),
  );
  await page.route("**/api/health", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".health")).toHaveText("Mất kết nối");
  await expect(
    page.getByRole("heading", { name: /Bạn muốn hiểu gì/ }),
  ).toBeVisible();
});

for (const width of [375, 768, 1440])
  for (const theme of ["light", "dark"]) {
    test(`screenshots and accessibility ${width} ${theme}`, async ({
      page,
    }) => {
      await mkdir("../docs/screenshots", { recursive: true });
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await boot(page);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `../docs/screenshots/${width}-${theme}-welcome.png`,
        fullPage: true,
      });
      const emptyAudit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        emptyAudit.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`,
        ),
      ).toEqual([]);
      await send(page, "Doanh thu FPT năm 2024?");
      await finished(page);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `../docs/screenshots/${width}-${theme}-chat.png`,
        fullPage: true,
      });
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        audit.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`,
        ),
      ).toEqual([]);
      if (width < 1200) {
        await page.getByRole("button", { name: "Mở nguồn trích dẫn" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.screenshot({
          path: `../docs/screenshots/${width}-${theme}-sources.png`,
          fullPage: true,
        });
        await page.keyboard.press("Escape");
      }
    });
  }
