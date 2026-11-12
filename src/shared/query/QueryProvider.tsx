"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "./query-client";

/** 앱 전체에 TanStack Query를 열어 줘요. 레이아웃(서버 컴포넌트)에서 감싸려고 클라이언트 컴포넌트로 따로 뒀어요. */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
