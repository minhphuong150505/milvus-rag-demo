// Deterministic test data; never mounted in the production application.
import http from "node:http";
export const sources = [
  {
    docTitle: "Báo cáo thường niên FPT 2024",
    sourceUrl: "https://fpt.com/vi/quan-he-nha-dau-tu/bao-cao-thuong-nien",
    sourceType: "pdf",
    page: 24,
    score: 0.873,
    snippet: "FPT ghi nhận doanh thu tăng trưởng trong năm 2024.",
    chunkText:
      "Năm 2024, FPT ghi nhận doanh thu 62.849 tỷ đồng, tăng 19,4% so với năm trước. Lợi nhuận trước thuế đạt 11.071 tỷ đồng. Công nghệ tiếp tục là động lực tăng trưởng chính. Dữ liệu minh họa cho kiểm thử giao diện.",
  },
  {
    docTitle: "Giới thiệu Tập đoàn FPT",
    sourceUrl: "https://fpt.com/vi/ve-fpt",
    sourceType: "web",
    page: 0,
    score: 0.812,
    chunkText:
      "FPT hoạt động trong ba lĩnh vực cốt lõi: Công nghệ, Viễn thông và Giáo dục. Dữ liệu minh họa cho kiểm thử giao diện.",
  },
];
export const answer =
  "Năm 2024, **FPT tiếp tục tăng trưởng** trên các lĩnh vực kinh doanh cốt lõi. [1]\n\n| Chỉ tiêu | Năm 2024 | Tăng trưởng |\n| --- | ---: | ---: |\n| Doanh thu | 62.849 tỷ đồng | 19,4% |\n| Lợi nhuận trước thuế | 11.071 tỷ đồng | 20,3% |\n\n**Ba lĩnh vực hoạt động chính:** [2]\n\n- **Công nghệ:** chuyển đổi số, AI và dịch vụ phần mềm.\n- **Viễn thông:** kết nối internet và dịch vụ số.\n- **Giáo dục:** đào tạo nguồn nhân lực chất lượng cao.\n\nBạn muốn tìm hiểu sâu hơn về lĩnh vực nào?";
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === "/api/health") {
    res.setHeader("Content-Type", "application/json");
    res.end('{"status":"ok"}');
    return;
  }
  let raw = "";
  for await (const data of req) raw += data;
  const body = JSON.parse(raw || "{}");
  const question = body.question || "";
  if (question.includes("lỗi mạng")) {
    req.socket.destroy();
    return;
  }
  if (question.includes("fallback") && req.url.endsWith("/stream")) {
    res.writeHead(404);
    res.end();
    return;
  }
  const grounded = !question.toLowerCase().includes("thời tiết");
  const result = {
    answer: grounded
      ? answer
      : "Tôi không tìm thấy thông tin này trong tài liệu của doanh nghiệp.",
    grounded,
    latencyMs: 1840,
    sources: grounded ? sources : [],
  };
  if (!req.url.endsWith("/stream")) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });
  const write = (event, data) =>
    res.write(`event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`);
  write("sources", { sources: result.sources });
  const tokens = result.answer.match(/.{1,30}|\n/g);
  let index = 0;
  const timer = setInterval(
    () => {
      if (index < tokens.length) {
        write("token", { token: tokens[index++] });
        if (question.includes("ngắt") && index === 3) res.end();
      } else {
        write("done", result);
        res.end();
      }
    },
    question.includes("chậm") ? 160 : 5,
  );
  res.on("close", () => clearInterval(timer));
});
server.listen(8099, "127.0.0.1");
