import UsersManagement from "@/modules/settings/users";
import { BackupSection } from "@/modules/settings/BackupSection";

export default function SettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <BackupSection />
      <UsersManagement />
    </div>
  );
}
