import { redirect } from "next/navigation";

export default function EditCardRedirect() {
  redirect("/dashboard/cards");
}
