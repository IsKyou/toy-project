// 환경변수로 덮어쓸 수 있게 하되, 문서 기준 기본값을 그대로 둔다.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_MATEON_API_BASE_URL ??
  "https://mateon.its-m-style.workers.dev";
