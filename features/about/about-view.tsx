export function AboutView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-16 py-32 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        소개
      </h1>
      <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        이 화면은 SPA 스타일 구조를 확인하기 위한 예시입니다. 상단 셸의 버튼을 눌러
        숫자를 올린 뒤 홈으로 이동해도 값이 그대로 유지되는지 확인해보세요.
      </p>
    </div>
  );
}
