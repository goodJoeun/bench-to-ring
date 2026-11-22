/*
 * '텍스트만 보기'의 저장 키와 부팅 스크립트. 서버 컴포넌트(layout.tsx)가 문자열로 읽어야 해서 text-only.ts와 나눠 뒀어요.
 * 여기에 "use client"를 붙이면 서버에서는 문자열 대신 함수 참조가 와서, 테마까지 함께 든 스크립트 전체가 문법 오류로 멈춰요.
 */

export const TEXT_ONLY_KEY = "b2r-text-only";

/** 첫 화면이 그려지기 전에 저장된 값을 적용하는 스크립트(layout.tsx). 테마 스크립트 뒤에 이어 붙여요. */
export const TEXT_ONLY_BOOT = `try{if(localStorage.getItem("${TEXT_ONLY_KEY}")==="1")document.documentElement.dataset.textOnly=""}catch(e){}`;
