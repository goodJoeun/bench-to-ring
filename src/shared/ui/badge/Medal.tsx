/** 업적 메달: 빨강·파랑 리본에 걸린 금메달과 별. 업적 달성 축하 팝업과 딴 업적 카드의 훈장이 같이 써요. */
export function Medal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <polygon points="18,2 30,2 36,24 26,28" fill="#E0503A" />
      <polygon points="34,2 46,2 38,28 28,24" fill="#3D7BFF" />
      <circle cx="32" cy="40" r="20" fill="#FFD66B" stroke="#E2A93B" strokeWidth="3" />
      <circle cx="32" cy="40" r="14" fill="#F5B83D" />
      <polygon
        points="32,30 34.47,36.6 41.51,36.91 35.99,41.3 37.88,48.09 32,44.2 26.12,48.09 28.01,41.3 22.49,36.91 29.53,36.6"
        fill="#FFF7D6"
      />
    </svg>
  );
}

/** 딴 업적 카드의 오른쪽 위에 다는 훈장. 화면 낭독기에는 '달성'으로 읽혀요. */
export function AchievedBadge() {
  return (
    <span className="achv-badge">
      <Medal className="achv-badge-medal" />
      <span className="sr-only">달성</span>
    </span>
  );
}
