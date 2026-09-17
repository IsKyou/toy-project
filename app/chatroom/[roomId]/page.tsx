import { ChatRoomView } from "@/features/chatroom";

export default async function Page({
  params,
}: PageProps<"/chatroom/[roomId]">) {
  const { roomId } = await params;
  return <ChatRoomView roomId={roomId} />;
}
