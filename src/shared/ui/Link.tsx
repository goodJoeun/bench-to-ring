import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * 사이트 안 링크. 화면에 보이기만 해도 다음 페이지를 미리 받는 프리페치를 꺼요.
 * 프리페치 한 번이 CDN 요청 두 건이라 누르지 않는 방문자까지 요청이 쌓여요. 페이지는 CDN에 있어서 누른 뒤에 받아도 빨라요.
 */
export function Link(props: Omit<ComponentProps<typeof NextLink>, "prefetch">) {
  return <NextLink {...props} prefetch={false} />;
}
