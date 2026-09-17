import { redirect } from "next/navigation";

// 첫 진입은 프로필 탭으로 보낸다. 닉네임을 정해야 다른 탭이 의미가 있다.
export default function Page() {
  redirect("/userprofile");
}
