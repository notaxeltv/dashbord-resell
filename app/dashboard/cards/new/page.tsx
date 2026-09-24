import { redirect } from "next/navigation";

export default function NewCardRedirect() {
  redirect("/dashboard/cards");
}
