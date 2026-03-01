import { redirect } from "next/navigation";
// Dashboard redirects to the main content hub
export default function DashboardPage() {
  redirect("/semestres");
}
