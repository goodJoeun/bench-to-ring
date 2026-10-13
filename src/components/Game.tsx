"use client";

import { useGame } from "@/lib/game-store";
import { CreateScreen } from "./CreateScreen";
import { GameScreen } from "./GameScreen";
import { RetiredScreen } from "./RetiredScreen";

export function Game() {
  const { ready, career, draft, hall } = useGame();

  let body: React.ReactNode;
  if (!ready) body = <p className="boot">커리어를 불러오고 있어요…</p>;
  else if (!career) body = <CreateScreen draft={draft} hall={hall} />;
  else if (career.stage === "retired") body = <RetiredScreen career={career} hall={hall} />;
  else body = <GameScreen career={career} hall={hall} />;

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="ball" aria-hidden="true" />
          <span>벤치에서 반지까지</span>
        </div>
        {ready && career && career.stage !== "retired" && (
          <div className="hmeta">
            <span>
              {career.p.name} · {career.year} 시즌 준비
            </span>
            <span className="saved">자동 저장</span>
          </div>
        )}
      </header>
      {body}
      <p className="foot">
        비공식 팬 게임이에요. 리그·구단·대회 명칭의 권리는 각 권리자에게 있어요. 진행 내용은 이 브라우저에만 저장되니,
        중요한 커리어는 설정 탭에서 저장 코드를 복사해 두세요.
      </p>
    </>
  );
}
