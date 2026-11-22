import { TEXT_ONLY_BOOT } from "./text-only-boot";
import { THEME_BOOT } from "./theme";

/**
 * 저장된 화면 테마와 '텍스트만 보기'를 첫 화면이 그려지기 전에 적용하는 스크립트. layout.tsx의 <head>에 그대로 넣어요.
 * 서버 컴포넌트가 문자열로 읽으니 이 파일과 가져오는 파일에는 "use client"를 붙이지 않아요.
 */
export const BOOT_SCRIPT = `(function(){${THEME_BOOT};${TEXT_ONLY_BOOT}})()`;
